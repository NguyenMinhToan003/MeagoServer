import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthMode } from '@meago/core';
import authConfig from 'src/configs/auth.config';
import { UsersModule } from 'src/modules/users/users.module';
import { RefreshSessionEntity } from './refresh-session.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthenticationAdapter } from './jwt-authentication.adapter';
import { JwtAuthStrategy } from './jwt-auth.strategy';
import { JwtHttpTransport } from './jwt-http.transport';
import { AuthSessionEntity } from './session/auth-session.entity';
import { PostgresSessionStore } from './session/postgres-session.store';
import { CachedSessionStore } from './session/cached-session.store';
import { SessionAuthenticationAdapter } from './session/session-authentication.adapter';
import { SessionAuthStrategy } from './session/session-auth.strategy';
import { SessionHttpTransport } from './session/session-http.transport';
import { AUTHENTICATION_PORT } from 'src/common/auth/authentication.port';
import { AUTH_STRATEGY } from 'src/common/auth/auth-strategy.port';
import { AUTH_HTTP_TRANSPORT } from 'src/common/auth/auth-http-transport.port';
import { SESSION_STORE } from 'src/common/auth/session-store.port';
import { PASSWORD_HASHER } from 'src/common/security/password-hasher.port';
import { Argon2PasswordHasher } from 'src/common/security/argon2-password-hasher.adapter';

type AuthConf = ConfigType<typeof authConfig>;

/** Chọn implementation theo AUTH_MODE — nơi duy nhất biết cả hai mode cùng lúc. */
function byMode<T>(conf: AuthConf, jwt: T, session: T): T {
  return conf.mode === AuthMode.SESSION ? session : jwt;
}

/**
 * Composition root của authentication. `AUTH_MODE` chọn đúng một bộ ba
 * (authentication adapter, strategy, http transport); hai mode không chia sẻ code path hay bảng.
 *
 *   jwt     : jwt-authentication.adapter | jwt-auth.strategy     | jwt-http.transport
 *   session : session/session-authentication.adapter | session/session-auth.strategy | session/session-http.transport
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshSessionEntity, AuthSessionEntity]),
    UsersModule,
    JwtModule.register({}), // JWT configuration is supplied by the JWT adapter/service.
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    Argon2PasswordHasher,
    { provide: PASSWORD_HASHER, useExisting: Argon2PasswordHasher },
    // --- jwt mode ---
    JwtAuthenticationAdapter,
    JwtAuthStrategy,
    JwtHttpTransport,
    // --- session mode ---
    PostgresSessionStore,
    CachedSessionStore,
    { provide: SESSION_STORE, useExisting: CachedSessionStore },
    SessionAuthenticationAdapter,
    SessionAuthStrategy,
    SessionHttpTransport,
    // --- chọn theo AUTH_MODE ---
    {
      provide: AUTHENTICATION_PORT,
      inject: [authConfig.KEY, JwtAuthenticationAdapter, SessionAuthenticationAdapter],
      useFactory: byMode,
    },
    {
      provide: AUTH_STRATEGY,
      inject: [authConfig.KEY, JwtAuthStrategy, SessionAuthStrategy],
      useFactory: byMode,
    },
    {
      provide: AUTH_HTTP_TRANSPORT,
      inject: [authConfig.KEY, JwtHttpTransport, SessionHttpTransport],
      useFactory: byMode,
    },
  ],
  exports: [AuthService, JwtModule, AUTHENTICATION_PORT, AUTH_STRATEGY, AUTH_HTTP_TRANSPORT],
})
export class AuthModule {}
