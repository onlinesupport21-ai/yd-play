import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AdminAuditService {
  constructor(private readonly db: DatabaseService) {}

  async write(input: {
    adminUserId?: string;
    actor?: string;
    action: string;
    targetType?: string;
    targetId?: string;
    ip?: string;
    requestId?: string;
    beforeState?: unknown;
    afterState?: unknown;
    reason?: string;
    result?: 'success' | 'denied' | 'failed';
  }) {
    const adminId = input.adminUserId && input.adminUserId !== 'bootstrap-admin-key'
      ? input.adminUserId
      : null;
    await this.db.query(
      `INSERT INTO admin_audit_logs
        (actor, admin_user_id, action, target_type, target_id, request_ip, request_id,
         before_state, after_state, reason, result)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)`,
      [
        input.actor ?? (adminId ? 'admin-user' : 'bootstrap-admin-key'),
        adminId,
        input.action,
        input.targetType ?? null,
        input.targetId ?? null,
        input.ip ?? null,
        input.requestId ?? null,
        input.beforeState === undefined ? null : JSON.stringify(input.beforeState),
        input.afterState === undefined ? null : JSON.stringify(input.afterState),
        input.reason ?? null,
        input.result ?? 'success'
      ]
    );
  }
}
