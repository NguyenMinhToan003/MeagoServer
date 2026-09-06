import { CachedSessionStore } from './cached-session.store';

describe('CachedSessionStore', () => {
  const now = Date.now();
  const record = {
    id: 'hash-1',
    subjectId: 'user-1',
    createdAt: new Date(now),
    expiresAt: new Date(now + 30 * 60_000),
    absoluteExpiresAt: new Date(now + 14 * 86_400_000),
    lastSeenAt: new Date(now),
    revokedAt: null,
    data: { email: 'a@meago.test' },
  };
  const inner = {
    create: jest.fn(),
    findById: jest.fn(),
    touch: jest.fn(),
    rotate: jest.fn(),
    revoke: jest.fn(),
    revokeAll: jest.fn(),
  };
  const redis = {
    getJson: jest.fn(),
    setJson: jest.fn(),
    del: jest.fn(),
    sadd: jest.fn(),
    smembers: jest.fn(),
  };
  const store = new CachedSessionStore(
    inner as never,
    redis as never,
    { sessionCacheTtlSeconds: 300 } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('serves a cache hit without touching the database and revives dates', async () => {
    redis.getJson.mockResolvedValue(JSON.parse(JSON.stringify(record)));

    const found = await store.findById('hash-1');

    expect(inner.findById).not.toHaveBeenCalled();
    expect(found?.expiresAt).toBeInstanceOf(Date);
    expect(found?.revokedAt).toBeNull();
  });

  it('populates the cache on a miss with a TTL capped by configuration', async () => {
    redis.getJson.mockResolvedValue(null);
    inner.findById.mockResolvedValue(record);

    await store.findById('hash-1');

    expect(redis.setJson).toHaveBeenCalledWith('auth:sess:hash-1', record, 300_000);
  });

  it('never caches revoked or missing sessions', async () => {
    redis.getJson.mockResolvedValue(null);
    inner.findById.mockResolvedValueOnce({ ...record, revokedAt: new Date() });
    await store.findById('hash-1');
    inner.findById.mockResolvedValueOnce(null);
    await store.findById('missing');

    expect(redis.setJson).not.toHaveBeenCalled();
  });

  it('writes to the database first and only deletes cache keys on mutation', async () => {
    inner.touch.mockResolvedValue(true);
    inner.rotate.mockResolvedValue(true);

    await store.touch('hash-1', new Date(), new Date());
    await store.revoke('hash-1', new Date());
    await store.rotate('hash-1', { ...record, id: 'hash-2' });

    expect(redis.setJson).not.toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith('auth:sess:hash-1');
    expect(redis.sadd).toHaveBeenCalledWith('auth:user:user-1:sessions', 'hash-2');
  });

  it('does not invalidate when the database rejected the rotation', async () => {
    inner.rotate.mockResolvedValue(false);
    await expect(store.rotate('hash-1', { ...record, id: 'hash-2' })).resolves.toBe(false);
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('revokes every cached session of a subject through the subject index', async () => {
    redis.smembers.mockResolvedValue(['hash-1', 'hash-2']);

    await store.revokeAll('user-1', new Date());

    expect(inner.revokeAll).toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith(
      'auth:sess:hash-1',
      'auth:sess:hash-2',
      'auth:user:user-1:sessions',
    );
  });
});
