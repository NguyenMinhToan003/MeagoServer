import { UnauthorizedException } from '@nestjs/common';
import { AuthenticationGuard } from './authentication.guard';
import { JwtHttpTransport } from 'src/modules/auth/jwt-http.transport';
import { SessionHttpTransport } from 'src/modules/auth/session/session-http.transport';

describe('AuthenticationGuard', () => {
  const authenticate = jest.fn();
  const getAllAndOverride = jest.fn();
  const conf = { jwtRefreshCookieName: 'meago_rt', sessionCookieName: 'meago_sid' } as never;
  const jwtGuard = new AuthenticationGuard(
    { authenticate },
    { getAllAndOverride } as never,
    new JwtHttpTransport(conf),
  );
  const sessionGuard = new AuthenticationGuard(
    { authenticate },
    { getAllAndOverride } as never,
    new SessionHttpTransport(conf),
  );

  beforeEach(() => jest.clearAllMocks());

  function context(authorization?: string, cookies?: Record<string, string>) {
    const request = {
      headers: { authorization, 'user-agent': 'jest' },
      cookies,
      ip: '127.0.0.1',
    };
    return {
      request,
      value: {
        getHandler: () => 'handler',
        getClass: () => 'class',
        switchToHttp: () => ({ getRequest: () => request }),
      } as never,
    };
  }

  it('allows explicitly public routes without authentication', async () => {
    getAllAndOverride.mockReturnValue(true);
    const { value } = context();
    await expect(jwtGuard.canActivate(value)).resolves.toBe(true);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('rejects a protected route without bearer token', async () => {
    getAllAndOverride.mockReturnValue(false);
    const { value } = context();
    await expect(jwtGuard.canActivate(value)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches the authenticated principal to the request', async () => {
    getAllAndOverride.mockReturnValue(false);
    const principal = { subjectId: 'user-1', sessionId: 'session-1' };
    authenticate.mockResolvedValue(principal);
    const { request, value } = context('Bearer access-token');

    await expect(jwtGuard.canActivate(value)).resolves.toBe(true);
    expect(request).toHaveProperty('user', principal);
    expect(authenticate).toHaveBeenCalledWith(
      { kind: 'bearer', token: 'access-token' },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );
  });

  it('rejects invalid credentials returned by the adapter', async () => {
    getAllAndOverride.mockReturnValue(false);
    authenticate.mockResolvedValue(null);
    const { value } = context('Bearer invalid');
    await expect(jwtGuard.canActivate(value)).rejects.toThrow('Invalid or expired access token');
  });

  it('reads the session cookie and ignores bearer headers in session mode', async () => {
    getAllAndOverride.mockReturnValue(false);
    const principal = { subjectId: 'user-1', sessionId: 'hash-1' };
    authenticate.mockResolvedValue(principal);
    const { request, value } = context('Bearer should-be-ignored', { meago_sid: 'raw-sid' });

    await expect(sessionGuard.canActivate(value)).resolves.toBe(true);
    expect(request).toHaveProperty('user', principal);
    expect(authenticate).toHaveBeenCalledWith(
      { kind: 'session', sessionId: 'raw-sid' },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );
  });

  it('rejects session mode requests that only carry a bearer token', async () => {
    getAllAndOverride.mockReturnValue(false);
    const { value } = context('Bearer access-token');
    await expect(sessionGuard.canActivate(value)).rejects.toThrow('Missing session');
    expect(authenticate).not.toHaveBeenCalled();
  });
});
