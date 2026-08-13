import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// cùng quy ước với ConfigModule: .env.<NODE_ENV> trước, fallback .env
dotenv.config({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });
dotenv.config({ path: '.env' });

/**
 * DataSource chuẩn cho TypeORM CLI (migration) — synchronize luôn false ở đây.
 * Dùng: npm run migration:generate / migration:run / migration:revert
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  synchronize: false,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
});
