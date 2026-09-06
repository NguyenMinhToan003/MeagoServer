import { ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

describe('CsrfGuard', () => {
  const sessionGuard = new CsrfGuard({ mode: 'session' } as never);
  const jwtGuard = new CsrfGuard({ mode: 'jwt' } as never);

  function context(method: string, headers: Record<string, string> = {}) {
    return {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
    } as never;
  }

  it('is a no-op in jwt mode', () => {
    expect(jwtGuard.canActivate(context('POST'))).toBe(true);
  });

  it('allows safe methods without the header', () => {
    expect(sessionGuard.canActivate(context('GET'))).toBe(true);
    expect(sessionGuard.canActivate(context('HEAD'))).toBe(true);
    expect(sessionGuard.canActivate(context('OPTIONS'))).toBe(true);
  });

  it('allows unsafe methods carrying the fixed header', () => {
    expect(
      sessionGuard.canActivate(context('POST', { 'x-requested-with': 'XMLHttpRequest' })),
    ).toBe(true);
  });

  it('rejects unsafe methods without the header using a stable code', () => {
    expect(() => sessionGuard.canActivate(context('DELETE'))).toThrow(ForbiddenException);
    try {
      sessionGuard.canActivate(context('POST'));
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({ code: 'AUTH_CSRF_HEADER_REQUIRED' }),
      );
    }
  });
});
