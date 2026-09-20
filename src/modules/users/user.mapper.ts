import type { IUser } from '@meago/core';
import { UserEntity } from './user.entity';

/** Entity -> response shape. Chỉ field ở đây được phép ra khỏi API — passwordHash không bao giờ có mặt. */
export function toUser(u: UserEntity): IUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    status: u.status,
    version: u.version,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt?.toISOString() ?? null,
  };
}
