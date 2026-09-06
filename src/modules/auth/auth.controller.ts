import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import type { AuthContext, AuthPrincipal } from '@meago/core';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AUTH_STRATEGY, AuthStrategy } from 'src/common/auth/auth-strategy.port';
import {
  AUTH_HTTP_TRANSPORT,
  AuthHttpTransport,
  CookieRequest,
  singleHeader,
} from 'src/common/auth/auth-http-transport.port';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { UsersService } from 'src/modules/users/users.service';
import { RbacService } from 'src/modules/rbac/rbac.service';
import { Throttle } from '@nestjs/throttler';
import { AuditAction } from 'src/modules/audit/audit-action.decorator';

/**
 * Không biết JWT hay session: AUTH_STRATEGY cấp/gia hạn/thu hồi credential,
 * AUTH_HTTP_TRANSPORT quyết định header/cookie/body. Route giống nhau ở cả hai mode.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly rbacService: RbacService,
    @Inject(AUTH_STRATEGY) private readonly strategy: AuthStrategy,
    @Inject(AUTH_HTTP_TRANSPORT) private readonly transport: AuthHttpTransport,
  ) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  @AuditAction({ action: 'auth.register', resourceType: 'user', resourceIdPath: 'id' })
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto.email, dto.displayName, dto.password);
    return { id: user.id, email: user.email, displayName: user.displayName };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  @AuditAction({ action: 'auth.login', resourceType: 'user' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.authenticateCredentials(dto.email, dto.password);
    const result = await this.strategy.signIn(
      { subjectId: user.id, email: user.email },
      this.authContext(req),
    );
    this.attachAuditPrincipal(req, result.principal);
    return this.transport.apply(res, result);
  }

  /** JWT: rotate refresh token. Session: rotate session ID (giữ absolute expiry). */
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  @AuditAction({ action: 'auth.refresh', resourceType: 'session' })
  async refresh(@Req() req: CookieRequest, @Res({ passthrough: true }) res: Response) {
    const credential = this.transport.readRenewCredential(req);
    if (!credential) {
      throw new UnauthorizedException(this.transport.messages.missingRenewCredential);
    }
    const result = await this.strategy.renew(credential, this.authContext(req));
    this.attachAuditPrincipal(req, result.principal);
    return this.transport.apply(res, result);
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  @AuditAction({ action: 'auth.logout', resourceType: 'session' })
  async logout(@Req() req: CookieRequest, @Res({ passthrough: true }) res: Response) {
    const credential = this.transport.readRenewCredential(req);
    if (credential) await this.strategy.signOut(credential, this.authContext(req));
    this.transport.clear(res);
    return { success: true };
  }

  @ApiBearerAuth()
  @ApiCookieAuth()
  @HttpCode(200)
  @Post('logout-all')
  @AuditAction({ action: 'auth.logout_all', resourceType: 'session' })
  async logoutAll(@CurrentUser() user: AuthPrincipal, @Res({ passthrough: true }) res: Response) {
    await this.strategy.revokeAll(user.subjectId);
    this.transport.clear(res);
    return { success: true };
  }

  @ApiBearerAuth()
  @ApiCookieAuth()
  @Get('me')
  async me(@CurrentUser() user: AuthPrincipal) {
    const found = await this.usersService.findOneByIdOrFail(user.subjectId);
    const permissions = await this.rbacService.getUserPermissions(user.subjectId);
    return {
      id: found.id,
      email: found.email,
      displayName: found.displayName,
      status: found.status,
      permissions: [...permissions],
    };
  }

  private authContext(req: CookieRequest): AuthContext {
    return { ip: req.ip, userAgent: singleHeader(req.headers['user-agent']) };
  }

  /** Route login/refresh là @Public nên guard không gán req.user; gán tay cho audit. */
  private attachAuditPrincipal(req: CookieRequest, principal: AuthPrincipal) {
    (req as CookieRequest & { user?: AuthPrincipal }).user = {
      subjectId: principal.subjectId,
      sessionId: principal.sessionId,
    };
  }
}
