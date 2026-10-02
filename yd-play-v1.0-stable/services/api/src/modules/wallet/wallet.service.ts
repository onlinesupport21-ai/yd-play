import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../common/database/database.service';
import { assertBalanced } from './ledger';

interface AccountRow {
  id: string;
  account_code: string;
  account_type: 'user' | 'system';
  cached_balance: string;
  version: string;
}

@Injectable()
export class WalletService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  async createUserWallet(client: PoolClient, userId: string): Promise<string> {
    const accountCode = `USER:${userId}`;
    const result = await client.query<{ id: string }>(
      `INSERT INTO wallet_accounts
        (user_id, account_code, account_type, cached_balance)
       VALUES ($1, $2, 'user', 0)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [userId, accountCode]
    );
    return result.rows[0].id;
  }

  async grantSignupBonus(userId: string): Promise<void> {
    const amount = BigInt(this.config.get('SIGNUP_BONUS_COINS') ?? '1000');
    if (amount <= 0n) return;

    await this.transfer({
      idempotencyKey: `signup-bonus:${userId}`,
      reason: 'signup_bonus',
      actorUserId: userId,
      fromAccountCode: 'SYSTEM:PROMO',
      toAccountCode: `USER:${userId}`,
      amount,
      referenceType: 'user',
      referenceId: userId
    });
  }

  async getUserWallet(userId: string) {
    const account = await this.db.one<AccountRow>(
      `SELECT id, account_code, account_type, cached_balance, version
       FROM wallet_accounts
       WHERE user_id = $1 AND account_type = 'user'`,
      [userId]
    );
    if (!account) throw new NotFoundException('Wallet not found');

    return {
      currencyCode: 'COIN',
      balance: account.cached_balance,
      cashValue: 0,
      transferable: false,
      cashOut: false
    };
  }

  async listTransactions(userId: string, limit: number) {
    const rows = await this.db.query<{
      transaction_id: string;
      reason: string;
      delta: string;
      balance_after: string;
      created_at: Date;
      reference_type: string | null;
      reference_id: string | null;
    }>(
      `SELECT
         t.id AS transaction_id,
         t.reason,
         e.delta,
         e.balance_after,
         e.created_at,
         t.reference_type,
         t.reference_id
       FROM wallet_accounts a
       JOIN ledger_entries e ON e.account_id = a.id
       JOIN ledger_transactions t ON t.id = e.transaction_id
       WHERE a.user_id = $1
       ORDER BY e.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return {
      items: rows.map((row) => ({
        id: row.transaction_id,
        reason: row.reason,
        delta: row.delta,
        balanceAfter: row.balance_after,
        createdAt: row.created_at,
        referenceType: row.reference_type,
        referenceId: row.reference_id
      }))
    };
  }

  async transfer(input: {
    idempotencyKey: string;
    reason:
      | 'signup_bonus'
      | 'referral_reward'
      | 'mission_reward'
      | 'achievement_reward'
      | 'game_entry'
      | 'game_reward'
      | 'ad_reward'
      | 'admin_adjustment'
      | 'reversal';
    actorUserId?: string;
    fromAccountCode: string;
    toAccountCode: string;
    amount: bigint;
    referenceType?: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ transactionId: string }> {
    if (input.amount <= 0n) throw new ConflictException('Amount must be positive');
    if (input.fromAccountCode === input.toAccountCode) {
      throw new ConflictException('Source and destination must differ');
    }

    return this.db.tx(async (client) => {
      await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

      const existing = await client.query<{ id: string }>(
        'SELECT id FROM ledger_transactions WHERE idempotency_key = $1',
        [input.idempotencyKey]
      );
      if (existing.rows[0]) {
        return { transactionId: existing.rows[0].id };
      }

      // Lock accounts in stable lexical order to reduce deadlock risk.
      const codes = [input.fromAccountCode, input.toAccountCode].sort();
      const accountsResult = await client.query<AccountRow>(
        `SELECT id, account_code, account_type, cached_balance, version
         FROM wallet_accounts
         WHERE account_code = ANY($1::text[])
         ORDER BY account_code
         FOR UPDATE`,
        [codes]
      );

      if (accountsResult.rows.length !== 2) {
        throw new NotFoundException('Ledger account not found');
      }

      const byCode = new Map<string, AccountRow>(
        accountsResult.rows.map((a): [string, AccountRow] => [a.account_code, a])
      );
      const from = byCode.get(input.fromAccountCode) as AccountRow;
      const to = byCode.get(input.toAccountCode) as AccountRow;

      const fromBalance = BigInt(from.cached_balance);
      const toBalance = BigInt(to.cached_balance);
      const nextFrom = fromBalance - input.amount;
      const nextTo = toBalance + input.amount;

      if (from.account_type === 'user' && nextFrom < 0n) {
        throw new ConflictException('Insufficient virtual coin balance');
      }
      if (to.account_type === 'user' && nextTo < 0n) {
        throw new ConflictException('Invalid target balance');
      }

      assertBalanced([
        { accountId: from.id, delta: -input.amount },
        { accountId: to.id, delta: input.amount }
      ]);

      const txResult = await client.query<{ id: string }>(
        `INSERT INTO ledger_transactions
          (idempotency_key, reason, actor_user_id, reference_type, reference_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING id`,
        [
          input.idempotencyKey,
          input.reason,
          input.actorUserId ?? null,
          input.referenceType ?? null,
          input.referenceId ?? null,
          JSON.stringify(input.metadata ?? {})
        ]
      );
      const transactionId = txResult.rows[0].id;

      await client.query(
        `UPDATE wallet_accounts
         SET cached_balance = $2, version = version + 1, updated_at = now()
         WHERE id = $1`,
        [from.id, nextFrom.toString()]
      );
      await client.query(
        `UPDATE wallet_accounts
         SET cached_balance = $2, version = version + 1, updated_at = now()
         WHERE id = $1`,
        [to.id, nextTo.toString()]
      );

      await client.query(
        `INSERT INTO ledger_entries
          (transaction_id, account_id, delta, balance_after)
         VALUES
          ($1, $2, $3, $4),
          ($1, $5, $6, $7)`,
        [
          transactionId,
          from.id,
          (-input.amount).toString(),
          nextFrom.toString(),
          to.id,
          input.amount.toString(),
          nextTo.toString()
        ]
      );

      return { transactionId };
    });
  }
}
