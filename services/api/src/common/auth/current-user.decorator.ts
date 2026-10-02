import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AccessTokenPayload } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    const req = ctx.switchToHttp().getRequest<{ user: AccessTokenPayload }>();
    return req.user;
  }
);
