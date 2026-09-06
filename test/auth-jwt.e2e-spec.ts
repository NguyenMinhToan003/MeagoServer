import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { bootstrapApp, readCookie, uniqueEmail } from './auth-flow.e2e-helpers';

describe('Auth flow — AUTH_MODE=jwt (e2e)', () => {
  let app: INestApplication<App>;
  const email = uniqueEmail('jwt');
  const password = 'password-123';

  beforeAll(async () => {
    app = await bootstrapApp('jwt');
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('logs in with a bearer access token and a path-scoped refresh cookie', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, displayName: 'JWT User', password })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    expect(login.body.data).toEqual(
      expect.objectContaining({ accessToken: expect.any(String), expiresIn: expect.any(Number) }),
    );
    const refreshCookie = login.headers['set-cookie'] as string | string[] | undefined;
    expect(readCookie(refreshCookie, 'meago_rt')).toMatch(/^[a-f0-9]{64}$/);
    expect(String(refreshCookie)).toContain('Path=/api/v1/auth');
    expect(String(refreshCookie)).toContain('HttpOnly');

    const accessToken = login.body.data.accessToken as string;

    // Request thường: chỉ Bearer, không cookie.
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.data.email).toBe(email);

    // Không có Bearer → 401 dù có cookie refresh.
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `meago_rt=${readCookie(refreshCookie, 'meago_rt')}`)
      .expect(401);

    // Rotate refresh token; token cũ dùng lại bị từ chối.
    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `meago_rt=${readCookie(refreshCookie, 'meago_rt')}`)
      .expect(200);
    expect(rotated.body.data.accessToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `meago_rt=${readCookie(refreshCookie, 'meago_rt')}`)
      .expect((res) => expect([401, 409]).toContain(res.status));
  });

  it('does not require a CSRF header in jwt mode', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(200);
  });
});
