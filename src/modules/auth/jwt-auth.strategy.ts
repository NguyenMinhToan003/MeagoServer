import { Injectable, UnauthorizedException } from '@nestjs/common';
import type {
  AuthContext,
  AuthCredential,
  AuthIdentity,
  AuthPrincipal,
  AuthResult,
} from '@meago/core';
import { AuthStrategy } from 'src/common/auth/auth-strategy.port';
import { AuthService, IClientMeta, ITokenPair } from './auth.service';
import { JwtAuthenticationAdapter } from './jwt-authentication.adapter';

/** Bọc AuthService (JWT + refresh rotation) sau port trung lập để controller không biết mode. */
@Injectable()
export class JwtAuthStrategy implements AuthStrategy {
  constructor(
    private readonly authService: AuthService,
    private readonly authentication: JwtAuthenticationAdapter,
  ) {}

  authenticate(credential: AuthCredential, context: AuthContext): Promise<AuthPrincipal | null> {
    return this.authentication.authenticate(credential, context);
  }

  async signIn(identity: AuthIdentity, context: AuthContext): Promise<AuthResult> {
    return this.toResult(await this.authService.issueForIdentity(identity, this.toMeta(context)));
  }

  async renew(credential: AuthCredential, context: AuthContext): Promise<AuthResult> {
    if (credential.kind !== 'refresh') throw new UnauthorizedException('Missing refresh token');
    return this.toResult(await this.authService.refresh(credential.token, this.toMeta(context)));
  }

  async signOut(credential: AuthCredential, context: AuthContext): Promise<void> {
    void context;
    if (credential.kind !== 'refresh') return;
    await this.authService.logout(credential.token);
  }

  async revokeAll(subjectId: string): Promise<void> {
    await this.authService.logoutAllDevices(subjectId);
  }

  private toMeta(context: AuthContext): IClientMeta {
    return { deviceInfo: context.userAgent, ip: context.ip };
  }

  private toResult(pair: ITokenPair): AuthResult {
    return {
      mode: 'jwt',
      principal: { subjectId: pair.userId, sessionId: pair.sessionId, email: pair.email },
      accessToken: pair.accessToken,
      accessExpiresAt: pair.accessExpiresAt,
      refreshToken: pair.refreshToken,
      refreshExpiresAt: pair.refreshExpiresAt,
    };
  }
}
