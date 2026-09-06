import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type {
  AuthContext,
  AuthCredential,
  AuthIdentity,
  AuthPrincipal,
  AuthResult,
} from '@meago/core';
import authConfig from 'src/configs/auth.config';
import { AuthStrategy } from 'src/common/auth/auth-strategy.port';
import {
  AuthSessionRecord,
  AuthSessionStore,
  SESSION_STORE,
} from 'src/common/auth/session-store.port';
import { SessionAuthenticationAdapter } from './session-authentication.adapter';
import { generateSessionId, hashSessionId, isSessionLive, nextIdleExpiry } from './session-id';

/**
 * Stateful session: cookie chỉ mang opaque ID; principal, expiry và revoke state nằm trong store.
 * `renew` = rotate ID (giữ absolute expiry) — dùng sau khi đổi quyền theo khuyến nghị OWASP.
 */
@Injectable()
export class SessionAuthStrategy implements AuthStrategy {
  constructor(
    @Inject(SESSION_STORE) private readonly store: AuthSessionStore,
    private readonly authentication: SessionAuthenticationAdapter,
    @Inject(authConfig.KEY) private readonly conf: ConfigType<typeof authConfig>,
  ) {}

  authenticate(credential: AuthCredential, context: AuthContext): Promise<AuthPrincipal | null> {
    return this.authentication.authenticate(credential, context);
  }

  async signIn(identity: AuthIdentity, context: AuthContext): Promise<AuthResult> {
    const now = new Date();
    const absoluteExpiresAt = new Date(
      now.getTime() + this.conf.sessionAbsoluteTtlDays * 86_400_000,
    );
    const { raw, record } = this.newRecord(identity.subjectId, now, absoluteExpiresAt, context, {
      email: identity.email,
    });
    await this.store.create(record);
    return this.toResult(raw, record);
  }

  async renew(credential: AuthCredential, context: AuthContext): Promise<AuthResult> {
    if (credential.kind !== 'session') throw new UnauthorizedException('Missing session');
    const currentId = hashSessionId(credential.sessionId);
    const current = await this.store.findById(currentId);
    const now = new Date();
    if (!current || !isSessionLive(current, now)) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const { raw, record } = this.newRecord(
      current.subjectId,
      now,
      current.absoluteExpiresAt,
      context,
      current.data,
    );
    const rotated = await this.store.rotate(currentId, record);
    if (!rotated) throw new UnauthorizedException('Session already rotated');
    return this.toResult(raw, record);
  }

  async signOut(credential: AuthCredential, context: AuthContext): Promise<void> {
    void context;
    if (credential.kind !== 'session') return;
    await this.store.revoke(hashSessionId(credential.sessionId), new Date());
  }

  async revokeAll(subjectId: string): Promise<void> {
    await this.store.revokeAll(subjectId, new Date());
  }

  private newRecord(
    subjectId: string,
    now: Date,
    absoluteExpiresAt: Date,
    context: AuthContext,
    data: AuthSessionRecord['data'],
  ): { raw: string; record: AuthSessionRecord } {
    const raw = generateSessionId();
    return {
      raw,
      record: {
        id: hashSessionId(raw),
        subjectId,
        createdAt: now,
        expiresAt: nextIdleExpiry(now, this.conf.sessionIdleTtlMinutes * 60_000, absoluteExpiresAt),
        absoluteExpiresAt,
        lastSeenAt: now,
        revokedAt: null,
        context: { ip: context.ip, userAgent: context.userAgent },
        data,
      },
    };
  }

  private toResult(raw: string, record: AuthSessionRecord): AuthResult {
    return {
      mode: 'session',
      principal: { subjectId: record.subjectId, sessionId: record.id, email: record.data?.email },
      sessionId: raw,
      // Cookie sống tới absolute; idle do server quyết định, không phụ thuộc cookie expiry.
      expiresAt: record.absoluteExpiresAt,
    };
  }
}
