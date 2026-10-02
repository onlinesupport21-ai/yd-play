import { SetMetadata } from '@nestjs/common';
import { AdminRole } from './admin.types';

export const ADMIN_ROLES_KEY = 'ydplay:admin-roles';
export const AdminRoles = (...roles: AdminRole[]) => SetMetadata(ADMIN_ROLES_KEY, roles);
