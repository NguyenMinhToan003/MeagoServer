import { Controller, Get, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorFunction,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { AuthMode } from '@meago/core';
import authConfig from 'src/configs/auth.config';
import { Public } from 'src/common/decorators/public.decorator';
import { RedisHealthIndicator } from './redis.health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    @Inject(authConfig.KEY) private readonly conf: ConfigType<typeof authConfig>,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check(this.readinessChecks());
  }

  @Public()
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check(this.readinessChecks());
  }

  /** Redis là cache fail-open ở JWT mode; ở session mode nó nằm trên hot path xác thực. */
  private readinessChecks(): HealthIndicatorFunction[] {
    const checks: HealthIndicatorFunction[] = [() => this.db.pingCheck('database')];
    if (this.conf.mode === AuthMode.SESSION) checks.push(() => this.redis.isHealthy('redis'));
    return checks;
  }
}
