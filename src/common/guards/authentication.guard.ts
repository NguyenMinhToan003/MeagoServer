import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthPrincipal } from '@meago/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AUTHENTICATION_PORT, AuthenticationPort } from '../auth/authentication.port';
import {
  AUTH_HTTP_TRANSPORT,
  AuthHttpTransport,
  CookieRequest,
  singleHeader,
} from '../auth/auth-http-transport.port';

type AuthenticatedRequest = CookieRequest & { user?: AuthPrincipal };

/**
 * Không biết JWT hay session: transport của mode đang chạy quyết định credential
 * nằm ở đâu, adapter của mode đó quyết định credential có hợp lệ không.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(AUTHENTICATION_PORT) private readonly authentication: AuthenticationPort,
    private readonly reflector: Reflector,
    @Inject(AUTH_HTTP_TRANSPORT) private readonly transport: AuthHttpTransport,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const credential = this.transport.readRequestCredential(request);
    if (!credential) {
      throw new UnauthorizedException(this.transport.messages.missingRequestCredential);
    }

    const principal = await this.authentication.authenticate(credential, {
      ip: request.ip,
      userAgent: singleHeader(request.headers['user-agent']),
    });
    if (!principal) {
      throw new UnauthorizedException(this.transport.messages.invalidRequestCredential);
    }
    request.user = principal;
    return true;
  }
}
