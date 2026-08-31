import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Khai báo permission dạng "resource:action", vd @RequirePermissions('story:create').
 * Route không gắn decorator này thì chỉ cần principal đã được xác thực.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
