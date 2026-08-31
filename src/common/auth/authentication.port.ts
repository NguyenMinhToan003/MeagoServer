import type { AuthContext, AuthCredential, AuthPrincipal } from '@meago/core';

export const AUTHENTICATION_PORT = Symbol('AUTHENTICATION_PORT');

export interface AuthenticationPort {
  authenticate(credential: AuthCredential, context: AuthContext): Promise<AuthPrincipal | null>;
}
