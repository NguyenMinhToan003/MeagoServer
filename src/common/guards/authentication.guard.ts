import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import type { AuthPrincipal } from '@meago/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AUTHENTICATION_PORT, AuthenticationPort } from '../auth/authentication.port';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(AUTHENTICATION_PORT) private readonly authentication: AuthenticationPort,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthPrincipal }>();
    const token = this.extractBearerToken(request);
    if (!token) throw new UnauthorizedException('Missing access token');

    const principal = await this.authentication.authenticate(
      { kind: 'bearer', token },
      { ip: request.ip, userAgent: request.headers['user-agent'] },
    );
    if (!principal) throw new UnauthorizedException('Invalid or expired access token');
    request.user = principal;
    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
