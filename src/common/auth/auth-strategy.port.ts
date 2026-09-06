import type { AuthStrategy } from '@meago/core';

/**
 * Port cấp/gia hạn/thu hồi credential. Controller chỉ biết `AuthResult`;
 * JWT hay stateful session được chọn tại composition root theo `AUTH_MODE`.
 */
export const AUTH_STRATEGY = Symbol('AUTH_STRATEGY');

export type { AuthStrategy };
