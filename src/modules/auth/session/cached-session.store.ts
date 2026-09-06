import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import authConfig from 'src/configs/auth.config';
import { RedisService } from 'src/libraries/redis/redis.service';
import { AuthSessionRecord, AuthSessionStore } from 'src/common/auth/session-store.port';
import { PostgresSessionStore } from './postgres-session.store';

const SESSION_KEY_PREFIX = 'auth:sess:';
const sessionKey = (id: string) => SESSION_KEY_PREFIX + id;
const subjectSetKey = (subjectId: string) => `auth:user:${subjectId}:sessions`;

type CachedRecord = Omit<
  AuthSessionRecord,
  'createdAt' | 'expiresAt' | 'absoluteExpiresAt' | 'lastSeenAt' | 'revokedAt'
> & {
  createdAt: string;
  expiresAt: string;
  absoluteExpiresAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
};

/**
 * Read-through cache bọc PostgresSessionStore. Giao thức cache-aside:
 * - Đường đọc là nơi duy nhất SET, luôn kèm TTL (min của idle còn lại và trần cấu hình).
 * - Mọi đường ghi: Postgres commit trước, sau đó chỉ DEL — không SET, để không đè giá trị
 *   mới bằng giá trị cũ khi có request đọc song song.
 * - Redis lỗi → RedisService trả null/no-op → luồng rơi về Postgres, không 503.
 * - Set `auth:user:{subjectId}:sessions` chỉ để DEL đúng key khi revokeAll.
 */
@Injectable()
export class CachedSessionStore implements AuthSessionStore {
  constructor(
    private readonly inner: PostgresSessionStore,
    private readonly redis: RedisService,
    @Inject(authConfig.KEY) private readonly conf: ConfigType<typeof authConfig>,
  ) {}

  async create(session: AuthSessionRecord): Promise<void> {
    await this.inner.create(session);
    await this.redis.sadd(subjectSetKey(session.subjectId), session.id);
  }

  async findById(id: string): Promise<AuthSessionRecord | null> {
    const cached = await this.redis.getJson<CachedRecord>(sessionKey(id));
    if (cached) return this.revive(cached);

    const record = await this.inner.findById(id);
    if (record && record.revokedAt === null) {
      const ttlMs = Math.min(
        record.expiresAt.getTime() - Date.now(),
        this.conf.sessionCacheTtlSeconds * 1000,
      );
      if (ttlMs > 0) await this.redis.setJson(sessionKey(id), record, ttlMs);
    }
    return record;
  }

  async touch(id: string, lastSeenAt: Date, expiresAt: Date): Promise<boolean> {
    const touched = await this.inner.touch(id, lastSeenAt, expiresAt);
    if (touched) await this.redis.del(sessionKey(id));
    return touched;
  }

  async rotate(currentId: string, successor: AuthSessionRecord): Promise<boolean> {
    const rotated = await this.inner.rotate(currentId, successor);
    if (rotated) {
      await this.redis.del(sessionKey(currentId));
      await this.redis.sadd(subjectSetKey(successor.subjectId), successor.id);
    }
    return rotated;
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await this.inner.revoke(id, revokedAt);
    await this.redis.del(sessionKey(id));
  }

  async revokeAll(subjectId: string, revokedAt: Date): Promise<void> {
    await this.inner.revokeAll(subjectId, revokedAt);
    const setKey = subjectSetKey(subjectId);
    const ids = await this.redis.smembers(setKey);
    await this.redis.del(...ids.map(sessionKey), setKey);
  }

  private revive(cached: CachedRecord): AuthSessionRecord {
    return {
      ...cached,
      createdAt: new Date(cached.createdAt),
      expiresAt: new Date(cached.expiresAt),
      absoluteExpiresAt: new Date(cached.absoluteExpiresAt),
      lastSeenAt: new Date(cached.lastSeenAt),
      revokedAt: cached.revokedAt ? new Date(cached.revokedAt) : null,
    };
  }
}
