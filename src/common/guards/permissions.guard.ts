import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { AuthPrincipal } from '@meago/core';
import { RbacService } from 'src/modules/rbac/rbac.service';

/**
 * Guard global chạy sau AuthenticationGuard.
 * Route không có @RequirePermissions → pass.
 * Có → load tập permission của user (cache trong RbacService) và yêu cầu đủ TẤT CẢ.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user;
    if (!user) return false;

    const granted = await this.rbacService.getUserPermissions(user.subjectId);
    const missing = required.filter((p) => !granted.has(p));
    if (missing.length) {
      throw new ForbiddenException(`Missing permissions: ${missing.join(', ')}`);
    }
    return true;
  }
}
