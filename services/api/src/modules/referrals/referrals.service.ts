import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../../common/database/database.service';
import { WalletService } from '../wallet/wallet.service';
import { calculateReferralRisk } from './risk';
import { UpdateReferralConfigDto } from './dto/update-referral-config.dto';

interface ProgramRow {
  id: string;
  code: string;
  is_active: boolean;
  inviter_reward: string;
  invitee_reward: string;
  daily_inviter_reward_cap: string | null;
  lifetime_inviter_reward_cap: string | null;
  min_account_age_minutes: number;
  max_invites_per_hour: number;
  same_device_risk: number;
  same_ip_risk: number;
  ip_velocity_risk: number;
  device_multi_account_risk: number;
  inviter_velocity_risk: number;
  review_threshold: number;
  block_threshold: number;
  updated_at: Date;
}

interface LoadedReferral extends ReferralRow {
  program_record_id: string;
  code: string;
  is_active: boolean;
  inviter_reward: string;
  invitee_reward: string;
  daily_inviter_reward_cap: string | null;
  lifetime_inviter_reward_cap: string | null;
  min_account_age_minutes: number;
  max_invites_per_hour: number;
  same_device_risk: number;
  same_ip_risk: number;
  ip_velocity_risk: number;
  device_multi_account_risk: number;
  inviter_velocity_risk: number;
  review_threshold: number;
  block_threshold: number;
  updated_at: Date;
}

interface ReferralRow {
  id: string;
  program_id: string;
  inviter_user_id: string;
  invitee_user_id: string;
  referral_code: string;
  attribution_ip: string | null;
  status: 'pending' | 'review' | 'qualified' | 'rewarded' | 'rejected';
  risk_score: number;
  created_at: Date;
  invitee_created_at: Date;
}

@Injectable()
export class ReferralsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly wallets: WalletService
  ) {}

  private normalizeCode(code: string) {
    return code.trim().toUpperCase();
  }

  private generateCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(8);
    let suffix = '';
    for (let i = 0; i < bytes.length; i += 1) {
      suffix += alphabet[bytes[i] % alphabet.length];
    }
    return `YD${suffix}`;
  }

  private async activeProgram(): Promise<ProgramRow> {
    const program = await this.db.one<ProgramRow>(
      `SELECT * FROM referral_programs WHERE code = 'default' AND is_active = true LIMIT 1`
    );
    if (!program) throw new NotFoundException('Active referral program not found');
    return program;
  }

  async ensureUserCode(userId: string): Promise<string> {
    const program = await this.activeProgram();
    const existing = await this.db.one<{ code: string }>(
      `SELECT code FROM user_referral_codes WHERE user_id = $1 AND program_id = $2`,
      [userId, program.id]
    );
    if (existing) return existing.code;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const code = this.generateCode();
      try {
        const inserted = await this.db.one<{ code: string }>(
          `INSERT INTO user_referral_codes (user_id, program_id, code)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, program_id) DO NOTHING
           RETURNING code`,
          [userId, program.id, code]
        );
        if (inserted) return inserted.code;

        const winner = await this.db.one<{ code: string }>(
          `SELECT code FROM user_referral_codes WHERE user_id = $1 AND program_id = $2`,
          [userId, program.id]
        );
        if (winner) return winner.code;
      } catch (error: any) {
        if (error?.code !== '23505') throw error;
      }
    }
    throw new ConflictException('Unable to allocate referral code');
  }

  async onUserRegistered(userId: string, referralCode: string | undefined, ip: string) {
    const ownCode = await this.ensureUserCode(userId);
    if (!referralCode) return { ownCode, applied: false };

    try {
      const applied = await this.applyCode(userId, referralCode, ip);
      return { ownCode, applied: true, referral: applied };
    } catch (error: any) {
      // Registration must not be rolled back after identity/session creation just because
      // an optional referral code is invalid or no longer usable.
      return {
        ownCode,
        applied: false,
        referralError: error?.message ?? 'Referral code could not be applied'
      };
    }
  }

  async getSummary(userId: string) {
    const program = await this.activeProgram();
    const code = await this.ensureUserCode(userId);
    const counts = await this.db.one<{
      total: string;
      rewarded: string;
      pending: string;
      review: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE status = 'rewarded')::text AS rewarded,
         COUNT(*) FILTER (WHERE status IN ('pending','qualified'))::text AS pending,
         COUNT(*) FILTER (WHERE status = 'review')::text AS review
       FROM referrals
       WHERE inviter_user_id = $1 AND program_id = $2`,
      [userId, program.id]
    );
    const rewards = await this.db.one<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM referral_rewards
       WHERE beneficiary_user_id = $1 AND program_id = $2 AND status = 'granted'`,
      [userId, program.id]
    );
    const attribution = await this.db.one<{
      status: string;
      risk_score: number;
      created_at: Date;
    }>(
      `SELECT status, risk_score, created_at FROM referrals WHERE invitee_user_id = $1`,
      [userId]
    );

    return {
      code,
      program: {
        inviterReward: program.inviter_reward,
        inviteeReward: program.invitee_reward,
        dailyInviterRewardCap: program.daily_inviter_reward_cap,
        lifetimeInviterRewardCap: program.lifetime_inviter_reward_cap,
        minAccountAgeMinutes: program.min_account_age_minutes
      },
      invited: {
        total: Number(counts?.total ?? 0),
        rewarded: Number(counts?.rewarded ?? 0),
        pending: Number(counts?.pending ?? 0),
        review: Number(counts?.review ?? 0)
      },
      earnedCoins: rewards?.total ?? '0',
      attribution: attribution ?? null
    };
  }

  async applyCode(inviteeUserId: string, rawCode: string, ip: string) {
    const code = this.normalizeCode(rawCode);
    const owner = await this.db.one<{ inviter_user_id: string; program_id: string }>(
      `SELECT urc.user_id AS inviter_user_id, urc.program_id
       FROM user_referral_codes urc
       JOIN referral_programs rp ON rp.id = urc.program_id
       WHERE urc.code = $1 AND rp.is_active = true`,
      [code]
    );
    if (!owner) throw new NotFoundException('Referral code not found');
    if (owner.inviter_user_id === inviteeUserId) {
      throw new ConflictException('You cannot use your own referral code');
    }

    const existing = await this.db.one<{ id: string; referral_code: string }>(
      `SELECT id, referral_code FROM referrals WHERE invitee_user_id = $1`,
      [inviteeUserId]
    );
    if (existing) {
      if (this.normalizeCode(existing.referral_code) === code) {
        return this.evaluateReferral(existing.id);
      }
      throw new ConflictException('A referral is already attached to this account');
    }

    let referralId: string;
    try {
      const inserted = await this.db.one<{ id: string }>(
        `INSERT INTO referrals
          (program_id, inviter_user_id, invitee_user_id, referral_code, attribution_ip)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [owner.program_id, owner.inviter_user_id, inviteeUserId, code, ip]
      );
      if (!inserted) throw new Error('Referral insert failed');
      referralId = inserted.id;
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException('A referral is already attached to this account');
      }
      throw error;
    }

    return this.evaluateReferral(referralId);
  }

  async evaluateForInvitee(inviteeUserId: string) {
    const referral = await this.db.one<{ id: string }>(
      `SELECT id FROM referrals WHERE invitee_user_id = $1`,
      [inviteeUserId]
    );
    if (!referral) throw new NotFoundException('No referral attached to this account');
    return this.evaluateReferral(referral.id);
  }

  private async loadReferral(referralId: string) {
    return this.db.one<LoadedReferral>(
      `SELECT
         r.id, r.program_id, r.inviter_user_id, r.invitee_user_id,
         r.referral_code, r.attribution_ip::text, r.status, r.risk_score, r.created_at,
         u.created_at AS invitee_created_at,
         rp.id AS program_record_id, rp.code, rp.is_active, rp.inviter_reward, rp.invitee_reward,
         rp.daily_inviter_reward_cap, rp.lifetime_inviter_reward_cap,
         rp.min_account_age_minutes, rp.max_invites_per_hour,
         rp.same_device_risk, rp.same_ip_risk, rp.ip_velocity_risk,
         rp.device_multi_account_risk, rp.inviter_velocity_risk,
         rp.review_threshold, rp.block_threshold, rp.updated_at
       FROM referrals r
       JOIN users u ON u.id = r.invitee_user_id
       JOIN referral_programs rp ON rp.id = r.program_id
       WHERE r.id = $1`,
      [referralId]
    );
  }

  async evaluateReferral(referralId: string) {
    const referral = await this.loadReferral(referralId);
    if (!referral) throw new NotFoundException('Referral not found');
    if (referral.status === 'rewarded' || referral.status === 'rejected') {
      return this.referralResult(referralId);
    }

    const sameDevice = await this.db.one<{ device_id: string }>(
      `SELECT invitee.id AS device_id
       FROM devices invitee
       JOIN devices inviter ON inviter.device_hash = invitee.device_hash
       WHERE invitee.user_id = $1 AND inviter.user_id = $2
       LIMIT 1`,
      [referral.invitee_user_id, referral.inviter_user_id]
    );

    const sameIp = referral.attribution_ip
      ? await this.db.one<{ matched: boolean }>(
          `SELECT true AS matched
           FROM devices
           WHERE user_id = $1
             AND (first_seen_ip = $2::inet OR last_seen_ip = $2::inet)
           LIMIT 1`,
          [referral.inviter_user_id, referral.attribution_ip]
        )
      : null;

    const ipVelocity = referral.attribution_ip
      ? await this.db.one<{ account_count: string }>(
          `SELECT COUNT(DISTINCT user_id)::text AS account_count
           FROM devices
           WHERE first_seen_ip = $1::inet
             AND first_seen_at >= now() - interval '1 hour'`,
          [referral.attribution_ip]
        )
      : null;

    const deviceMulti = await this.db.one<{ account_count: string }>(
      `SELECT COUNT(DISTINCT d2.user_id)::text AS account_count
       FROM devices d1
       JOIN devices d2 ON d2.device_hash = d1.device_hash
       WHERE d1.user_id = $1`,
      [referral.invitee_user_id]
    );

    const inviterVelocity = await this.db.one<{ referral_count: string }>(
      `SELECT COUNT(*)::text AS referral_count
       FROM referrals
       WHERE inviter_user_id = $1
         AND created_at >= now() - interval '1 hour'`,
      [referral.inviter_user_id]
    );

    const signals = {
      selfReferral: referral.inviter_user_id === referral.invitee_user_id,
      sameDevice: Boolean(sameDevice),
      sameIp: Boolean(sameIp),
      highIpSignupVelocity: Number(ipVelocity?.account_count ?? 0) >= 5,
      deviceUsedByMultipleAccounts: Number(deviceMulti?.account_count ?? 0) >= 2,
      highInviterVelocity: Number(inviterVelocity?.referral_count ?? 0) > referral.max_invites_per_hour
    };

    const risk = calculateReferralRisk(signals, {
      sameDeviceRisk: referral.same_device_risk,
      sameIpRisk: referral.same_ip_risk,
      ipVelocityRisk: referral.ip_velocity_risk,
      deviceMultiAccountRisk: referral.device_multi_account_risk,
      inviterVelocityRisk: referral.inviter_velocity_risk
    });

    for (const flag of risk.flags) {
      const evidence = {
        signals,
        attributionIp: referral.attribution_ip,
        observedAt: new Date().toISOString()
      };
      await this.db.query(
        `INSERT INTO referral_abuse_flags
          (referral_id, user_id, device_id, rule_code, risk_points, evidence)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (referral_id, rule_code)
         DO UPDATE SET
           risk_points = GREATEST(referral_abuse_flags.risk_points, EXCLUDED.risk_points),
           evidence = referral_abuse_flags.evidence || EXCLUDED.evidence`,
        [
          referral.id,
          referral.invitee_user_id,
          sameDevice?.device_id ?? null,
          flag.ruleCode,
          flag.riskPoints,
          JSON.stringify(evidence)
        ]
      );
    }

    if (risk.score >= referral.block_threshold) {
      await this.db.query(
        `UPDATE referrals
         SET status = 'rejected', risk_score = $2,
             rejected_reason = 'Referral reward blocked by anti-abuse risk rules',
             updated_at = now()
         WHERE id = $1`,
        [referral.id, risk.score]
      );
      return this.referralResult(referral.id);
    }

    if (risk.score >= referral.review_threshold) {
      await this.db.query(
        `UPDATE referrals
         SET status = 'review', risk_score = $2, updated_at = now()
         WHERE id = $1`,
        [referral.id, risk.score]
      );
      return this.referralResult(referral.id);
    }

    const ageMinutes = (Date.now() - new Date(referral.invitee_created_at).getTime()) / 60000;
    if (ageMinutes < referral.min_account_age_minutes) {
      await this.db.query(
        `UPDATE referrals SET status = 'pending', risk_score = $2, updated_at = now() WHERE id = $1`,
        [referral.id, risk.score]
      );
      return this.referralResult(referral.id);
    }

    await this.db.query(
      `UPDATE referrals
       SET status = 'qualified', risk_score = $2, qualified_at = COALESCE(qualified_at, now()), updated_at = now()
       WHERE id = $1 AND status NOT IN ('rewarded','rejected')`,
      [referral.id, risk.score]
    );

    await this.grantReferralRewards(referral.id);
    return this.referralResult(referral.id);
  }

  private async reserveReward(input: {
    referralId: string;
    program: ProgramRow;
    beneficiaryUserId: string;
    role: 'inviter' | 'invitee';
    amount: bigint;
  }) {
    return this.db.tx(async (client) => {
      const lockKey = `referral-reward:${input.program.id}:${input.beneficiaryUserId}`;
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [lockKey]);

      const existingResult = await client.query<{
        id: string;
        status: 'pending' | 'granted' | 'blocked' | 'reversed';
        amount: string;
        wallet_transaction_id: string | null;
      }>(
        `SELECT id, status, amount, wallet_transaction_id
         FROM referral_rewards
         WHERE referral_id = $1 AND role = $2
         FOR UPDATE`,
        [input.referralId, input.role]
      );
      const existing = existingResult.rows[0];
      if (existing) return existing;

      let blockedReason: string | null = null;
      if (input.role === 'inviter') {
        const totals = await client.query<{ lifetime: string; today: string }>(
          `SELECT
             COALESCE(SUM(amount) FILTER (WHERE status IN ('pending','granted')), 0)::text AS lifetime,
             COALESCE(SUM(amount) FILTER (
               WHERE status IN ('pending','granted') AND created_at >= date_trunc('day', now())
             ), 0)::text AS today
           FROM referral_rewards
           WHERE program_id = $1 AND beneficiary_user_id = $2 AND role = 'inviter'`,
          [input.program.id, input.beneficiaryUserId]
        );
        const lifetime = BigInt(totals.rows[0]?.lifetime ?? '0');
        const today = BigInt(totals.rows[0]?.today ?? '0');
        const dailyCap = input.program.daily_inviter_reward_cap === null
          ? null
          : BigInt(input.program.daily_inviter_reward_cap);
        const lifetimeCap = input.program.lifetime_inviter_reward_cap === null
          ? null
          : BigInt(input.program.lifetime_inviter_reward_cap);
        if (dailyCap !== null && today + input.amount > dailyCap) blockedReason = 'daily_cap';
        if (lifetimeCap !== null && lifetime + input.amount > lifetimeCap) blockedReason = 'lifetime_cap';
      }

      const inserted = await client.query<{
        id: string;
        status: 'pending' | 'granted' | 'blocked' | 'reversed';
        amount: string;
        wallet_transaction_id: string | null;
      }>(
        `INSERT INTO referral_rewards
          (referral_id, program_id, beneficiary_user_id, role, amount, status, blocked_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, status, amount, wallet_transaction_id`,
        [
          input.referralId,
          input.program.id,
          input.beneficiaryUserId,
          input.role,
          input.amount.toString(),
          blockedReason ? 'blocked' : 'pending',
          blockedReason
        ]
      );
      return inserted.rows[0];
    });
  }

  private async grantOneReward(input: {
    referralId: string;
    program: ProgramRow;
    beneficiaryUserId: string;
    role: 'inviter' | 'invitee';
    amount: bigint;
  }) {
    if (input.amount <= 0n) return { status: 'blocked', reason: 'zero_reward' };
    const reward = await this.reserveReward(input);
    if (reward.status === 'granted' || reward.status === 'blocked') return reward;

    const transfer = await this.wallets.transfer({
      idempotencyKey: `referral:${input.referralId}:${input.role}`,
      reason: 'referral_reward',
      actorUserId: input.beneficiaryUserId,
      fromAccountCode: 'SYSTEM:PROMO',
      toAccountCode: `USER:${input.beneficiaryUserId}`,
      amount: input.amount,
      referenceType: 'referral',
      referenceId: input.referralId,
      metadata: { role: input.role, programId: input.program.id }
    });

    await this.db.query(
      `UPDATE referral_rewards
       SET status = 'granted', wallet_transaction_id = $2, granted_at = now()
       WHERE id = $1 AND status = 'pending'`,
      [reward.id, transfer.transactionId]
    );
    return { ...reward, status: 'granted', wallet_transaction_id: transfer.transactionId };
  }

  private programFromLoaded(referral: LoadedReferral): ProgramRow {
    return {
      id: referral.program_record_id,
      code: referral.code,
      is_active: referral.is_active,
      inviter_reward: referral.inviter_reward,
      invitee_reward: referral.invitee_reward,
      daily_inviter_reward_cap: referral.daily_inviter_reward_cap,
      lifetime_inviter_reward_cap: referral.lifetime_inviter_reward_cap,
      min_account_age_minutes: referral.min_account_age_minutes,
      max_invites_per_hour: referral.max_invites_per_hour,
      same_device_risk: referral.same_device_risk,
      same_ip_risk: referral.same_ip_risk,
      ip_velocity_risk: referral.ip_velocity_risk,
      device_multi_account_risk: referral.device_multi_account_risk,
      inviter_velocity_risk: referral.inviter_velocity_risk,
      review_threshold: referral.review_threshold,
      block_threshold: referral.block_threshold,
      updated_at: referral.updated_at
    };
  }

  private async grantReferralRewards(referralId: string) {
    const referral = await this.loadReferral(referralId);
    if (!referral) throw new NotFoundException('Referral not found');
    if (referral.status !== 'qualified' && referral.status !== 'rewarded') {
      return this.referralResult(referralId);
    }

    const program = this.programFromLoaded(referral);

    await this.grantOneReward({
      referralId,
      program,
      beneficiaryUserId: referral.inviter_user_id,
      role: 'inviter',
      amount: BigInt(referral.inviter_reward)
    });
    await this.grantOneReward({
      referralId,
      program,
      beneficiaryUserId: referral.invitee_user_id,
      role: 'invitee',
      amount: BigInt(referral.invitee_reward)
    });

    await this.db.query(
      `UPDATE referrals SET status = 'rewarded', rewarded_at = COALESCE(rewarded_at, now()), updated_at = now()
       WHERE id = $1 AND status = 'qualified'`,
      [referralId]
    );
  }

  private async referralResult(referralId: string) {
    const referral = await this.db.one<{
      id: string;
      status: string;
      risk_score: number;
      referral_code: string;
      qualified_at: Date | null;
      rewarded_at: Date | null;
      rejected_reason: string | null;
    }>(
      `SELECT id, status, risk_score, referral_code, qualified_at, rewarded_at, rejected_reason
       FROM referrals WHERE id = $1`,
      [referralId]
    );
    if (!referral) throw new NotFoundException('Referral not found');
    const rewards = await this.db.query<{
      role: string;
      amount: string;
      status: string;
      blocked_reason: string | null;
    }>(
      `SELECT role, amount, status, blocked_reason FROM referral_rewards WHERE referral_id = $1 ORDER BY role`,
      [referralId]
    );
    return { ...referral, rewards };
  }

  async adminDecision(referralId: string, decision: 'approve' | 'reject', reason: string) {
    const referral = await this.loadReferral(referralId);
    if (!referral) throw new NotFoundException('Referral not found');
    if (referral.status === 'rewarded') {
      if (decision === 'reject') {
        throw new ConflictException('A rewarded referral must be reversed through a compensating ledger workflow');
      }
      return this.referralResult(referralId);
    }

    if (decision === 'reject') {
      await this.db.query(
        `UPDATE referrals
         SET status = 'rejected', rejected_reason = $2, updated_at = now()
         WHERE id = $1 AND status <> 'rewarded'`,
        [referralId, `Admin review: ${reason}`]
      );
      return this.referralResult(referralId);
    }

    await this.db.query(
      `UPDATE referrals
       SET status = 'qualified', qualified_at = COALESCE(qualified_at, now()),
           rejected_reason = NULL, updated_at = now()
       WHERE id = $1 AND status <> 'rewarded'`,
      [referralId]
    );
    await this.grantReferralRewards(referralId);
    return this.referralResult(referralId);
  }

  async getAdminConfig() {
    const program = await this.activeProgram();
    return this.presentProgram(program);
  }

  private presentProgram(program: ProgramRow) {
    return {
      id: program.id,
      code: program.code,
      inviterReward: program.inviter_reward,
      inviteeReward: program.invitee_reward,
      dailyInviterRewardCap: program.daily_inviter_reward_cap,
      lifetimeInviterRewardCap: program.lifetime_inviter_reward_cap,
      minAccountAgeMinutes: program.min_account_age_minutes,
      maxInvitesPerHour: program.max_invites_per_hour,
      sameDeviceRisk: program.same_device_risk,
      sameIpRisk: program.same_ip_risk,
      ipVelocityRisk: program.ip_velocity_risk,
      deviceMultiAccountRisk: program.device_multi_account_risk,
      inviterVelocityRisk: program.inviter_velocity_risk,
      reviewThreshold: program.review_threshold,
      blockThreshold: program.block_threshold,
      updatedAt: program.updated_at
    };
  }

  async updateAdminConfig(dto: UpdateReferralConfigDto) {
    const current = await this.activeProgram();
    const mergedReview = dto.reviewThreshold ?? current.review_threshold;
    const mergedBlock = dto.blockThreshold ?? current.block_threshold;
    if (mergedReview > mergedBlock) {
      throw new ConflictException('reviewThreshold cannot exceed blockThreshold');
    }

    const updated = await this.db.one<ProgramRow>(
      `UPDATE referral_programs SET
         inviter_reward = COALESCE($2, inviter_reward),
         invitee_reward = COALESCE($3, invitee_reward),
         daily_inviter_reward_cap = COALESCE($4, daily_inviter_reward_cap),
         lifetime_inviter_reward_cap = COALESCE($5, lifetime_inviter_reward_cap),
         min_account_age_minutes = COALESCE($6, min_account_age_minutes),
         max_invites_per_hour = COALESCE($7, max_invites_per_hour),
         same_device_risk = COALESCE($8, same_device_risk),
         same_ip_risk = COALESCE($9, same_ip_risk),
         ip_velocity_risk = COALESCE($10, ip_velocity_risk),
         device_multi_account_risk = COALESCE($11, device_multi_account_risk),
         inviter_velocity_risk = COALESCE($12, inviter_velocity_risk),
         review_threshold = COALESCE($13, review_threshold),
         block_threshold = COALESCE($14, block_threshold),
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        current.id,
        dto.inviterReward ?? null,
        dto.inviteeReward ?? null,
        dto.dailyInviterRewardCap ?? null,
        dto.lifetimeInviterRewardCap ?? null,
        dto.minAccountAgeMinutes ?? null,
        dto.maxInvitesPerHour ?? null,
        dto.sameDeviceRisk ?? null,
        dto.sameIpRisk ?? null,
        dto.ipVelocityRisk ?? null,
        dto.deviceMultiAccountRisk ?? null,
        dto.inviterVelocityRisk ?? null,
        dto.reviewThreshold ?? null,
        dto.blockThreshold ?? null
      ]
    );
    if (!updated) throw new NotFoundException('Referral program not found');
    return { before: this.presentProgram(current), after: this.presentProgram(updated) };
  }

  async listFraudFlags(status: string, limit: number) {
    const allowed = new Set(['open', 'reviewing', 'confirmed', 'dismissed']);
    const normalized = allowed.has(status) ? status : 'open';
    const rows = await this.db.query(
      `SELECT
         f.id, f.referral_id, f.user_id, f.device_id, f.rule_code,
         f.risk_points, f.evidence, f.status, f.created_at, f.reviewed_at,
         r.risk_score AS referral_risk_score, r.status AS referral_status
       FROM referral_abuse_flags f
       JOIN referrals r ON r.id = f.referral_id
       WHERE f.status = $1
       ORDER BY f.risk_points DESC, f.created_at DESC
       LIMIT $2`,
      [normalized, Math.min(Math.max(limit, 1), 100)]
    );
    return { items: rows };
  }

  async reviewFraudFlag(flagId: string, status: 'reviewing' | 'confirmed' | 'dismissed') {
    const updated = await this.db.one(
      `UPDATE referral_abuse_flags
       SET status = $2, reviewed_at = CASE WHEN $2 IN ('confirmed','dismissed') THEN now() ELSE reviewed_at END
       WHERE id = $1
       RETURNING *`,
      [flagId, status]
    );
    if (!updated) throw new NotFoundException('Fraud flag not found');
    return updated;
  }

  async adminOverview() {
    const metrics = await this.db.one<{
      referrals_total: string;
      rewarded: string;
      review: string;
      rejected: string;
      granted_coins: string;
      open_flags: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM referrals)::text AS referrals_total,
         (SELECT COUNT(*) FROM referrals WHERE status = 'rewarded')::text AS rewarded,
         (SELECT COUNT(*) FROM referrals WHERE status = 'review')::text AS review,
         (SELECT COUNT(*) FROM referrals WHERE status = 'rejected')::text AS rejected,
         (SELECT COALESCE(SUM(amount),0) FROM referral_rewards WHERE status = 'granted')::text AS granted_coins,
         (SELECT COUNT(*) FROM referral_abuse_flags WHERE status IN ('open','reviewing'))::text AS open_flags`
    );
    return metrics;
  }
}
