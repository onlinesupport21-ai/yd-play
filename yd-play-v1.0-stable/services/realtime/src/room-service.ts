import { randomBytes } from 'node:crypto';
import { PoolClient } from 'pg';
import { Db } from './db';
import { RealtimeBus } from './bus';
import { buildRounds, judgeInput, matchEndsAtMs, resultFor, SIGNAL_CLASH_CONFIG } from './signal-clash.engine';
import { event } from './protocol';

const GAME_SLUG = 'signal-clash';
const JOIN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface RoomRow extends Record<string, unknown> {
  id: string;
  room_type: 'public' | 'private';
  join_code: string | null;
  status: 'open' | 'countdown' | 'in_progress' | 'completed' | 'cancelled';
  host_user_id: string | null;
  seed_secret: string | null;
  config_snapshot: typeof SIGNAL_CLASH_CONFIG;
  starts_at: Date | null;
  ends_at: Date | null;
  created_at: Date;
}

interface PlayerRow extends Record<string, unknown> {
  user_id: string;
  seat_no: number;
  connected: boolean;
  score: number;
  correct_count: number;
  wrong_count: number;
  last_input_seq: number;
  joined_at: Date;
  disconnected_at: Date | null;
  left_at: Date | null;
}

function joinCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => JOIN_ALPHABET[b % JOIN_ALPHABET.length]).join('');
}

export class RoomService {
  constructor(private readonly db: Db, private readonly bus: RealtimeBus) {}

  async validateSession(userId: string, sessionId: string): Promise<boolean> {
    const row = await this.db.one<{ ok: boolean }>(
      `SELECT true AS ok
       FROM users u
       JOIN sessions s ON s.user_id = u.id
       WHERE u.id = $1 AND s.id = $2
         AND u.status = 'active'
         AND s.revoked_at IS NULL
         AND s.expires_at > now()`,
      [userId, sessionId]
    );
    return Boolean(row?.ok);
  }

  async activeRoomForUser(userId: string): Promise<string | null> {
    const row = await this.db.one<{ room_id: string }>(
      `SELECT rp.room_id
       FROM multiplayer_room_players rp
       JOIN multiplayer_rooms r ON r.id = rp.room_id
       WHERE rp.user_id = $1
         AND rp.left_at IS NULL
         AND r.status IN ('open','countdown','in_progress')
       ORDER BY rp.joined_at DESC LIMIT 1`,
      [userId]
    );
    return row?.room_id ?? null;
  }

  async markConnected(userId: string, connected: boolean) {
    await this.db.query(
      `UPDATE multiplayer_room_players rp
       SET connected = $2,
           disconnected_at = CASE WHEN $2 THEN NULL ELSE now() END
       FROM multiplayer_rooms r
       WHERE rp.room_id = r.id
         AND rp.user_id = $1
         AND rp.left_at IS NULL
         AND r.status IN ('open','countdown','in_progress')`,
      [userId, connected]
    );
  }

  async snapshot(roomId: string, viewerUserId?: string) {
    const room = await this.db.one<RoomRow>(
      `SELECT id, room_type, join_code, status, host_user_id, seed_secret,
              config_snapshot, starts_at, ends_at, created_at
       FROM multiplayer_rooms WHERE id = $1`,
      [roomId]
    );
    if (!room) throw new Error('room_not_found');
    const players = await this.db.query<PlayerRow>(
      `SELECT user_id, seat_no, connected, score, correct_count, wrong_count,
              last_input_seq, joined_at, disconnected_at, left_at
       FROM multiplayer_room_players
       WHERE room_id = $1 AND left_at IS NULL ORDER BY seat_no`,
      [roomId]
    );
    if (viewerUserId && !players.some((p) => p.user_id === viewerUserId)) throw new Error('not_in_room');

    const now = new Date();
    const current = await this.db.one<{ round_no: number; target_lane: number; opens_at: Date; closes_at: Date }>(
      `SELECT round_no, target_lane, opens_at, closes_at
       FROM multiplayer_rounds
       WHERE room_id = $1 AND opens_at <= $2 AND closes_at > $2
       ORDER BY round_no LIMIT 1`,
      [roomId, now]
    );
    const next = await this.db.one<{ round_no: number; opens_at: Date }>(
      `SELECT round_no, opens_at
       FROM multiplayer_rounds
       WHERE room_id = $1 AND opens_at > $2
       ORDER BY round_no LIMIT 1`,
      [roomId, now]
    );

    return {
      id: room.id,
      roomType: room.room_type,
      joinCode: room.room_type === 'private' ? room.join_code : undefined,
      status: room.status,
      startsAt: room.starts_at,
      endsAt: room.ends_at,
      serverNow: now,
      reconnectGraceMs: Number(room.config_snapshot?.reconnectGraceMs ?? SIGNAL_CLASH_CONFIG.reconnectGraceMs),
      players: players.map((p) => ({
        userId: p.user_id,
        seatNo: p.seat_no,
        connected: p.connected,
        score: p.score,
        correct: p.correct_count,
        wrong: p.wrong_count,
        lastInputSeq: p.last_input_seq
      })),
      currentRound: current ? {
        roundNo: current.round_no,
        targetLane: current.target_lane,
        opensAt: current.opens_at,
        closesAt: current.closes_at
      } : null,
      nextRound: next ? { roundNo: next.round_no, opensAt: next.opens_at } : null
    };
  }

  async createPrivate(userId: string) {
    if (await this.activeRoomForUser(userId)) throw new Error('already_in_room');
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = joinCode();
      try {
        const room = await this.db.tx(async (client) => {
          await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [userId]);
          const busy = await client.query<{ room_id: string }>(
            `SELECT rp.room_id FROM multiplayer_room_players rp
             JOIN multiplayer_rooms r ON r.id=rp.room_id
             WHERE rp.user_id=$1 AND rp.left_at IS NULL
               AND r.status IN ('open','countdown','in_progress') LIMIT 1`,
            [userId]
          );
          if (busy.rows[0]) throw new Error('already_in_room');
          const rr = await client.query<{ id: string }>(
            `INSERT INTO multiplayer_rooms
              (game_slug, room_type, join_code, status, host_user_id, max_players, config_snapshot)
             VALUES ($1, 'private', $2, 'open', $3, 2, $4::jsonb)
             RETURNING id`,
            [GAME_SLUG, code, userId, JSON.stringify(SIGNAL_CLASH_CONFIG)]
          );
          const roomId = rr.rows[0].id;
          await client.query(
            `INSERT INTO multiplayer_room_players (room_id, user_id, seat_no, connected)
             VALUES ($1,$2,1,true)`,
            [roomId, userId]
          );
          return roomId;
        });
        return await this.snapshot(room, userId);
      } catch (e: any) {
        if (e?.code === '23505') continue;
        throw e;
      }
    }
    throw new Error('room_code_generation_failed');
  }

  async joinPrivate(userId: string, code: string) {
    if (await this.activeRoomForUser(userId)) throw new Error('already_in_room');
    const roomId = await this.db.tx(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [userId]);
      const busy = await client.query<{ room_id: string }>(
        `SELECT rp.room_id FROM multiplayer_room_players rp
         JOIN multiplayer_rooms r ON r.id=rp.room_id
         WHERE rp.user_id=$1 AND rp.left_at IS NULL
           AND r.status IN ('open','countdown','in_progress') LIMIT 1`,
        [userId]
      );
      if (busy.rows[0]) throw new Error('already_in_room');
      const rr = await client.query<RoomRow>(
        `SELECT * FROM multiplayer_rooms
         WHERE join_code = $1 AND room_type = 'private'
         FOR UPDATE`,
        [code]
      );
      const room = rr.rows[0];
      if (!room || room.status !== 'open') throw new Error('room_unavailable');
      const countRes = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM multiplayer_room_players
         WHERE room_id = $1 AND left_at IS NULL`,
        [room.id]
      );
      if (Number(countRes.rows[0].n) >= 2) throw new Error('room_full');
      await client.query(
        `INSERT INTO multiplayer_room_players (room_id,user_id,seat_no,connected)
         VALUES ($1,$2,2,true)`,
        [room.id, userId]
      );
      await this.startMatchTx(client, room.id);
      return room.id;
    });
    const snap = await this.snapshot(roomId, userId);
    await this.bus.publishRoom(roomId, event('room.updated', { room: snap }));
    return snap;
  }

  async createMatchedRoom(userA: string, userB: string): Promise<string> {
    if (userA === userB) throw new Error('invalid_match');
    if (await this.activeRoomForUser(userA)) throw new Error('player_a_busy');
    if (await this.activeRoomForUser(userB)) throw new Error('player_b_busy');
    const roomId = await this.db.tx(async (client) => {
      const ordered = [userA, userB].sort();
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [ordered[0]]);
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [ordered[1]]);
      const busy = await client.query<{ user_id: string }>(
        `SELECT rp.user_id FROM multiplayer_room_players rp
         JOIN multiplayer_rooms r ON r.id=rp.room_id
         WHERE rp.user_id = ANY($1::uuid[]) AND rp.left_at IS NULL
           AND r.status IN ('open','countdown','in_progress')`,
        [[userA, userB]]
      );
      if (busy.rows.some((x) => x.user_id === userA)) throw new Error('player_a_busy');
      if (busy.rows.some((x) => x.user_id === userB)) throw new Error('player_b_busy');
      const rr = await client.query<{ id: string }>(
        `INSERT INTO multiplayer_rooms
          (game_slug, room_type, status, host_user_id, max_players, config_snapshot)
         VALUES ($1,'public','open',$2,2,$3::jsonb) RETURNING id`,
        [GAME_SLUG, userA, JSON.stringify(SIGNAL_CLASH_CONFIG)]
      );
      const id = rr.rows[0].id;
      await client.query(
        `INSERT INTO multiplayer_room_players (room_id,user_id,seat_no,connected)
         VALUES ($1,$2,1,true),($1,$3,2,true)`,
        [id, userA, userB]
      );
      await this.startMatchTx(client, id);
      return id;
    });
    return roomId;
  }

  private async startMatchTx(client: PoolClient, roomId: string) {
    const seed = randomBytes(32).toString('hex');
    const startsAtMs = Date.now() + SIGNAL_CLASH_CONFIG.countdownMs;
    const rounds = buildRounds(seed, startsAtMs, SIGNAL_CLASH_CONFIG);
    const endsAtMs = matchEndsAtMs(rounds);
    await client.query(
      `UPDATE multiplayer_rooms
       SET status='countdown', seed_secret=$2, starts_at=$3, ends_at=$4,
           config_snapshot=$5::jsonb, updated_at=now()
       WHERE id=$1`,
      [roomId, seed, new Date(startsAtMs), new Date(endsAtMs), JSON.stringify(SIGNAL_CLASH_CONFIG)]
    );
    for (const round of rounds) {
      await client.query(
        `INSERT INTO multiplayer_rounds
          (room_id, round_no, target_lane, opens_at, closes_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [roomId, round.roundNo, round.targetLane, new Date(round.opensAtMs), new Date(round.closesAtMs)]
      );
    }
  }

  async leaveRoom(userId: string) {
    const roomId = await this.activeRoomForUser(userId);
    if (!roomId) return { left: false };
    const status = await this.db.tx(async (client) => {
      const rr = await client.query<{ status: string }>(`SELECT status FROM multiplayer_rooms WHERE id=$1 FOR UPDATE`, [roomId]);
      const state = rr.rows[0]?.status;
      await client.query(
        `UPDATE multiplayer_room_players SET left_at=now(), connected=false WHERE room_id=$1 AND user_id=$2`,
        [roomId, userId]
      );
      if (state === 'open' || state === 'countdown') {
        const n = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM multiplayer_room_players WHERE room_id=$1 AND left_at IS NULL`, [roomId]);
        if (Number(n.rows[0].n) < 2) {
          await client.query(`UPDATE multiplayer_rooms SET status='cancelled', updated_at=now() WHERE id=$1 AND status IN ('open','countdown')`, [roomId]);
        }
      }
      return state;
    });
    await this.bus.publishRoom(roomId, event('room.player_left', { userId, previousStatus: status }));
    return { left: true, roomId };
  }

  async submitInput(userId: string, roomId: string, roundNo: number, lane: number, seq: number) {
    const out = await this.db.tx(async (client) => {
      const roomRes = await client.query<RoomRow>(
        `SELECT * FROM multiplayer_rooms WHERE id=$1 FOR UPDATE`, [roomId]
      );
      const room = roomRes.rows[0];
      if (!room || !['countdown','in_progress'].includes(room.status)) throw new Error('match_not_active');
      const playerRes = await client.query<PlayerRow>(
        `SELECT * FROM multiplayer_room_players WHERE room_id=$1 AND user_id=$2 AND left_at IS NULL FOR UPDATE`,
        [roomId, userId]
      );
      const player = playerRes.rows[0];
      if (!player) throw new Error('not_in_room');
      if (seq <= player.last_input_seq) {
        const existing = await client.query<{ seq: number; round_no: number; lane: number; outcome: string; score_after: number }>(
          `SELECT seq, round_no, lane, outcome, score_after
           FROM multiplayer_inputs WHERE room_id=$1 AND user_id=$2 AND seq=$3`,
          [roomId, userId, seq]
        );
        const ex = existing.rows[0];
        if (ex && ex.round_no === roundNo && ex.lane === lane) return { duplicate: true, ...ex };
        throw new Error('sequence_reuse');
      }
      if (seq !== player.last_input_seq + 1) throw new Error('sequence_gap');
      const roundRes = await client.query<{ target_lane: number; opens_at: Date; closes_at: Date }>(
        `SELECT target_lane, opens_at, closes_at FROM multiplayer_rounds WHERE room_id=$1 AND round_no=$2`,
        [roomId, roundNo]
      );
      const round = roundRes.rows[0];
      if (!round) throw new Error('round_not_found');
      const now = new Date();
      if (now < round.opens_at) throw new Error('round_not_open');
      if (now > round.closes_at) throw new Error('round_closed');
      const already = await client.query<{ id: number }>(
        `SELECT id FROM multiplayer_inputs WHERE room_id=$1 AND user_id=$2 AND round_no=$3`,
        [roomId, userId, roundNo]
      );
      if (already.rows[0]) throw new Error('round_already_answered');
      const judged = judgeInput(round.target_lane, lane, room.config_snapshot ?? SIGNAL_CLASH_CONFIG);
      const scoreAfter = player.score + judged.points;
      await client.query(
        `INSERT INTO multiplayer_inputs
          (room_id,user_id,round_no,seq,lane,outcome,points_awarded,score_after,received_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
        [roomId,userId,roundNo,seq,lane,judged.outcome,judged.points,scoreAfter]
      );
      await client.query(
        `UPDATE multiplayer_room_players
         SET last_input_seq=$3, score=$4,
             correct_count=correct_count + CASE WHEN $5='correct' THEN 1 ELSE 0 END,
             wrong_count=wrong_count + CASE WHEN $5='wrong' OR $5='invalid_lane' THEN 1 ELSE 0 END
         WHERE room_id=$1 AND user_id=$2`,
        [roomId,userId,seq,scoreAfter,judged.outcome]
      );
      return { duplicate: false, seq, round_no: roundNo, lane, outcome: judged.outcome, score_after: scoreAfter, points: judged.points };
    });
    await this.bus.publishUser(userId, event('game.input_result', { roomId, ...out }));
    const snap = await this.snapshot(roomId, userId);
    await this.bus.publishRoom(roomId, event('game.scoreboard', { roomId, players: snap.players }));
    return out;
  }

  async schedulerTick() {
    const started = await this.db.query<{ id: string }>(
      `UPDATE multiplayer_rooms
       SET status='in_progress', updated_at=now()
       WHERE status='countdown' AND starts_at <= now() AND ends_at > now()
       RETURNING id`
    );
    for (const r of started) {
      const snap = await this.snapshot(r.id);
      await this.bus.publishRoom(r.id, event('game.started', { room: snap }));
    }

    const rounds = await this.db.query<{ id: number; room_id: string; round_no: number; target_lane: number; opens_at: Date; closes_at: Date }>(
      `UPDATE multiplayer_rounds mr
       SET announced_at=now()
       FROM multiplayer_rooms r
       WHERE mr.room_id=r.id
         AND r.status='in_progress'
         AND mr.announced_at IS NULL
         AND mr.opens_at <= now()
         AND mr.closes_at > now()
       RETURNING mr.id, mr.room_id, mr.round_no, mr.target_lane, mr.opens_at, mr.closes_at`
    );
    for (const round of rounds) {
      await this.bus.publishRoom(round.room_id, event('game.round', {
        roomId: round.room_id,
        roundNo: round.round_no,
        targetLane: round.target_lane,
        opensAt: round.opens_at,
        closesAt: round.closes_at
      }));
    }

    const due = await this.db.query<{ id: string }>(
      `SELECT id FROM multiplayer_rooms
       WHERE status IN ('countdown','in_progress') AND ends_at IS NOT NULL AND ends_at <= now()
       ORDER BY ends_at LIMIT 50`
    );
    for (const r of due) await this.completeRoom(r.id);
  }

  private async completeRoom(roomId: string) {
    const result = await this.db.tx(async (client) => {
      const lock = await client.query<{ status: string }>(`SELECT status FROM multiplayer_rooms WHERE id=$1 FOR UPDATE`, [roomId]);
      if (!lock.rows[0] || lock.rows[0].status === 'completed') return null;
      const playersRes = await client.query<{ user_id: string; score: number; correct_count: number; wrong_count: number }>(
        `SELECT user_id,score,correct_count,wrong_count FROM multiplayer_room_players WHERE room_id=$1 ORDER BY seat_no`, [roomId]
      );
      if (playersRes.rows.length !== 2) {
        await client.query(`UPDATE multiplayer_rooms SET status='cancelled', updated_at=now() WHERE id=$1`, [roomId]);
        return { cancelled: true };
      }
      const outcome = resultFor(playersRes.rows.map((x) => ({ userId: x.user_id, score: x.score })));
      await client.query(`UPDATE multiplayer_rooms SET status='completed', completed_at=now(), updated_at=now() WHERE id=$1`, [roomId]);
      await client.query(
        `INSERT INTO multiplayer_results (room_id,result_kind,winner_user_id,results,validated)
         VALUES ($1,$2,$3,$4::jsonb,true)
         ON CONFLICT (room_id) DO NOTHING`,
        [roomId,outcome.kind,outcome.winnerUserId,JSON.stringify(playersRes.rows)]
      );
      return { cancelled: false, outcome, players: playersRes.rows };
    });
    if (result) await this.bus.publishRoom(roomId, event(result.cancelled ? 'game.cancelled' : 'game.completed', { roomId, ...result }));
  }
}
