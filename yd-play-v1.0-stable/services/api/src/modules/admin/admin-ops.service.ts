import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../common/database/database.service';
import { AdminAuditService } from '../../common/admin/admin-audit.service';
import { AdminPrincipal } from '../../common/admin/admin.types';
import { WalletService } from '../wallet/wallet.service';
import { ReferralsService } from '../referrals/referrals.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateReferralConfigDto } from '../referrals/dto/update-referral-config.dto';
import { CoinAdjustmentDto } from './dto/coin-adjustment.dto';
import { CreatePushCampaignDto } from './dto/create-push-campaign.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class AdminOpsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly wallet: WalletService,
    private readonly referrals: ReferralsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AdminAuditService
  ) {}

  async me(admin: AdminPrincipal) {
    if (admin.source === 'bootstrap-key') return admin;
    const row = await this.db.one<any>(
      `SELECT id, email, display_name, role, is_active, last_login_at, created_at
       FROM admin_users WHERE id = $1`,
      [admin.id]
    );
    return row ?? admin;
  }

  async dashboard() {
    const [users, games, refs, fraud, reports, supply, retention] = await Promise.all([
      this.db.one<any>(
        `SELECT
           count(*)::int AS total_users,
           count(*) FILTER (WHERE status = 'active')::int AS active_users,
           count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS new_users_24h,
           count(*) FILTER (WHERE last_login_at >= now() - interval '24 hours')::int AS logged_in_24h
         FROM users`
      ),
      this.db.one<any>(
        `SELECT
           count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS sessions_24h,
           count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS sessions_7d,
           count(*) FILTER (WHERE status = 'invalidated' AND created_at >= now() - interval '7 days')::int AS invalidated_7d
         FROM game_sessions`
      ),
      this.db.one<any>(
        `SELECT
           count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS referrals_24h,
           count(*) FILTER (WHERE status = 'rewarded' AND created_at >= now() - interval '7 days')::int AS rewarded_7d
         FROM referrals`
      ),
      this.db.one<any>(
        `SELECT count(*)::int AS open_flags
         FROM referral_abuse_flags WHERE status IN ('open','reviewing')`
      ),
      this.db.one<any>(
        `SELECT count(*)::int AS open_reports
         FROM moderation_reports WHERE status IN ('open','reviewing')`
      ),
      this.db.one<any>(
        `SELECT COALESCE(sum(cached_balance),0)::text AS circulating_coins
         FROM wallet_accounts WHERE account_type = 'user'`
      ),
      this.db.one<any>(
        `WITH cohort AS (
           SELECT id, created_at FROM users
           WHERE created_at >= current_date - interval '8 days'
             AND created_at < current_date - interval '1 day'
         )
         SELECT
           count(*)::int AS cohort_users,
           count(*) FILTER (WHERE u.last_login_at >= c.created_at + interval '1 day')::int AS returned_after_day1
         FROM cohort c JOIN users u ON u.id = c.id`
      )
    ]);

    const cohort = Number(retention?.cohort_users ?? 0);
    const returned = Number(retention?.returned_after_day1 ?? 0);
    return {
      generatedAt: new Date().toISOString(),
      users,
      games,
      referrals: { ...refs, ...fraud },
      moderation: reports,
      economy: supply,
      retention: {
        cohortUsers: cohort,
        returnedAfterDay1: returned,
        estimatedD1LoginRetention: cohort ? Number(((returned / cohort) * 100).toFixed(1)) : null,
        note: 'Login-based estimate until full analytics event ingestion is enabled.'
      }
    };
  }

  async listUsers(query = '', limit = 50) {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const q = query.trim();
    const rows = await this.db.query<any>(
      `SELECT
         u.id, u.email, u.status, u.created_at, u.last_login_at,
         p.username, p.display_name,
         COALESCE(w.cached_balance,0)::text AS coin_balance,
         (SELECT count(*)::int FROM devices d WHERE d.user_id = u.id) AS device_count
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       LEFT JOIN wallet_accounts w ON w.user_id = u.id AND w.account_type = 'user'
       WHERE ($1 = '' OR u.email::text ILIKE '%' || $1 || '%' OR p.username::text ILIKE '%' || $1 || '%' OR p.display_name ILIKE '%' || $1 || '%')
       ORDER BY u.created_at DESC
       LIMIT $2`,
      [q, safeLimit]
    );
    return { items: rows };
  }

  async userDetail(userId: string) {
    const user = await this.db.one<any>(
      `SELECT u.id, u.email, u.status, u.created_at, u.last_login_at,
              p.username, p.display_name, p.bio,
              COALESCE(w.cached_balance,0)::text AS coin_balance
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       LEFT JOIN wallet_accounts w ON w.user_id = u.id AND w.account_type = 'user'
       WHERE u.id = $1`,
      [userId]
    );
    if (!user) throw new NotFoundException('User not found');
    const [devices, actions, transactions] = await Promise.all([
      this.db.query<any>(
        `SELECT id, platform, app_version, first_seen_ip, last_seen_ip, first_seen_at, last_seen_at
         FROM devices WHERE user_id = $1 ORDER BY last_seen_at DESC LIMIT 20`,
        [userId]
      ),
      this.db.query<any>(
        `SELECT id, action_type, reason, starts_at, ends_at, created_at
         FROM moderation_actions WHERE target_user_id = $1 ORDER BY created_at DESC LIMIT 30`,
        [userId]
      ),
      this.wallet.listTransactions(userId, 30)
    ]);
    return { user, devices, moderationActions: actions, walletTransactions: transactions.items };
  }

  async updateUserStatus(admin: AdminPrincipal, userId: string, dto: UpdateUserStatusDto, ip?: string) {
    const before = await this.db.one<any>('SELECT id, status FROM users WHERE id = $1', [userId]);
    if (!before) throw new NotFoundException('User not found');
    const after = await this.db.one<any>(
      `UPDATE users SET status = $2, updated_at = now() WHERE id = $1 RETURNING id, status, updated_at`,
      [userId, dto.status]
    );
    if (admin.source !== 'bootstrap-key') {
      await this.db.query(
        `INSERT INTO moderation_actions (target_user_id, admin_user_id, action_type, reason)
         VALUES ($1,$2,$3,$4)`,
        [userId, admin.id, dto.status === 'active' ? 'reactivate' : dto.status === 'banned' ? 'ban' : 'suspend', dto.reason]
      );
    }
    await this.audit.write({
      adminUserId: admin.id,
      action: 'user.status.update',
      targetType: 'user',
      targetId: userId,
      ip,
      beforeState: before,
      afterState: after,
      reason: dto.reason
    });
    return after;
  }

  async adjustCoins(admin: AdminPrincipal, userId: string, dto: CoinAdjustmentDto, ip?: string) {
    const user = await this.db.one<{ id: string }>('SELECT id FROM users WHERE id = $1', [userId]);
    if (!user) throw new NotFoundException('User not found');
    const amount = BigInt(dto.amount);
    const stamp = `${Date.now()}:${randomUUID()}`;
    const result = dto.direction === 'credit'
      ? await this.wallet.transfer({
          idempotencyKey: `admin-adjustment:${admin.id}:${userId}:${stamp}`,
          reason: 'admin_adjustment',
          fromAccountCode: 'SYSTEM:PROMO',
          toAccountCode: `USER:${userId}`,
          amount,
          referenceType: 'admin_adjustment',
          referenceId: admin.id,
          metadata: { reason: dto.reason, direction: dto.direction }
        })
      : await this.wallet.transfer({
          idempotencyKey: `admin-adjustment:${admin.id}:${userId}:${stamp}`,
          reason: 'admin_adjustment',
          fromAccountCode: `USER:${userId}`,
          toAccountCode: 'SYSTEM:PROMO',
          amount,
          referenceType: 'admin_adjustment',
          referenceId: admin.id,
          metadata: { reason: dto.reason, direction: dto.direction }
        });
    await this.audit.write({
      adminUserId: admin.id,
      action: 'wallet.admin_adjustment',
      targetType: 'user',
      targetId: userId,
      ip,
      afterState: { transactionId: result.transactionId, ...dto },
      reason: dto.reason
    });
    return { ...result, wallet: await this.wallet.getUserWallet(userId) };
  }

  async analyticsEvents(days = 7) {
    const safeDays = Math.max(1, Math.min(90, Math.trunc(days)));
    const items = await this.db.query<any>(
      `SELECT event_name,count(*)::int AS events,count(DISTINCT user_id)::int AS unique_users,
              max(occurred_at) AS last_seen
       FROM analytics_events
       WHERE occurred_at >= now() - ($1 * interval '1 day')
       GROUP BY event_name ORDER BY events DESC,event_name`,
      [safeDays]
    );
    return { days: safeDays, items };
  }

  async economy(days = 7) {
    const safeDays = Math.max(1, Math.min(90, Math.trunc(days)));
    const [supply, flows] = await Promise.all([
      this.db.one<any>(
        `SELECT COALESCE(sum(cached_balance),0)::text AS circulating_coins,
                count(*)::int AS wallets
         FROM wallet_accounts WHERE account_type='user'`
      ),
      this.db.query<any>(
        `SELECT t.reason,
                COALESCE(sum(CASE WHEN e.delta > 0 THEN e.delta ELSE 0 END),0)::text AS source_coins,
                COALESCE(abs(sum(CASE WHEN e.delta < 0 THEN e.delta ELSE 0 END)),0)::text AS sink_coins,
                count(DISTINCT t.id)::int AS transactions
         FROM ledger_entries e
         JOIN wallet_accounts a ON a.id=e.account_id AND a.account_type='user'
         JOIN ledger_transactions t ON t.id=e.transaction_id
         WHERE e.created_at >= now() - ($1 * interval '1 day')
         GROUP BY t.reason ORDER BY t.reason`,
        [safeDays]
      )
    ]);
    return { days: safeDays, supply, flows };
  }

  async reports(status = 'open', limit = 50) {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    return {
      items: await this.db.query<any>(
        `SELECT r.*, rp.username AS reporter_username, tp.username AS target_username
         FROM moderation_reports r
         LEFT JOIN profiles rp ON rp.user_id=r.reporter_user_id
         LEFT JOIN profiles tp ON tp.user_id=r.target_user_id
         WHERE ($1 = 'all' OR r.status::text = $1)
         ORDER BY r.created_at DESC LIMIT $2`,
        [status, safeLimit]
      )
    };
  }

  async reviewReport(admin: AdminPrincipal, reportId: string, dto: ReviewReportDto, ip?: string) {
    if (admin.source === 'bootstrap-key') {
      throw new ConflictException('Use a named admin account for moderation decisions');
    }
    const before = await this.db.one<any>('SELECT * FROM moderation_reports WHERE id=$1', [reportId]);
    if (!before) throw new NotFoundException('Report not found');
    const after = await this.db.one<any>(
      `UPDATE moderation_reports
       SET status=$2, assigned_admin_id=$3, resolution_note=$4, updated_at=now(),
           resolved_at=CASE WHEN $2 IN ('resolved','dismissed') THEN now() ELSE NULL END
       WHERE id=$1 RETURNING *`,
      [reportId, dto.status, admin.id, dto.note ?? null]
    );
    await this.audit.write({ adminUserId: admin.id, action: 'moderation.report.review', targetType: 'moderation_report', targetId: reportId, ip, beforeState: before, afterState: after, reason: dto.note });
    return after;
  }

  async createPush(admin: AdminPrincipal, dto: CreatePushCampaignDto, ip?: string) {
    if (admin.source === 'bootstrap-key') throw new ConflictException('Use a named admin account for push campaigns');
    const status = dto.scheduledAt ? 'scheduled' : 'draft';
    const row = await this.db.one<any>(
      `INSERT INTO push_campaigns
        (name,title,body,segment,payload,status,scheduled_at,created_by_admin_id)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8) RETURNING *`,
      [dto.name, dto.title, dto.body, JSON.stringify(dto.segment ?? {}), JSON.stringify(dto.payload ?? {}), status, dto.scheduledAt ?? null, admin.id]
    );
    await this.audit.write({ adminUserId: admin.id, action: 'push.campaign.create', targetType: 'push_campaign', targetId: row?.id, ip, afterState: row });
    return row;
  }

  async listPush(limit = 50) {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    return { items: await this.db.query<any>('SELECT * FROM push_campaigns ORDER BY created_at DESC LIMIT $1', [safeLimit]) };
  }

  async dispatchPush(admin: AdminPrincipal, campaignId: string, ip?: string) {
    if (admin.source === 'bootstrap-key') throw new ConflictException('Use a named admin account for push dispatch');
    const result = await this.notifications.dispatchCampaign(campaignId);
    await this.audit.write({ adminUserId: admin.id, action: 'push.campaign.dispatch', targetType: 'push_campaign', targetId: campaignId, ip, afterState: result });
    return result;
  }

  async auditLogs(limit = 100) {
    const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
    return {
      items: await this.db.query<any>(
        `SELECT l.*, a.email AS admin_email, a.display_name AS admin_display_name
         FROM admin_audit_logs l
         LEFT JOIN admin_users a ON a.id=l.admin_user_id
         ORDER BY l.created_at DESC LIMIT $1`,
        [safeLimit]
      )
    };
  }

  referralConfig() { return this.referrals.getAdminConfig(); }
  referralOverview() { return this.referrals.adminOverview(); }
  fraudFlags(status = 'open', limit = 50) { return this.referrals.listFraudFlags(status, limit); }

  async updateReferralConfig(admin: AdminPrincipal, dto: UpdateReferralConfigDto, ip?: string) {
    const result = await this.referrals.updateAdminConfig(dto);
    await this.audit.write({ adminUserId: admin.id, action: 'referral.config.update', targetType: 'referral_program', targetId: result.after.id, ip, beforeState: result.before, afterState: result.after });
    return result.after;
  }

  async reviewFraudFlag(admin: AdminPrincipal, flagId: string, status: 'reviewing'|'confirmed'|'dismissed', reason: string | undefined, ip?: string) {
    const result = await this.referrals.reviewFraudFlag(flagId, status);
    await this.audit.write({ adminUserId: admin.id, action: 'referral.fraud_flag.review', targetType: 'referral_abuse_flag', targetId: flagId, ip, afterState: result, reason });
    return result;
  }
}
