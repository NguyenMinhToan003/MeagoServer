import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { IJwtUser } from '../decorators/current-user.decorator';
import { RbacService } from 'src/modules/rbac/rbac.service';

/**
 * Guard global chạy SAU JwtAuthGuard.
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

    const user: IJwtUser | undefined = context.switchToHttp().getRequest().user;
    if (!user) return false;

    const granted = await this.rbacService.getUserPermissions(user.sub);
    const missing = required.filter((p) => !granted.has(p));
    if (missing.length) {
      throw new ForbiddenException(`Missing permissions: ${missing.join(', ')}`);
    }
    return true;
  }
}
