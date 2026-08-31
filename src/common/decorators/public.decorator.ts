import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Bỏ qua AuthenticationGuard; route public phải opt-in rõ ràng. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
