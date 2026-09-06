import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApplication } from '../src/app.setup';

/** Biến hệ thống ưu tiên hơn .env.test nên set trước khi ConfigModule load. */
export async function bootstrapApp(authMode: 'jwt' | 'session'): Promise<INestApplication<App>> {
  process.env.AUTH_MODE = authMode;
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureHttpApplication(app);
  await app.init();
  return app;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@meago.test`;
}

/** Lấy giá trị cookie `name` từ header Set-Cookie của response supertest. */
export function readCookie(setCookie: string | string[] | undefined, name: string): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const match = list.map((c) => /^([^=]+)=([^;]*)/.exec(c)).find((m) => m?.[1] === name);
  if (!match) throw new Error(`Cookie ${name} not set`);
  return match[2];
}
