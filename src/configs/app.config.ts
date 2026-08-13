import { registerAs } from '@nestjs/config';

export const APP_CONFIG = 'app';

export default registerAs(APP_CONFIG, () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
}));
