import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';

@Injectable()
export class RoomsService {
  constructor(private readonly db: DatabaseService) {}

  private async ensureMember(userId: string, roomId: string) {
    const membership = await this.db.one<{ ok: boolean }>(
      `SELECT true AS ok
       FROM multiplayer_room_players
       WHERE room_id=$1 AND user_id=$2`,
      [roomId, userId]
    );
    if (!membership) throw new ForbiddenException('Not a member of this room');
  }

  async activeForUser(userId: string) {
    const row = await this.db.one<{ room_id: string }>(
      `SELECT rp.room_id
       FROM multiplayer_room_players rp
       JOIN multiplayer_rooms r ON r.id=rp.room_id
       WHERE rp.user_id=$1 AND rp.left_at IS NULL
         AND r.status IN ('open','countdown','in_progress')
       ORDER BY rp.joined_at DESC LIMIT 1`,
      [userId]
    );
    if (!row) return { room: null };
    return { room: await this.getRoom(userId, row.room_id) };
  }

  async getRoom(userId: string, roomId: string) {
    await this.ensureMember(userId, roomId);
    const room = await this.db.one<{
      id: string;
      game_slug: string;
      room_type: string;
      join_code: string | null;
      status: string;
      starts_at: Date | null;
      ends_at: Date | null;
      completed_at: Date | null;
      created_at: Date;
    }>(
      `SELECT id,game_slug,room_type,join_code,status,starts_at,ends_at,completed_at,created_at
       FROM multiplayer_rooms WHERE id=$1`,
      [roomId]
    );
    if (!room) throw new NotFoundException('Room not found');
    const players = await this.db.query<{
      user_id: string;
      username: string;
      display_name: string;
      seat_no: number;
      connected: boolean;
      score: number;
      correct_count: number;
      wrong_count: number;
      last_input_seq: number;
      left_at: Date | null;
    }>(
      `SELECT rp.user_id,p.username,p.display_name,rp.seat_no,rp.connected,
              rp.score,rp.correct_count,rp.wrong_count,rp.last_input_seq,rp.left_at
       FROM multiplayer_room_players rp
       JOIN profiles p ON p.user_id=rp.user_id
       WHERE rp.room_id=$1 ORDER BY rp.seat_no`,
      [roomId]
    );
    const result = await this.db.one<{
      result_kind: string;
      winner_user_id: string | null;
      validated: boolean;
    }>(
      `SELECT result_kind,winner_user_id,validated
       FROM multiplayer_results WHERE room_id=$1`,
      [roomId]
    );
    return {
      id: room.id,
      gameSlug: room.game_slug,
      roomType: room.room_type,
      joinCode: room.room_type === 'private' ? room.join_code : undefined,
      status: room.status,
      startsAt: room.starts_at,
      endsAt: room.ends_at,
      completedAt: room.completed_at,
      createdAt: room.created_at,
      players: players.map((p) => ({
        userId: p.user_id,
        username: p.username,
        displayName: p.display_name,
        seatNo: p.seat_no,
        connected: p.connected,
        score: p.score,
        correct: p.correct_count,
        wrong: p.wrong_count,
        lastInputSeq: p.last_input_seq,
        left: Boolean(p.left_at)
      })),
      result: result ? {
        kind: result.result_kind,
        winnerUserId: result.winner_user_id,
        validated: result.validated
      } : null
    };
  }
}
