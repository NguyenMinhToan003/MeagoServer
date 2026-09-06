import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { bootstrapApp, readCookie, uniqueEmail } from './auth-flow.e2e-helpers';

const CSRF = ['X-Requested-With', 'XMLHttpRequest'] as const;

describe('Auth flow — AUTH_MODE=session (e2e)', () => {
  let app: INestApplication<App>;
  const email = uniqueEmail('session');
  const password = 'password-123';

  beforeAll(async () => {
    app = await bootstrapApp('session');
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('rejects unsafe requests without the CSRF header, even on public routes', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(403);
    expect(res.body).toEqual(expect.objectContaining({ code: 'AUTH_CSRF_HEADER_REQUIRED' }));
  });

  it('logs in with an opaque HttpOnly cookie and authenticates every request by it', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set(...CSRF)
      .send({ email, displayName: 'Session User', password })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(...CSRF)
      .send({ email, password })
      .expect(200);

    expect(login.body.data).toEqual({ expiresAt: expect.any(String) });
    expect(login.body.data).not.toHaveProperty('accessToken');
    const setCookie = login.headers['set-cookie'] as string | string[] | undefined;
    const sid = readCookie(setCookie, 'meago_sid');
    expect(sid).toMatch(/^[a-f0-9]{64}$/);
    expect(String(setCookie)).toContain('Path=/');
    expect(String(setCookie)).toContain('HttpOnly');

    // Request thường: chỉ cookie, không Bearer.
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `meago_sid=${sid}`)
      .expect(200);
    expect(me.body.data.email).toBe(email);

    // Bearer header bị bỏ qua hoàn toàn ở session mode.
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer anything')
      .expect(401);

    // Rotate session ID: cookie mới hoạt động, cookie cũ chết ngay (cache đã DEL).
    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set(...CSRF)
      .set('Cookie', `meago_sid=${sid}`)
      .expect(200);
    const newSid = readCookie(rotated.headers['set-cookie'], 'meago_sid');
    expect(newSid).not.toBe(sid);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `meago_sid=${sid}`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `meago_sid=${newSid}`)
      .expect(200);

    // Logout revoke tức thì.
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set(...CSRF)
      .set('Cookie', `meago_sid=${newSid}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `meago_sid=${newSid}`)
      .expect(401);
  });
});
