import { UnauthorizedException } from '@nestjs/common';
import { AuthenticationGuard } from './authentication.guard';

describe('AuthenticationGuard', () => {
  const authenticate = jest.fn();
  const getAllAndOverride = jest.fn();
  const guard = new AuthenticationGuard({ authenticate }, { getAllAndOverride } as never);

  beforeEach(() => jest.clearAllMocks());

  function context(authorization?: string) {
    const request = {
      headers: { authorization, 'user-agent': 'jest' },
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
    await expect(guard.canActivate(value)).resolves.toBe(true);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('rejects a protected route without bearer token', async () => {
    getAllAndOverride.mockReturnValue(false);
    const { value } = context();
    await expect(guard.canActivate(value)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches the authenticated principal to the request', async () => {
    getAllAndOverride.mockReturnValue(false);
    const principal = { subjectId: 'user-1', sessionId: 'session-1' };
    authenticate.mockResolvedValue(principal);
    const { request, value } = context('Bearer access-token');

    await expect(guard.canActivate(value)).resolves.toBe(true);
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
    await expect(guard.canActivate(value)).rejects.toThrow('Invalid or expired access token');
  });
});
