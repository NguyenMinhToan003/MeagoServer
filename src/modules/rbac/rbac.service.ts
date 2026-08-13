import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigType } from '@nestjs/config';
import { Repository } from 'typeorm';
import { UserEntity } from 'src/modules/users/user.entity';
import { RedisService } from 'src/libraries/redis/redis.service';
import authConfig from 'src/configs/auth.config';

const PERM_CACHE_PREFIX = 'rbac:perms:';

/**
 * RBAC động: roles/permissions là data trong DB, admin sửa runtime.
 * Tập permission theo user cache trong Redis theo TTL,
 * invalidate khi admin đổi quyền. Redis lỗi → fail-open về query DB.
 */
@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    private readonly redisService: RedisService,
    @Inject(authConfig.KEY) private readonly conf: ConfigType<typeof authConfig>,
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

  /** Gọi khi admin đổi role của user. */
  async invalidateUser(userId: string): Promise<void> {
    await this.redisService.del(PERM_CACHE_PREFIX + userId);
  }

  /** Gọi khi admin sửa role/permission dùng chung. */
  async invalidateAll(): Promise<void> {
    await this.redisService.delByPrefix(PERM_CACHE_PREFIX);
  }
}
