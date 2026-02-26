import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRecord } from '../../users/users.service';

/** Injects the resolved UserRecord from request.user (populated by ResolveUserInterceptor). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserRecord => {
    return ctx.switchToHttp().getRequest().user;
  },
);

/** Injects the resolved DB user ID from request.user.id (populated by ResolveUserInterceptor). */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    return ctx.switchToHttp().getRequest().user?.id;
  },
);
