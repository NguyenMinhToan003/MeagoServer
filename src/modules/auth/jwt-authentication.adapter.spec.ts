import { JwtAuthenticationAdapter } from './jwt-authentication.adapter';

describe('JwtAuthenticationAdapter', () => {
  const verifyAsync = jest.fn();
  const adapter = new JwtAuthenticationAdapter(
    { verifyAsync } as never,
    { accessSecret: 'test-secret', issuer: 'meago-server', audience: 'meago-client' } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('maps a JWT payload to AuthPrincipal', async () => {
    verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
      jti: 'token-1',
      email: 'a@meago.test',
    });

    await expect(adapter.authenticate({ kind: 'bearer', token: 'token' }, {})).resolves.toEqual({
      subjectId: 'user-1',
      sessionId: 'session-1',
      email: 'a@meago.test',
    });
  });

  it('rejects tokens missing required session/token identifiers', async () => {
    verifyAsync.mockResolvedValue({ sub: 'user-1' });
    await expect(adapter.authenticate({ kind: 'bearer', token: 'legacy' }, {})).resolves.toBeNull();
  });

  it('rejects unsupported credentials without verifying JWT', async () => {
    await expect(
      adapter.authenticate({ kind: 'session', sessionId: 'session-1' }, {}),
    ).resolves.toBeNull();
    expect(verifyAsync).not.toHaveBeenCalled();
  });

  it('returns null when verification fails', async () => {
    verifyAsync.mockRejectedValue(new Error('invalid'));
    await expect(
      adapter.authenticate({ kind: 'bearer', token: 'invalid' }, {}),
    ).resolves.toBeNull();
  });
});
