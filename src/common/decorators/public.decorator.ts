import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Bỏ qua JwtAuthGuard (guard là global default-deny, route public phải opt-in). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
