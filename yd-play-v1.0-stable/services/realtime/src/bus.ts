import { createClient, RedisClientType } from 'redis';

export class RealtimeBus {
  readonly command: RedisClientType;
  readonly subscriber: RedisClientType;
  constructor(redisUrl: string) {
    this.command = createClient({ url: redisUrl });
    this.subscriber = this.command.duplicate();
  }
  async connect() {
    this.command.on('error', (e: unknown) => console.error('redis command error', e));
    this.subscriber.on('error', (e: unknown) => console.error('redis subscriber error', e));
    await Promise.all([this.command.connect(), this.subscriber.connect()]);
  }
  async publishRoom(roomId: string, payload: object) {
    await this.command.publish(`ydplay:room:${roomId}`, JSON.stringify(payload));
  }
  async publishUser(userId: string, payload: object) {
    await this.command.publish(`ydplay:user:${userId}`, JSON.stringify(payload));
  }
  async setPresence(userId: string, instanceId: string, ttlSeconds: number) {
    await this.command.set(`ydplay:presence:${userId}`, instanceId, { EX: ttlSeconds });
  }
  async clearPresenceIfOwned(userId: string, instanceId: string) {
    const key = `ydplay:presence:${userId}`;
    const current = await this.command.get(key);
    if (current === instanceId) await this.command.del(key);
  }
  async close() {
    await Promise.allSettled([this.command.quit(), this.subscriber.quit()]);
  }
}
