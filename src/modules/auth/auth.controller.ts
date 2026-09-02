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
import { ConfigType } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import authConfig from 'src/configs/auth.config';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthPrincipal } from '@meago/core';
import { AuthService, ITokenPair } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { UsersService } from 'src/modules/users/users.service';
import { RbacService } from 'src/modules/rbac/rbac.service';
import { Throttle } from '@nestjs/throttler';
import { AuditAction } from 'src/modules/audit/audit-action.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly rbacService: RbacService,
    @Inject(authConfig.KEY) private readonly conf: ConfigType<typeof authConfig>,
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
    const pair = await this.authService.login(dto.email, dto.password, this.clientMeta(req));
    this.attachAuditPrincipal(req, pair);
    this.setRefreshCookie(res, pair);
    return { accessToken: pair.accessToken };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  @AuditAction({ action: 'auth.refresh', resourceType: 'session' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[this.conf.refreshCookieName] as string | undefined;
    if (!raw) throw new UnauthorizedException('Missing refresh token');
    const pair = await this.authService.refresh(raw, this.clientMeta(req));
    this.attachAuditPrincipal(req, pair);
    this.setRefreshCookie(res, pair);
    return { accessToken: pair.accessToken };
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  @AuditAction({ action: 'auth.logout', resourceType: 'session' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[this.conf.refreshCookieName] as string | undefined;
    if (raw) await this.authService.logout(raw);
    this.clearRefreshCookie(res);
    return { success: true };
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('logout-all')
  @AuditAction({ action: 'auth.logout_all', resourceType: 'session' })
  async logoutAll(@CurrentUser() user: AuthPrincipal, @Res({ passthrough: true }) res: Response) {
    await this.authService.logoutAllDevices(user.subjectId);
    this.clearRefreshCookie(res);
    return { success: true };
  }

  @ApiBearerAuth()
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

  private clientMeta(req: Request) {
    return { deviceInfo: req.headers['user-agent'], ip: req.ip };
  }

  private attachAuditPrincipal(req: Request, pair: ITokenPair) {
    (req as Request & { user?: AuthPrincipal }).user = {
      subjectId: pair.userId,
      sessionId: pair.sessionId,
    };
  }

  private setRefreshCookie(res: Response, pair: ITokenPair) {
    res.cookie(this.conf.refreshCookieName, pair.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth', // chỉ gửi cho refresh/logout
      expires: pair.refreshExpiresAt,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(this.conf.refreshCookieName, { path: '/api/v1/auth' });
  }
}
