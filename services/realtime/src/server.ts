import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import { loadConfig } from './config';
import { verifyAccessToken } from './jwt';
import { Db } from './db';
import { RealtimeBus } from './bus';
import { RoomService } from './room-service';
import { Matchmaker } from './matchmaking';
import { event, parseClientMessage } from './protocol';

interface SocketContext {
  id: string;
  ws: WebSocket;
  userId: string | null;
  sessionId: string | null;
  authed: boolean;
  alive: boolean;
  messageTimestamps: number[];
}

const config = loadConfig();
const instanceId = randomUUID();
const db = new Db(config.databaseUrl);
const bus = new RealtimeBus(config.redisUrl);
const rooms = new RoomService(db, bus);
const matchmaker = new Matchmaker(bus, rooms);

const sockets = new Set<SocketContext>();
const byUser = new Map<string, Set<SocketContext>>();

function send(ctx: SocketContext, payload: object) {
  if (ctx.ws.readyState === WebSocket.OPEN) ctx.ws.send(JSON.stringify(payload));
}
function sendError(ctx: SocketContext, code: string, message = code) {
  send(ctx, event('error', { code, message }));
}
function addUserSocket(userId: string, ctx: SocketContext) {
  let set = byUser.get(userId);
  if (!set) { set = new Set(); byUser.set(userId, set); }
  set.add(ctx);
}
function removeUserSocket(userId: string, ctx: SocketContext) {
  const set = byUser.get(userId);
  if (!set) return;
  set.delete(ctx);
  if (!set.size) byUser.delete(userId);
}
function broadcastUser(userId: string, payload: object) {
  for (const ctx of byUser.get(userId) ?? []) send(ctx, payload);
}
async function broadcastRoom(roomId: string, payload: object) {
  const members = await db.query<{ user_id: string }>(
    `SELECT user_id FROM multiplayer_room_players WHERE room_id=$1 AND left_at IS NULL`, [roomId]
  );
  for (const m of members) broadcastUser(m.user_id, payload);
}
function rateAllowed(ctx: SocketContext): boolean {
  const now = Date.now();
  ctx.messageTimestamps = ctx.messageTimestamps.filter((t) => now - t < 10_000);
  if (ctx.messageTimestamps.length >= config.maxMessagesPer10s) return false;
  ctx.messageTimestamps.push(now);
  return true;
}

const http = createServer(async (req, res) => {
  const json = (status: number, body: object) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };

  if (req.url === '/health/live') {
    json(200, {
      ok: true,
      service: 'yd-play-realtime',
      version: '1.0.0',
      instanceId,
      uptimeSeconds: Math.floor(process.uptime())
    });
    return;
  }

  if (req.url === '/health' || req.url === '/health/ready') {
    try {
      await db.query('SELECT 1');
      const pong = await bus.command.ping();
      if (pong !== 'PONG') throw new Error('redis ping failed');
      json(200, {
        ok: true,
        service: 'yd-play-realtime',
        version: '1.0.0',
        instanceId,
        dependencies: { database: 'ready', redis: 'ready' }
      });
    } catch {
      json(503, {
        ok: false,
        service: 'yd-play-realtime',
        version: '1.0.0',
        instanceId,
        dependencies: { database: 'unavailable-or-unverified', redis: 'unavailable-or-unverified' }
      });
    }
    return;
  }

  res.writeHead(404);
  res.end();
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024, perMessageDeflate: false });

http.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (url.pathname !== '/ws') { socket.destroy(); return; }
  const origin = req.headers.origin;
  if (config.allowedOrigins.length && origin && !config.allowedOrigins.includes(origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return;
  }
  wss.handleUpgrade(req, socket, head, (ws: WebSocket) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws: WebSocket) => {
  const ctx: SocketContext = {
    id: randomUUID(), ws, userId: null, sessionId: null, authed: false, alive: true, messageTimestamps: []
  };
  sockets.add(ctx);
  const authTimer = setTimeout(() => {
    if (!ctx.authed) ws.close(4401, 'authentication required');
  }, config.authTimeoutMs);

  ws.on('pong', () => { ctx.alive = true; });
  ws.on('message', async (buf: RawData) => {
    if (!rateAllowed(ctx)) { ws.close(4429, 'rate limit'); return; }
    if (buf.length > 16 * 1024) { ws.close(4400, 'message too large'); return; }
    let message;
    try { message = parseClientMessage(buf.toString('utf8')); }
    catch (e: any) { sendError(ctx, e?.message ?? 'invalid_message'); return; }

    try {
      if (!ctx.authed) {
        if (message.type !== 'auth') throw new Error('auth_required');
        const payload = verifyAccessToken(message.token, config.accessSecret);
        if (!(await rooms.validateSession(payload.sub, payload.sid))) throw new Error('session_invalid');
        ctx.userId = payload.sub; ctx.sessionId = payload.sid; ctx.authed = true;
        clearTimeout(authTimer);
        addUserSocket(payload.sub, ctx);
        await bus.setPresence(payload.sub, instanceId, Math.ceil((config.heartbeatMs * 3) / 1000));
        await rooms.markConnected(payload.sub, true);
        send(ctx, event('auth.ok', { userId: payload.sub, instanceId }));
        const activeRoom = await rooms.activeRoomForUser(payload.sub);
        if (activeRoom) send(ctx, event('room.resume', { room: await rooms.snapshot(activeRoom, payload.sub) }));
        return;
      }

      const userId = ctx.userId!;
      switch (message.type) {
        case 'ping':
          await bus.setPresence(userId, instanceId, Math.ceil((config.heartbeatMs * 3) / 1000));
          send(ctx, event('pong', { nonce: message.nonce }));
          break;
        case 'queue.join':
          await matchmaker.join(userId);
          break;
        case 'queue.leave':
          await matchmaker.leave(userId);
          break;
        case 'room.create_private': {
          await matchmaker.leave(userId);
          const room = await rooms.createPrivate(userId);
          send(ctx, event('room.created', { room }));
          break;
        }
        case 'room.join_private': {
          const bucket = Math.floor(Date.now() / 60_000);
          const key = `ydplay:rl:private-join:${userId}:${bucket}`;
          const attempts = await bus.command.incr(key);
          if (attempts === 1) await bus.command.expire(key, 70);
          if (attempts > 10) throw new Error('private_join_rate_limited');
          await matchmaker.leave(userId);
          const room = await rooms.joinPrivate(userId, message.code);
          send(ctx, event('room.joined', { room }));
          break;
        }
        case 'room.leave':
          await matchmaker.leave(userId);
          send(ctx, event('room.left', await rooms.leaveRoom(userId)));
          break;
        case 'game.input':
          await rooms.submitInput(userId, message.roomId, message.roundNo, message.lane, message.seq);
          break;
        case 'auth':
          throw new Error('already_authenticated');
      }
    } catch (e: any) {
      sendError(ctx, e?.message ?? 'request_failed');
    }
  });

  ws.on('close', async () => {
    clearTimeout(authTimer);
    sockets.delete(ctx);
    if (ctx.userId) {
      removeUserSocket(ctx.userId, ctx);
      if (!byUser.has(ctx.userId)) {
        await rooms.markConnected(ctx.userId, false).catch(() => undefined);
        await bus.clearPresenceIfOwned(ctx.userId, instanceId).catch(() => undefined);
      }
    }
  });
});

async function main() {
  await bus.connect();
  await bus.subscriber.pSubscribe('ydplay:user:*', (raw: string, channel: string) => {
    const userId = channel.slice('ydplay:user:'.length);
    try { broadcastUser(userId, JSON.parse(raw)); } catch { /* ignore malformed internal event */ }
  });
  await bus.subscriber.pSubscribe('ydplay:room:*', (raw: string, channel: string) => {
    const roomId = channel.slice('ydplay:room:'.length);
    try { void broadcastRoom(roomId, JSON.parse(raw)); } catch { /* ignore malformed internal event */ }
  });

  const scheduler = setInterval(() => void rooms.schedulerTick().catch((e) => console.error('scheduler', e)), 150);
  const heartbeat = setInterval(() => {
    for (const ctx of sockets) {
      if (!ctx.alive) { ctx.ws.terminate(); continue; }
      ctx.alive = false;
      ctx.ws.ping();
      if (ctx.userId) void bus.setPresence(ctx.userId, instanceId, Math.ceil((config.heartbeatMs * 3) / 1000));
    }
  }, config.heartbeatMs);

  const shutdown = async () => {
    clearInterval(scheduler); clearInterval(heartbeat);
    for (const ctx of sockets) ctx.ws.close(1001, 'server shutdown');
    await Promise.allSettled([bus.close(), db.close()]);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  http.listen(config.port, '0.0.0.0', () => {
    console.log(`YD Play realtime v1.0.0 listening on :${config.port} (ws /ws)`);
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
