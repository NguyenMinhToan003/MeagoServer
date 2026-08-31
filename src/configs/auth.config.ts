import { registerAs } from '@nestjs/config';

export const AUTH_CONFIG = 'auth';

export interface AuthConfig {
  accessSecret: string;
  accessTtl: string;
  issuer: string;
  audience: string;
  refreshTtlDays: number;
  refreshRaceGraceSeconds: number;
  refreshCookieName: string;
  permissionCacheTtlMs: number;
}

export default registerAs(AUTH_CONFIG, (): AuthConfig => ({
  accessSecret: process.env.JWT_ACCESS_SECRET!,
  accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  issuer: process.env.JWT_ISSUER ?? 'meago-server',
  audience: process.env.JWT_AUDIENCE ?? 'meago-client',
  refreshTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS ?? '14', 10),
  refreshRaceGraceSeconds: parseInt(process.env.REFRESH_RACE_GRACE_SECONDS ?? '5', 10),
  refreshCookieName: process.env.REFRESH_COOKIE_NAME ?? 'meago_rt',
  permissionCacheTtlMs: parseInt(process.env.PERMISSION_CACHE_TTL_MS ?? '300000', 10),
}));
