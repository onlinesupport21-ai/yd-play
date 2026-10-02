import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminPrincipal } from './admin.types';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminPrincipal => {
    const request = context.switchToHttp().getRequest<{ admin: AdminPrincipal }>();
    return request.admin;
  }
);
