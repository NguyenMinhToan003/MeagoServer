import type { SessionRecord, SessionStore } from '@meago/core';

/**
 * Dữ liệu phụ lưu cùng session để dựng `AuthPrincipal` mà không cần query user.
 * Type literal (không phải interface) để thoả constraint `Record<string, unknown>` của core
 * và vẫn gán được vào cột jsonb qua TypeORM `insert`.
 */
export type AuthSessionData = { email?: string };

export type AuthSessionRecord = SessionRecord<AuthSessionData>;
export type AuthSessionStore = SessionStore<AuthSessionData>;

/**
 * Port lưu stateful session. Postgres là nguồn sự thật; Redis chỉ là read-through cache
 * bọc bên ngoài. Mọi ghi vào `auth_sessions` phải đi qua port này để invalidation không bị bỏ sót.
 */
export const SESSION_STORE = Symbol('SESSION_STORE');
