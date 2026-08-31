import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureHttpApplication } from './../src/app.setup';

describe('AppModule (e2e)', () => {
  let app: INestApplication<App> | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureHttpApplication(app as NestExpressApplication);
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('/api/v1/health/ready (GET) reports the production-style readiness route', () => {
    if (!app) throw new Error('Application failed to initialize');
    return request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
  });
});
