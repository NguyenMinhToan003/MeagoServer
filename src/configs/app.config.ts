import { registerAs } from '@nestjs/config';

export const APP_CONFIG = 'app';

export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  trustProxyHops: number;
  swaggerEnabled: boolean;
}

export default registerAs(APP_CONFIG, (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
  trustProxyHops: parseInt(process.env.TRUST_PROXY_HOPS ?? '0', 10),
  swaggerEnabled:
    process.env.ENABLE_SWAGGER === 'true' ||
    (process.env.ENABLE_SWAGGER === undefined && process.env.NODE_ENV !== 'production'),
}));
