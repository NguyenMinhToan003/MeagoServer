import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { Response } from 'express';
import type { AuthCredential, AuthResult, ITokenResponse } from '@meago/core';
import authConfig from 'src/configs/auth.config';
import { AuthHttpTransport, CookieRequest } from 'src/common/auth/auth-http-transport.port';

/** Chỉ gửi cookie cho refresh/logout, không kèm theo request thường. */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

/**
 * JWT mode: access token trong `Authorization: Bearer`, refresh token trong cookie HttpOnly
 * giới hạn path auth. Bearer header do JS tự gắn nên miễn nhiễm CSRF.
 */
@Injectable()
export class JwtHttpTransport implements AuthHttpTransport {
  readonly messages = {
    missingRequestCredential: 'Missing access token',
    invalidRequestCredential: 'Invalid or expired access token',
    missingRenewCredential: 'Missing refresh token',
  };

  constructor(@Inject(authConfig.KEY) private readonly conf: ConfigType<typeof authConfig>) {}

  readRequestCredential(request: CookieRequest): AuthCredential | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? { kind: 'bearer', token } : undefined;
  }

  readRenewCredential(request: CookieRequest): AuthCredential | undefined {
    const token = request.cookies?.[this.conf.jwtRefreshCookieName];
    return typeof token === 'string' && token ? { kind: 'refresh', token } : undefined;
  }

  apply(response: Response, result: AuthResult): Record<string, unknown> {
    if (result.mode !== 'jwt') throw new Error('JwtHttpTransport received a non-jwt AuthResult');
    if (result.refreshToken && result.refreshExpiresAt) {
      response.cookie(this.conf.jwtRefreshCookieName, result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: REFRESH_COOKIE_PATH,
        expires: result.refreshExpiresAt,
      });
    }
    // Đúng contract ITokenResponse của @meago/core: expiresIn tính bằng giây.
    const body: ITokenResponse = {
      accessToken: result.accessToken,
      expiresIn: Math.max(0, Math.floor((result.accessExpiresAt.getTime() - Date.now()) / 1000)),
    };
    return { ...body };
  }

  clear(response: Response): void {
    response.clearCookie(this.conf.jwtRefreshCookieName, { path: REFRESH_COOKIE_PATH });
  }
}
