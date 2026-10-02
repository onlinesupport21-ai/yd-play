import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ROLES_KEY } from './admin-roles.decorator';
import { AdminPrincipal, AdminRole } from './admin.types';

@Injectable()
export class AdminRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<AdminRole[]>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!allowed?.length) return true;
    const request = context.switchToHttp().getRequest<{ admin?: AdminPrincipal }>();
    if (!request.admin || !allowed.includes(request.admin.role)) {
      throw new ForbiddenException('Admin role does not allow this action');
    }
    return true;
  }
}
