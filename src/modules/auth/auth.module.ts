import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/modules/users/users.module';
import { RefreshSessionEntity } from './refresh-session.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthenticationAdapter } from './jwt-authentication.adapter';
import { AUTHENTICATION_PORT } from 'src/common/auth/authentication.port';
import { PASSWORD_HASHER } from 'src/common/security/password-hasher.port';
import { Argon2PasswordHasher } from 'src/common/security/argon2-password-hasher.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshSessionEntity]),
    UsersModule,
    JwtModule.register({}), // JWT configuration is supplied by the JWT adapter/service.
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthenticationAdapter,
    Argon2PasswordHasher,
    { provide: AUTHENTICATION_PORT, useExisting: JwtAuthenticationAdapter },
    { provide: PASSWORD_HASHER, useExisting: Argon2PasswordHasher },
  ],
  exports: [AuthService, JwtModule, AUTHENTICATION_PORT],
})
export class AuthModule {}
