import { randomUUID } from 'node:crypto';
import { RealtimeBus } from './bus';
import { RoomService } from './room-service';
import { event } from './protocol';

const QUEUE = 'ydplay:mm:signal-clash:list';
const SET = 'ydplay:mm:signal-clash:set';
const LOCK = 'ydplay:mm:signal-clash:lock';

export class Matchmaker {
  constructor(private readonly bus: RealtimeBus, private readonly rooms: RoomService) {}

  async join(userId: string) {
    if (await this.rooms.activeRoomForUser(userId)) throw new Error('already_in_room');
    const added = await this.bus.command.sAdd(SET, userId);
    if (added) await this.bus.command.rPush(QUEUE, userId);
    await this.bus.publishUser(userId, event('queue.joined', { game: 'signal-clash' }));
    await this.tryPair();
  }

  async leave(userId: string) {
    await this.bus.command.sRem(SET, userId);
    await this.bus.publishUser(userId, event('queue.left', { game: 'signal-clash' }));
  }

  private async popEligible(): Promise<string | null> {
    for (let i = 0; i < 20; i++) {
      const userId = await this.bus.command.lPop(QUEUE);
      if (!userId) return null;
      const queued = await this.bus.command.sIsMember(SET, userId);
      if (!queued) continue;
      const present = await this.bus.command.exists(`ydplay:presence:${userId}`);
      if (!present) {
        await this.bus.command.sRem(SET, userId);
        continue;
      }
      if (await this.rooms.activeRoomForUser(userId)) {
        await this.bus.command.sRem(SET, userId);
        continue;
      }
      return userId;
    }
    return null;
  }

  async tryPair() {
    const lockValue = randomUUID();
    const got = await this.bus.command.set(LOCK, lockValue, { NX: true, PX: 10000 });
    if (!got) return;
    try {
      for (let pairAttempt = 0; pairAttempt < 10; pairAttempt++) {
        const a = await this.popEligible();
        if (!a) break;
        const b = await this.popEligible();
        if (!b) {
          await this.bus.command.rPush(QUEUE, a);
          break;
        }
        try {
          const roomId = await this.rooms.createMatchedRoom(a, b);
          await this.bus.command.sRem(SET, [a, b]);
          const snap = await this.rooms.snapshot(roomId);
          const payload = event('match.found', { room: snap });
          await Promise.all([
            this.bus.publishUser(a, payload),
            this.bus.publishUser(b, payload),
            this.bus.publishRoom(roomId, event('room.updated', { room: snap }))
          ]);
        } catch (error) {
          // Requeue both if pairing failed for a transient race.
          await this.bus.command.rPush(QUEUE, [a, b]);
          throw error;
        }
      }
    } finally {
      await this.bus.command.eval(
        `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`,
        { keys: [LOCK], arguments: [lockValue] }
      );
    }
  }
}
