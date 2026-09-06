import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigType } from '@nestjs/config';
import { DataSource, In, Repository } from 'typeorm';
import { UserEntity } from 'src/modules/users/user.entity';
import { RedisService } from 'src/libraries/redis/redis.service';
import authConfig from 'src/configs/auth.config';
import { findOneForUpdate, runInTransaction } from 'src/database/concurrency';
import { RoleEntity } from './role.entity';
import { PermissionEntity } from './permission.entity';

const PERM_CACHE_PREFIX = 'rbac:perms:';

/**
 * RBAC động: roles/permissions là data trong DB, admin sửa runtime.
 * Tập permission theo user cache trong Redis theo TTL; mọi mutation role/permission
 * đi qua service này và invalidate SAU khi commit. Redis lỗi → fail-open về query DB.
 */
@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity) private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepo: Repository<PermissionEntity>,
    private readonly redisService: RedisService,
    @Inject(authConfig.KEY) private readonly conf: ConfigType<typeof authConfig>,
    private readonly dataSource: DataSource,
  ) {}

  async getUserPermissions(userId: string): Promise<Set<string>> {
    const cacheKey = PERM_CACHE_PREFIX + userId;
    const cached = await this.redisService.getJson<string[]>(cacheKey);
    if (cached) return new Set(cached);

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { roles: true }, // roles eager-load permissions
    });
    const permissions = (user?.roles ?? []).flatMap((r) => r.permissions.map((p) => p.name));
    await this.redisService.setJson(cacheKey, permissions, this.conf.permissionCacheTtlMs);
    return new Set(permissions);
  }

  listRoles(): Promise<RoleEntity[]> {
    return this.roleRepo.find({ order: { name: 'ASC' } });
  }

  listPermissions(): Promise<PermissionEntity[]> {
    return this.permissionRepo.find({ order: { name: 'ASC' } });
  }

  /** Thay toàn bộ permission của một role; ảnh hưởng mọi user mang role → invalidate all. */
  async setRolePermissions(roleId: string, permissionNames: string[]): Promise<RoleEntity> {
    const role = await runInTransaction(
      this.dataSource,
      async (manager) => {
        const locked = await findOneForUpdate(manager, RoleEntity, { id: roleId });
        if (!locked) throw new NotFoundException('Role not found');

        const permissions = await manager
          .getRepository(PermissionEntity)
          .find({ where: { name: In(permissionNames) } });
        const missing = permissionNames.filter((n) => !permissions.some((p) => p.name === n));
        if (missing.length) {
          throw new BadRequestException({
            code: 'RBAC_UNKNOWN_PERMISSION',
            message: 'Unknown permissions',
            details: { missing },
          });
        }

        locked.permissions = permissions;
        return manager.getRepository(RoleEntity).save(locked);
      },
      { lockTimeoutMs: this.conf.transactionLockTimeoutMs },
    );
    await this.invalidateAll(); // sau commit — cache-aside: DB trước, DEL sau
    return role;
  }

  /** Thay toàn bộ role của một user → chỉ invalidate user đó. */
  async setUserRoles(userId: string, roleIds: string[]): Promise<UserEntity> {
    const user = await runInTransaction(
      this.dataSource,
      async (manager) => {
        // Lock row user không kèm relation (FOR UPDATE không áp lên outer join của ManyToMany).
        const locked = await findOneForUpdate(manager, UserEntity, { id: userId });
        if (!locked) throw new NotFoundException('User not found');

        const roles = await manager.getRepository(RoleEntity).find({ where: { id: In(roleIds) } });
        const missing = roleIds.filter((id) => !roles.some((r) => r.id === id));
        if (missing.length) {
          throw new BadRequestException({
            code: 'RBAC_UNKNOWN_ROLE',
            message: 'Unknown roles',
            details: { missing },
          });
        }

        locked.roles = roles;
        return manager.getRepository(UserEntity).save(locked);
      },
      { lockTimeoutMs: this.conf.transactionLockTimeoutMs },
    );
    await this.invalidateUser(userId); // sau commit
    return user;
  }

  /** Gọi khi admin đổi role của user. */
  async invalidateUser(userId: string): Promise<void> {
    await this.redisService.del(PERM_CACHE_PREFIX + userId);
  }

  /** Gọi khi admin sửa role/permission dùng chung. */
  async invalidateAll(): Promise<void> {
    await this.redisService.delByPrefix(PERM_CACHE_PREFIX);
  }
}
