import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthContext, AuthCredential, AuthPrincipal } from '@meago/core';
import authConfig from 'src/configs/auth.config';
import { AuthenticationPort } from 'src/common/auth/authentication.port';

interface AccessJwtPayload {
  sub: string;
  email?: string;
  sid: string;
  jti: string;
}

@Injectable()
export class JwtAuthenticationAdapter implements AuthenticationPort {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(authConfig.KEY) private readonly conf: ConfigType<typeof authConfig>,
  ) {}

  async authenticate(
    credential: AuthCredential,
    context: AuthContext,
  ): Promise<AuthPrincipal | null> {
    void context;
    if (credential.kind !== 'bearer') return null;
    try {
      const payload = await this.jwtService.verifyAsync<AccessJwtPayload>(credential.token, {
        secret: this.conf.accessSecret,
        algorithms: ['HS256'],
        issuer: this.conf.issuer,
        audience: this.conf.audience,
      });
      if (!payload.sub || !payload.sid || !payload.jti) return null;
      return {
        subjectId: payload.sub,
        sessionId: payload.sid,
        email: payload.email,
      };
    } catch {
      return null;
    }
  }
}
