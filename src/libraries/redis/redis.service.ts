import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import redisConfig from 'src/configs/redis.config';

/**
 * Wrapper ioredis dùng chung: JSON get/set TTL, delete theo prefix.
 * Cache là optional infra — Redis chết thì app vẫn chạy (fail-open, chỉ log).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(@Inject(redisConfig.KEY) conf: ConfigType<typeof redisConfig>) {
    this.client = new Redis({
      host: conf.host,
      port: conf.port,
      password: conf.password,
      db: conf.db,
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => Math.min(times * 1000, 15000),
    });
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      this.logger.warn(`getJson(${key}) failed: ${(err as Error).message}`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlMs?: number): Promise<void> {
    try {
      const raw = JSON.stringify(value);
      if (ttlMs) await this.client.set(key, raw, 'PX', ttlMs);
      else await this.client.set(key, raw);
    } catch (err) {
      this.logger.warn(`setJson(${key}) failed: ${(err as Error).message}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length) await this.client.del(...keys);
    } catch (err) {
      this.logger.warn(`del failed: ${(err as Error).message}`);
    }
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    try {
      if (members.length) await this.client.sadd(key, ...members);
    } catch (err) {
      this.logger.warn(`sadd(${key}) failed: ${(err as Error).message}`);
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (err) {
      this.logger.warn(`smembers(${key}) failed: ${(err as Error).message}`);
      return [];
    }
  }

  /** Xóa mọi key theo prefix (SCAN, không block Redis như KEYS). */
  async delByPrefix(prefix: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
        cursor = next;
        if (keys.length) await this.client.del(...keys);
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(`delByPrefix(${prefix}) failed: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    // quit() là một command: khi chưa kết nối nó nằm trong offline queue vô thời hạn
    // và chặn app.close(). Chỉ quit khi đang ready, còn lại disconnect thẳng.
    if (this.client.status !== 'ready') {
      this.client.disconnect();
      return;
    }
    await this.client.quit().catch(() => this.client.disconnect());
  }
}
