import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface IJwtUser {
  sub: string; // user id
  email: string;
}

/** Lấy user đã được JwtAuthGuard gắn vào request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IJwtUser => {
    const request = ctx.switchToHttp().getRequest<{ user: IJwtUser }>();
    return request.user;
  },
);
