import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import appConfig from './configs/app.config';
import databaseConfig, { DATABASE_CONFIG } from './configs/database.config';
import authConfig from './configs/auth.config';
import redisConfig from './configs/redis.config';
import { envValidationSchema } from './configs/env.validation';
import {
  HttpExceptionFilter,
  TypeOrmExceptionFilter,
} from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { createLoggerConfig } from './configs/logger.config';
import { AuthenticationGuard } from './common/guards/authentication.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RedisModule } from './libraries/redis/redis.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      load: [appConfig, databaseConfig, authConfig, redisConfig],
      validationSchema: envValidationSchema,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createLoggerConfig(configService.get<string>('NODE_ENV') ?? 'development'),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => cs.get(DATABASE_CONFIG)!,
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    RedisModule,
    RbacModule,
    UsersModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // thứ tự quan trọng: auth trước, permission sau
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Fallback catch-all; typed Meago filters below keep their own response envelope.
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_FILTER, useClass: TypeOrmExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
