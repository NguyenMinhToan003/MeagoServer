import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/** Global: cache dùng ở guard/service khắp nơi. */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
