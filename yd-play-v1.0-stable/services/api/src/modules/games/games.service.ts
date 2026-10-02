import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../../common/database/database.service';
import { WalletService } from '../wallet/wallet.service';
import { EngagementService } from '../engagement/engagement.service';
import {
  buildPulseSchedule,
  calculatePulseReward,
  hashSchedule,
  PulseGridConfig,
  PulseInput,
  replayPulseGrid
} from './pulse-grid.engine';

interface GameConfigRow {
  game_id: string;
  game_slug: string;
  game_name: string;
  config_version: number;
  config: PulseGridConfig;
}

interface SessionRow {
  id: string;
  game_id: string;
  user_id: string;
  status: 'active' | 'completed' | 'invalidated' | 'cancelled';
  seed_secret: string;
  schedule_hash: string;
  config_snapshot: PulseGridConfig;
  started_at: Date;
  ended_at: Date | null;
  last_input_seq: number;
  server_score: number;
  hits: number;
  misses: number;
  max_combo: number;
  anti_cheat: Record<string, unknown>;
}

@Injectable()
export class GamesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly wallet: WalletService,
    private readonly engagement: EngagementService
  ) {}

  async listGames() {
    const rows = await this.db.query<{
      id: string;
      slug: string;
      name: string;
      game_type: string;
      is_active: boolean;
    }>(
      `SELECT id, slug, name, game_type, is_active
       FROM games
       WHERE is_active = true
       ORDER BY name`
    );
    return { items: rows };
  }

  private async activePulseConfig(): Promise<GameConfigRow> {
    const row = await this.db.one<GameConfigRow>(
      `SELECT
         g.id AS game_id,
         g.slug AS game_slug,
         g.name AS game_name,
         c.version AS config_version,
         c.config
       FROM games g
       JOIN game_configs c ON c.game_id = g.id
       WHERE g.slug = 'pulse-grid'
         AND g.is_active = true
         AND c.is_active = true
       ORDER BY c.version DESC
       LIMIT 1`
    );
    if (!row) throw new NotFoundException('Pulse Grid is not available');
    return row;
  }

  async startPulseGrid(userId: string) {
    const game = await this.activePulseConfig();
    const seed = randomBytes(32).toString('hex');
    const schedule = buildPulseSchedule(seed, game.config);
    const scheduleHash = hashSchedule(schedule);

    const session = await this.db.one<{
      id: string;
      started_at: Date;
    }>(
      `INSERT INTO game_sessions
        (game_id, user_id, status, seed_secret, schedule_hash, config_snapshot, started_at)
       VALUES ($1, $2, 'active', $3, $4, $5::jsonb, now())
       RETURNING id, started_at`,
      [game.game_id, userId, seed, scheduleHash, JSON.stringify(game.config)]
    );
    if (!session) throw new Error('Failed to create game session');

    const serverNow = new Date();
    return {
      id: session.id,
      game: {
        slug: game.game_slug,
        name: game.game_name,
        configVersion: game.config_version
      },
      status: 'active',
      startedAt: session.started_at,
      serverNow,
      durationMs: game.config.durationMs,
      hitWindowMs: game.config.hitWindowMs,
      lanes: game.config.lanes,
      cueLookaheadMs: 1200,
      scheduleHash,
      disclaimer: 'Virtual coins have no real-world value and cannot be cashed out.'
    };
  }


  async getCues(userId: string, sessionId: string, afterIndex = -1) {
    const session = await this.db.one<SessionRow>(
      `SELECT id, game_id, user_id, status, seed_secret, schedule_hash,
              config_snapshot, started_at, ended_at, last_input_seq,
              server_score, hits, misses, max_combo, anti_cheat
       FROM game_sessions
       WHERE id = $1`,
      [sessionId]
    );
    if (!session) throw new NotFoundException('Game session not found');
    if (session.user_id !== userId) throw new ForbiddenException();
    if (session.status !== 'active') return { items: [], status: session.status };

    const serverNow = new Date();
    const serverElapsedMs = Math.max(0, serverNow.getTime() - session.started_at.getTime());
    const releaseThroughMs = Math.min(
      session.config_snapshot.durationMs,
      serverElapsedMs + 1200
    );
    const schedule = buildPulseSchedule(session.seed_secret, session.config_snapshot);
    const items = schedule.filter(
      (target) => target.index > afterIndex && target.timeMs <= releaseThroughMs
    );

    return {
      items,
      serverNow,
      serverElapsedMs,
      releaseThroughMs,
      scheduleHash: session.schedule_hash
    };
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.db.one<SessionRow>(
      `SELECT id, game_id, user_id, status, seed_secret, schedule_hash,
              config_snapshot, started_at, ended_at, last_input_seq,
              server_score, hits, misses, max_combo, anti_cheat
       FROM game_sessions
       WHERE id = $1`,
      [sessionId]
    );
    if (!session) throw new NotFoundException('Game session not found');
    if (session.user_id !== userId) throw new ForbiddenException();

    const now = Date.now();
    return {
      id: session.id,
      status: session.status,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      serverElapsedMs: Math.max(0, now - session.started_at.getTime()),
      lastInputSeq: session.last_input_seq,
      score: session.server_score,
      hits: session.hits,
      misses: session.misses,
      maxCombo: session.max_combo,
      antiCheat: session.anti_cheat
    };
  }

  async submitInput(
    userId: string,
    sessionId: string,
    input: PulseInput
  ) {
    return this.db.tx(async (client) => {
      const result = await client.query<SessionRow>(
        `SELECT id, game_id, user_id, status, seed_secret, schedule_hash,
                config_snapshot, started_at, ended_at, last_input_seq,
                server_score, hits, misses, max_combo, anti_cheat
         FROM game_sessions
         WHERE id = $1
         FOR UPDATE`,
        [sessionId]
      );
      const session = result.rows[0];
      if (!session) throw new NotFoundException('Game session not found');
      if (session.user_id !== userId) throw new ForbiddenException();
      if (session.status !== 'active') {
        throw new ConflictException('Game session is not active');
      }

      const config = session.config_snapshot;
      const serverElapsed = Date.now() - session.started_at.getTime();
      if (serverElapsed > config.durationMs + config.maxLateInputMs) {
        throw new ConflictException('Game session input window has closed');
      }
      if (input.elapsedMs > serverElapsed + config.maxFutureSkewMs) {
        throw new ConflictException('Input timestamp is ahead of server time');
      }
      if (input.elapsedMs < Math.max(0, serverElapsed - config.maxLateInputMs)) {
        throw new ConflictException('Input arrived too late');
      }

      if (input.seq <= session.last_input_seq) {
        const existing = await client.query<{
          seq: number;
          elapsed_ms: number;
          lane: number;
          outcome: string;
          target_index: number | null;
          score_after: number;
          combo_after: number;
          replay_hash: string;
        }>(
          `SELECT seq, elapsed_ms, lane, outcome, target_index,
                  score_after, combo_after, replay_hash
           FROM game_inputs
           WHERE session_id = $1 AND seq = $2`,
          [sessionId, input.seq]
        );
        const row = existing.rows[0];
        if (row && row.elapsed_ms === input.elapsedMs && row.lane === input.lane) {
          return {
            accepted: true,
            duplicate: true,
            seq: row.seq,
            outcome: row.outcome,
            targetIndex: row.target_index,
            score: row.score_after,
            combo: row.combo_after,
            replayHash: row.replay_hash
          };
        }
        throw new ConflictException('Sequence already used with different input');
      }

      if (input.seq !== session.last_input_seq + 1) {
        throw new ConflictException(`Expected input sequence ${session.last_input_seq + 1}`);
      }

      const existingInputs = await client.query<PulseInput & { elapsed_ms: number }>(
        `SELECT seq, elapsed_ms, lane
         FROM game_inputs
         WHERE session_id = $1
         ORDER BY seq`,
        [sessionId]
      );
      const inputs: PulseInput[] = existingInputs.rows.map((row) => ({
        seq: row.seq,
        elapsedMs: row.elapsed_ms,
        lane: row.lane
      }));
      inputs.push(input);

      const replay = replayPulseGrid(session.seed_secret, config, inputs);
      const event = replay.events[replay.events.length - 1];
      const hardFlags = replay.flags.filter((flag) =>
        ['sequence_gap', 'input_out_of_range', 'invalid_lane', 'non_monotonic_time', 'impossible_input_rate'].includes(flag)
      );

      await client.query(
        `INSERT INTO game_inputs
          (session_id, seq, elapsed_ms, lane, outcome, target_index,
           score_after, combo_after, replay_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          sessionId,
          input.seq,
          input.elapsedMs,
          input.lane,
          event.outcome,
          event.targetIndex,
          event.scoreAfter,
          event.comboAfter,
          replay.replayHash
        ]
      );

      await client.query(
        `UPDATE game_sessions
         SET last_input_seq = $2,
             server_score = $3,
             hits = $4,
             misses = $5,
             max_combo = $6,
             anti_cheat = $7::jsonb,
             updated_at = now()
         WHERE id = $1`,
        [
          sessionId,
          input.seq,
          replay.score,
          replay.hits,
          replay.misses,
          replay.maxCombo,
          JSON.stringify({ flags: hardFlags, speedViolations: replay.speedViolations })
        ]
      );

      return {
        accepted: true,
        duplicate: false,
        seq: input.seq,
        outcome: event.outcome,
        targetIndex: event.targetIndex,
        score: replay.score,
        combo: replay.combo,
        maxCombo: replay.maxCombo,
        hits: replay.hits,
        misses: replay.misses,
        replayHash: replay.replayHash
      };
    });
  }

  async completeSession(
    userId: string,
    sessionId: string,
    claimedScore?: number
  ) {
    const finalized = await this.db.tx(async (client) => {
      const result = await client.query<SessionRow>(
        `SELECT id, game_id, user_id, status, seed_secret, schedule_hash,
                config_snapshot, started_at, ended_at, last_input_seq,
                server_score, hits, misses, max_combo, anti_cheat
         FROM game_sessions
         WHERE id = $1
         FOR UPDATE`,
        [sessionId]
      );
      const session = result.rows[0];
      if (!session) throw new NotFoundException('Game session not found');
      if (session.user_id !== userId) throw new ForbiddenException();

      const existingResult = await client.query<{
        validated: boolean;
        server_score: number;
        claimed_score: number | null;
        reward_coins: number;
        reward_status: string;
        replay_hash: string;
        anti_cheat: Record<string, unknown>;
        hits: number;
        misses: number;
        max_combo: number;
        accuracy: number;
      }>(
        `SELECT validated, server_score, claimed_score, reward_coins,
                reward_status, replay_hash, anti_cheat, hits, misses,
                max_combo, accuracy
         FROM game_results
         WHERE session_id = $1`,
        [sessionId]
      );
      if (existingResult.rows[0]) {
        return { session, result: existingResult.rows[0] };
      }

      if (session.status !== 'active') {
        throw new ConflictException('Game session cannot be completed');
      }

      const serverElapsed = Date.now() - session.started_at.getTime();
      if (serverElapsed < session.config_snapshot.durationMs - 250) {
        throw new ConflictException('Game is still in progress');
      }

      const inputRows = await client.query<{ seq: number; elapsed_ms: number; lane: number }>(
        `SELECT seq, elapsed_ms, lane
         FROM game_inputs
         WHERE session_id = $1
         ORDER BY seq`,
        [sessionId]
      );
      const inputs = inputRows.rows.map((row) => ({
        seq: row.seq,
        elapsedMs: row.elapsed_ms,
        lane: row.lane
      }));
      const replay = replayPulseGrid(session.seed_secret, session.config_snapshot, inputs);
      const schedule = buildPulseSchedule(session.seed_secret, session.config_snapshot);
      const flags = new Set(replay.flags);

      if (hashSchedule(schedule) !== session.schedule_hash) flags.add('schedule_hash_mismatch');
      if (
        replay.score !== session.server_score ||
        replay.hits !== session.hits ||
        replay.misses !== session.misses ||
        replay.maxCombo !== session.max_combo
      ) {
        flags.add('server_state_mismatch');
      }
      if (claimedScore !== undefined && claimedScore !== replay.score) {
        flags.add('client_score_mismatch');
      }

      const hardFlags = [...flags].filter((flag) => flag !== 'client_score_mismatch');
      const validated = hardFlags.length === 0;
      const rewardCoins = validated
        ? calculatePulseReward(replay.score, session.config_snapshot)
        : 0;
      const newStatus = validated ? 'completed' : 'invalidated';
      const antiCheat = {
        flags: [...flags].sort(),
        speedViolations: replay.speedViolations,
        validationVersion: 'pulse-grid-v1'
      };

      await client.query(
        `INSERT INTO game_results
          (session_id, validated, validation_version, server_score, claimed_score,
           hits, misses, max_combo, accuracy, reward_coins, reward_status,
           replay_hash, anti_cheat)
         VALUES ($1,$2,'pulse-grid-v1',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
        [
          sessionId,
          validated,
          replay.score,
          claimedScore ?? null,
          replay.hits,
          replay.misses,
          replay.maxCombo,
          replay.accuracy,
          rewardCoins,
          rewardCoins > 0 ? 'pending' : 'none',
          replay.replayHash,
          JSON.stringify(antiCheat)
        ]
      );

      await client.query(
        `UPDATE game_sessions
         SET status = $2,
             ended_at = now(),
             server_score = $3,
             hits = $4,
             misses = $5,
             max_combo = $6,
             anti_cheat = $7::jsonb,
             updated_at = now()
         WHERE id = $1`,
        [
          sessionId,
          newStatus,
          replay.score,
          replay.hits,
          replay.misses,
          replay.maxCombo,
          JSON.stringify(antiCheat)
        ]
      );

      return {
        session: { ...session, status: newStatus, server_score: replay.score },
        result: {
          validated,
          server_score: replay.score,
          claimed_score: claimedScore ?? null,
          reward_coins: rewardCoins,
          reward_status: rewardCoins > 0 ? 'pending' : 'none',
          replay_hash: replay.replayHash,
          anti_cheat: antiCheat,
          hits: replay.hits,
          misses: replay.misses,
          max_combo: replay.maxCombo,
          accuracy: replay.accuracy
        }
      };
    });

    let rewardStatus = finalized.result.reward_status;
    let rewardTransactionId: string | null = null;
    if (finalized.result.validated && finalized.result.reward_coins > 0) {
      const transfer = await this.wallet.transfer({
        idempotencyKey: `game-reward:${sessionId}`,
        reason: 'game_reward',
        actorUserId: userId,
        fromAccountCode: 'SYSTEM:GAME_REWARDS',
        toAccountCode: `USER:${userId}`,
        amount: BigInt(finalized.result.reward_coins),
        referenceType: 'game_session',
        referenceId: sessionId,
        metadata: {
          game: 'pulse-grid',
          score: finalized.result.server_score,
          replayHash: finalized.result.replay_hash
        }
      });
      rewardTransactionId = transfer.transactionId;
      rewardStatus = 'granted';
      await this.db.query(
        `UPDATE game_results
         SET reward_status = 'granted', reward_transaction_id = $2
         WHERE session_id = $1`,
        [sessionId, rewardTransactionId]
      );
    }

    await this.engagement.recordPulseGridResult({
      userId,
      sessionId,
      score: finalized.result.server_score,
      maxCombo: finalized.result.max_combo,
      validated: finalized.result.validated
    });

    return {
      sessionId,
      status: finalized.result.validated ? 'completed' : 'invalidated',
      validated: finalized.result.validated,
      authoritativeScore: finalized.result.server_score,
      claimedScore: finalized.result.claimed_score,
      hits: finalized.result.hits,
      misses: finalized.result.misses,
      maxCombo: finalized.result.max_combo,
      accuracy: finalized.result.accuracy,
      reward: {
        currencyCode: 'COIN',
        amount: finalized.result.reward_coins,
        status: rewardStatus,
        transactionId: rewardTransactionId,
        cashValue: 0,
        cashOut: false
      },
      replayHash: finalized.result.replay_hash,
      antiCheat: finalized.result.anti_cheat
    };
  }
}
