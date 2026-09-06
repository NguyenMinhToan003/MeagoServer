import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@meago/core';
import type { IPermission, IRole } from '@meago/core';
import { RequirePermissions } from 'src/common/decorators/require-permissions.decorator';
import { AuditAction } from 'src/modules/audit/audit-action.decorator';
import { RbacService } from './rbac.service';
import { SetRolePermissionsDto, SetUserRolesDto } from './rbac.dto';
import { RoleEntity } from './role.entity';
import { PermissionEntity } from './permission.entity';

/** Điểm mutation duy nhất của role/permission qua HTTP; invalidation nằm trong RbacService. */
@ApiTags('rbac')
@ApiBearerAuth()
@ApiCookieAuth()
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @RequirePermissions(PERMISSIONS.ROLE.READ)
  async listRoles(): Promise<IRole[]> {
    return (await this.rbacService.listRoles()).map(toRole);
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.ROLE.READ)
  async listPermissions(): Promise<IPermission[]> {
    return (await this.rbacService.listPermissions()).map(toPermission);
  }

  @Put('roles/:id/permissions')
  @RequirePermissions(PERMISSIONS.ROLE.MANAGE)
  @AuditAction({ action: 'rbac.role.set_permissions', resourceType: 'role', resourceIdPath: 'id' })
  async setRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRolePermissionsDto,
  ): Promise<IRole> {
    return toRole(await this.rbacService.setRolePermissions(id, dto.permissions));
  }

  @Put('users/:id/roles')
  @RequirePermissions(PERMISSIONS.USER.MANAGE)
  @AuditAction({ action: 'rbac.user.set_roles', resourceType: 'user', resourceIdPath: 'id' })
  async setUserRoles(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetUserRolesDto) {
    const user = await this.rbacService.setUserRoles(id, dto.roleIds);
    return { id: user.id, roles: user.roles.map(toRole) };
  }
}

function toPermission(p: PermissionEntity): IPermission {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    version: p.version,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt?.toISOString() ?? null,
  };
}

function toRole(r: RoleEntity): IRole {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    permissions: (r.permissions ?? []).map(toPermission),
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt?.toISOString() ?? null,
  };
}
