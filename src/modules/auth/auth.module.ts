import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/modules/users/users.module';
import { RefreshSessionEntity } from './refresh-session.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthenticationAdapter } from './jwt-authentication.adapter';
import { AUTHENTICATION_PORT } from 'src/common/auth/authentication.port';

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
    { provide: AUTHENTICATION_PORT, useExisting: JwtAuthenticationAdapter },
  ],
  exports: [AuthService, JwtModule, AUTHENTICATION_PORT],
})
export class AuthModule {}
