import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Request } from 'express';
import { AuthMode } from '@meago/core';
import authConfig from 'src/configs/auth.config';

export const CSRF_HEADER_NAME = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'XMLHttpRequest';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Chỉ có tác dụng ở session mode: cookie được trình duyệt gửi tự động nên request
 * cross-site có thể mang danh tính người dùng. Trình duyệt không cho origin lạ gắn
 * custom header nếu không qua CORS preflight, vì vậy yêu cầu header cố định trên mọi
 * method không an toàn là đủ cho SPA gọi API. JWT mode dùng Bearer header nên miễn nhiễm.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(authConfig.KEY) private readonly conf: ConfigType<typeof authConfig>) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.conf.mode !== AuthMode.SESSION || context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

    const header = request.headers[CSRF_HEADER_NAME];
    const value = Array.isArray(header) ? header[0] : header;
    if (value === CSRF_HEADER_VALUE) return true;

    throw new ForbiddenException({
      code: 'AUTH_CSRF_HEADER_REQUIRED',
      message: `Missing ${CSRF_HEADER_NAME} header`,
    });
  }
}
