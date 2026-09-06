import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { AuthContext, AuthCredential, AuthPrincipal } from '@meago/core';
import authConfig from 'src/configs/auth.config';
import { AuthenticationPort } from 'src/common/auth/authentication.port';
import { AuthSessionStore, SESSION_STORE } from 'src/common/auth/session-store.port';
import { hashSessionId, isSessionLive, nextIdleExpiry } from './session-id';

/**
 * Xác thực mỗi request ở session mode: 1 lần tra store (Redis hit, miss → Postgres),
 * không query user. Touch trượt idle expiry nhưng được throttle để không ghi mỗi request.
 */
@Injectable()
export class SessionAuthenticationAdapter implements AuthenticationPort {
  private readonly logger = new Logger(SessionAuthenticationAdapter.name);

  constructor(
    @Inject(SESSION_STORE) private readonly store: AuthSessionStore,
    @Inject(authConfig.KEY) private readonly conf: ConfigType<typeof authConfig>,
  ) {}

  async authenticate(
    credential: AuthCredential,
    context: AuthContext,
  ): Promise<AuthPrincipal | null> {
    void context;
    if (credential.kind !== 'session') return null;

    const id = hashSessionId(credential.sessionId);
    const record = await this.store.findById(id);
    const now = new Date();
    if (!record || !isSessionLive(record, now)) return null;

    if (
      now.getTime() - record.lastSeenAt.getTime() >=
      this.conf.sessionTouchIntervalSeconds * 1000
    ) {
      const expiresAt = nextIdleExpiry(
        now,
        this.conf.sessionIdleTtlMinutes * 60_000,
        record.absoluteExpiresAt,
      );
      // Fire-and-forget: touch thất bại chỉ làm session hết hạn sớm hơn, không sai dữ liệu.
      void this.store.touch(id, now, expiresAt).catch((err: Error) => {
        this.logger.warn(`session touch failed: ${err.message}`);
      });
    }

    return { subjectId: record.subjectId, sessionId: id, email: record.data?.email };
  }
}
