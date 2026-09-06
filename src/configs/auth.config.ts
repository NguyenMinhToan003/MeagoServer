import { registerAs } from '@nestjs/config';
import { AuthMode } from '@meago/core';

export const AUTH_CONFIG = 'auth';

export interface AuthConfig {
  /** Chọn đúng một strategy tại composition root: `jwt` hoặc `session`. */
  mode: AuthMode;
  jwtAccessSecret: string;
  jwtAccessTtl: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtRefreshTtlDays: number;
  jwtRefreshRaceGraceSeconds: number;
  jwtRefreshCookieName: string;
  sessionCookieName: string;
  /** Idle timeout — reset mỗi lần touch. */
  sessionIdleTtlMinutes: number;
  /** Absolute timeout — rotate bao nhiêu lần cũng không sống quá mốc này. */
  sessionAbsoluteTtlDays: number;
  /** Chỉ ghi lastSeenAt/expiresAt khi lần touch trước cách đây lâu hơn khoảng này. */
  sessionTouchIntervalSeconds: number;
  /** Trần TTL của bản ghi session trong Redis; giới hạn cửa sổ stale khi DEL thất bại. */
  sessionCacheTtlSeconds: number;
  permissionCacheTtlMs: number;
  transactionLockTimeoutMs: number;
}

export default registerAs(AUTH_CONFIG, (): AuthConfig => ({
  mode: process.env.AUTH_MODE === AuthMode.SESSION ? AuthMode.SESSION : AuthMode.JWT,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET!,
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  jwtIssuer: process.env.JWT_ISSUER ?? 'meago-server',
  jwtAudience: process.env.JWT_AUDIENCE ?? 'meago-client',
  jwtRefreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? '14', 10),
  jwtRefreshRaceGraceSeconds: parseInt(process.env.JWT_REFRESH_RACE_GRACE_SECONDS ?? '5', 10),
  jwtRefreshCookieName: process.env.JWT_REFRESH_COOKIE_NAME ?? 'meago_rt',
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? 'meago_sid',
  sessionIdleTtlMinutes: parseInt(process.env.SESSION_IDLE_TTL_MINUTES ?? '30', 10),
  sessionAbsoluteTtlDays: parseInt(process.env.SESSION_ABSOLUTE_TTL_DAYS ?? '14', 10),
  sessionTouchIntervalSeconds: parseInt(process.env.SESSION_TOUCH_INTERVAL_SECONDS ?? '60', 10),
  sessionCacheTtlSeconds: parseInt(process.env.SESSION_CACHE_TTL_SECONDS ?? '300', 10),
  permissionCacheTtlMs: parseInt(process.env.PERMISSION_CACHE_TTL_MS ?? '300000', 10),
  transactionLockTimeoutMs: parseInt(process.env.AUTH_LOCK_TIMEOUT_MS ?? '5000', 10),
}));
