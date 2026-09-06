import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { RedisService } from 'src/libraries/redis/redis.service';

/** Chỉ đưa vào readiness khi Redis là dependency bắt buộc (AUTH_MODE=session). */
@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly redis: RedisService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const reply = await this.redis.client.ping();
      return reply === 'PONG' ? indicator.up() : indicator.down({ reply });
    } catch (err) {
      return indicator.down({ message: (err as Error).message });
    }
  }
}
