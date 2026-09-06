import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { Response } from 'express';
import type { AuthCredential, AuthResult } from '@meago/core';
import authConfig from 'src/configs/auth.config';
import { AuthHttpTransport, CookieRequest } from 'src/common/auth/auth-http-transport.port';

/** Mọi request đều cần session nên cookie đi kèm toàn bộ API. */
const SESSION_COOKIE_PATH = '/';

/**
 * Session mode: một cookie HttpOnly duy nhất mang opaque session ID, dùng cho cả
 * request thường lẫn refresh/logout. Vì trình duyệt tự gửi cookie nên CsrfGuard bắt buộc.
 */
@Injectable()
export class SessionHttpTransport implements AuthHttpTransport {
  readonly messages = {
    missingRequestCredential: 'Missing session',
    invalidRequestCredential: 'Invalid or expired session',
    missingRenewCredential: 'Missing session',
  };

  constructor(@Inject(authConfig.KEY) private readonly conf: ConfigType<typeof authConfig>) {}

  readRequestCredential(request: CookieRequest): AuthCredential | undefined {
    const sessionId = request.cookies?.[this.conf.sessionCookieName];
    return typeof sessionId === 'string' && sessionId ? { kind: 'session', sessionId } : undefined;
  }

  readRenewCredential(request: CookieRequest): AuthCredential | undefined {
    return this.readRequestCredential(request);
  }

  apply(response: Response, result: AuthResult): Record<string, unknown> {
    if (result.mode !== 'session') {
      throw new Error('SessionHttpTransport received a non-session AuthResult');
    }
    response.cookie(this.conf.sessionCookieName, result.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: SESSION_COOKIE_PATH,
      // Cookie sống tới absolute; idle do server quyết định, không phụ thuộc cookie expiry.
      expires: result.expiresAt,
    });
    return { expiresAt: result.expiresAt };
  }

  clear(response: Response): void {
    response.clearCookie(this.conf.sessionCookieName, { path: SESSION_COOKIE_PATH });
  }
}
