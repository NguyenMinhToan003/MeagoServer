import * as crypto from 'crypto';
import type { AuthSessionRecord } from 'src/common/auth/session-store.port';

/** 256-bit random, vượt xa mức tối thiểu 64-bit entropy của OWASP. */
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Store chỉ giữ hash — dump Redis/Postgres không dùng được làm credential. */
export function hashSessionId(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Session còn dùng được: chưa revoke, chưa quá idle và chưa quá absolute. */
export function isSessionLive(record: AuthSessionRecord, now: Date): boolean {
  return (
    record.revokedAt === null &&
    record.expiresAt.getTime() > now.getTime() &&
    record.absoluteExpiresAt.getTime() > now.getTime()
  );
}

/** Idle expiry mới, nhưng không bao giờ vượt absolute. */
export function nextIdleExpiry(now: Date, idleTtlMs: number, absoluteExpiresAt: Date): Date {
  return new Date(Math.min(now.getTime() + idleTtlMs, absoluteExpiresAt.getTime()));
}
