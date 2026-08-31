import 'reflect-metadata';
import '../configs/bootstrap-environment';
import { DataSource } from 'typeorm';
import { join } from 'node:path';

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
  entities: [join(__dirname, '..', '**', '*.entity.{js,ts}')],
  migrations: [join(__dirname, 'migrations', '*.{js,ts}')],
});
