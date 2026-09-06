import { SessionAuthenticationAdapter } from './session-authentication.adapter';
import { hashSessionId } from './session-id';

describe('SessionAuthenticationAdapter', () => {
  const store = { findById: jest.fn(), touch: jest.fn().mockResolvedValue(true) };
  const adapter = new SessionAuthenticationAdapter(
    store as never,
    {
      sessionIdleTtlMinutes: 30,
      sessionTouchIntervalSeconds: 60,
    } as never,
  );
  const now = Date.now();
  const live = {
    id: hashSessionId('raw-sid'),
    subjectId: 'user-1',
    createdAt: new Date(now - 120_000),
    expiresAt: new Date(now + 60_000),
    absoluteExpiresAt: new Date(now + 86_400_000),
    lastSeenAt: new Date(now - 120_000),
    revokedAt: null,
    data: { email: 'a@meago.test' },
  };

  beforeEach(() => jest.clearAllMocks());

  it('looks the session up by hash and never by the raw cookie value', async () => {
    store.findById.mockResolvedValue(live);

    await expect(
      adapter.authenticate({ kind: 'session', sessionId: 'raw-sid' }, {}),
    ).resolves.toEqual({ subjectId: 'user-1', sessionId: live.id, email: 'a@meago.test' });
    expect(store.findById).toHaveBeenCalledWith(live.id);
    expect(store.findById).not.toHaveBeenCalledWith('raw-sid');
  });

  it('touches a stale session but never past the absolute expiry', async () => {
    store.findById.mockResolvedValue({ ...live, absoluteExpiresAt: new Date(now + 5_000) });

    await adapter.authenticate({ kind: 'session', sessionId: 'raw-sid' }, {});

    const [, , expiresAt] = store.touch.mock.calls[0] as [string, Date, Date];
    expect(expiresAt.getTime()).toBeLessThanOrEqual(now + 5_000);
  });

  it('skips the touch when the session was seen recently', async () => {
    store.findById.mockResolvedValue({ ...live, lastSeenAt: new Date(now - 1_000) });
    await adapter.authenticate({ kind: 'session', sessionId: 'raw-sid' }, {});
    expect(store.touch).not.toHaveBeenCalled();
  });

  it.each([
    ['revoked', { revokedAt: new Date() }],
    ['idle-expired', { expiresAt: new Date(now - 1) }],
    ['absolute-expired', { absoluteExpiresAt: new Date(now - 1) }],
  ])('rejects a %s session', async (_label, patch) => {
    store.findById.mockResolvedValue({ ...live, ...patch });
    await expect(
      adapter.authenticate({ kind: 'session', sessionId: 'raw-sid' }, {}),
    ).resolves.toBeNull();
  });

  it('rejects bearer credentials without hitting the store', async () => {
    await expect(adapter.authenticate({ kind: 'bearer', token: 'jwt' }, {})).resolves.toBeNull();
    expect(store.findById).not.toHaveBeenCalled();
  });
});
