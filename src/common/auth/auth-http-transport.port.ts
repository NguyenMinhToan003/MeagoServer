import type { Request, Response } from 'express';
import type { AuthCredential, AuthResult } from '@meago/core';

/** cookie-parser khai `cookies: any`; thu hẹp lại để không lọt `any` qua boundary. */
export type CookieRequest = Omit<Request, 'cookies'> & { cookies?: Record<string, unknown> };

/**
 * Lớp HTTP của một auth mode: credential nằm ở đâu trên request (header/cookie),
 * ghi/xoá cookie thế nào, body trả về gì. Mỗi mode một file; guard và controller
 * chỉ gọi port này nên không có `if (mode)` ở tầng HTTP.
 */
export interface AuthHttpTransport {
  /** Credential kèm mỗi request thường — guard dùng. */
  readRequestCredential(request: CookieRequest): AuthCredential | undefined;
  /** Credential cho refresh/logout — controller dùng. */
  readRenewCredential(request: CookieRequest): AuthCredential | undefined;
  /** Ghi cookie theo kết quả signIn/renew và trả body cho client. */
  apply(response: Response, result: AuthResult): Record<string, unknown>;
  clear(response: Response): void;
  readonly messages: {
    missingRequestCredential: string;
    invalidRequestCredential: string;
    missingRenewCredential: string;
  };
}

export const AUTH_HTTP_TRANSPORT = Symbol('AUTH_HTTP_TRANSPORT');

export function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
