import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Reads `request.user` set by an auth guard, e.g. `@CurrentUser() user: AccessTokenPayload`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): unknown =>
    context.switchToHttp().getRequest<Request & { user?: unknown }>().user,
);
