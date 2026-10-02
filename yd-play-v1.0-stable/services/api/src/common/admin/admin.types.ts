export type AdminRole =
  | 'support'
  | 'moderator'
  | 'analyst'
  | 'operator'
  | 'admin'
  | 'super_admin';

export interface AdminAccessPayload {
  sub: string;
  sid: string;
  role: AdminRole;
  email: string;
  type: 'admin-access';
}

export interface AdminPrincipal {
  id: string;
  sessionId?: string;
  email: string;
  role: AdminRole;
  source: 'jwt' | 'bootstrap-key';
}
