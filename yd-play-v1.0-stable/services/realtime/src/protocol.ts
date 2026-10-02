export type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'ping'; nonce?: string }
  | { type: 'queue.join' }
  | { type: 'queue.leave' }
  | { type: 'room.create_private' }
  | { type: 'room.join_private'; code: string }
  | { type: 'room.leave' }
  | { type: 'game.input'; roomId: string; roundNo: number; lane: number; seq: number };

export interface ServerEnvelope {
  type: string;
  ts: string;
  requestId?: string;
  [key: string]: unknown;
}

export function parseClientMessage(raw: string): ClientMessage {
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw new Error('invalid_json'); }
  if (!body || typeof body !== 'object') throw new Error('invalid_message');
  const m = body as Record<string, unknown>;
  if (typeof m.type !== 'string') throw new Error('missing_type');

  switch (m.type) {
    case 'auth':
      if (typeof m.token !== 'string' || m.token.length < 20) throw new Error('invalid_token');
      return { type: 'auth', token: m.token };
    case 'ping':
      return { type: 'ping', nonce: typeof m.nonce === 'string' ? m.nonce : undefined };
    case 'queue.join': return { type: 'queue.join' };
    case 'queue.leave': return { type: 'queue.leave' };
    case 'room.create_private': return { type: 'room.create_private' };
    case 'room.join_private':
      if (typeof m.code !== 'string' || !/^[A-Z2-9]{6}$/.test(m.code.toUpperCase())) throw new Error('invalid_room_code');
      return { type: 'room.join_private', code: m.code.toUpperCase() };
    case 'room.leave': return { type: 'room.leave' };
    case 'game.input':
      if (typeof m.roomId !== 'string' || typeof m.roundNo !== 'number' || typeof m.lane !== 'number' || typeof m.seq !== 'number') {
        throw new Error('invalid_game_input');
      }
      if (!Number.isInteger(m.roundNo) || !Number.isInteger(m.lane) || !Number.isInteger(m.seq)) throw new Error('invalid_game_input');
      return { type: 'game.input', roomId: m.roomId, roundNo: m.roundNo, lane: m.lane, seq: m.seq };
    default: throw new Error('unknown_type');
  }
}

export function event(type: string, data: Record<string, unknown> = {}): ServerEnvelope {
  return { type, ts: new Date().toISOString(), ...data };
}
