import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const DATABASE_CONFIG = 'database';

export default registerAs(
  DATABASE_CONFIG,
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    // chỉ bật ở local dev; prod luôn false + migration
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    autoLoadEntities: true,
    logging: ['error'],
    maxQueryExecutionTime: 30000,
    extra: {
      max: 25,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 300000,
      application_name: 'meago',
    },
    retryAttempts: 3,
    retryDelay: 3000,
  }),
);
