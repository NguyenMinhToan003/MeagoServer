import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthPrincipal } from '@meago/core';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPrincipal =>
    ctx.switchToHttp().getRequest<{ user: AuthPrincipal }>().user,
);
