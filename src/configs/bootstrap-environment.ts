import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';

dotenv.config({
  path: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
  quiet: true,
});

const fileBackedSecrets = [
  'DB_PASSWORD',
  'JWT_ACCESS_SECRET',
  'REDIS_PASSWORD',
  'SENTRY_DSN',
] as const;

for (const name of fileBackedSecrets) {
  const file = process.env[`${name}_FILE`];
  if (!process.env[name] && file) {
    process.env[name] = readFileSync(file, 'utf8').trim();
  }
}
