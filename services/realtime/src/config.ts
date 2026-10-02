export interface RealtimeConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  accessSecret: string;
  allowedOrigins: string[];
  authTimeoutMs: number;
  heartbeatMs: number;
  maxMessagesPer10s: number;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function loadConfig(): RealtimeConfig {
  const cfg = {
    port: Number(process.env.REALTIME_PORT ?? 3001),
    databaseUrl: required('DATABASE_URL'),
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    accessSecret: required('JWT_ACCESS_SECRET'),
    allowedOrigins: (process.env.REALTIME_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
    authTimeoutMs: Number(process.env.REALTIME_AUTH_TIMEOUT_MS ?? 5000),
    heartbeatMs: Number(process.env.REALTIME_HEARTBEAT_MS ?? 15000),
    maxMessagesPer10s: Number(process.env.REALTIME_MAX_MESSAGES_PER_10S ?? 60)
  };

  if (process.env.NODE_ENV === 'production') {
    if (cfg.accessSecret.length < 32 || /change-me|replace-with|example/i.test(cfg.accessSecret)) {
      throw new Error('JWT_ACCESS_SECRET must be a strong production secret');
    }
    if (!cfg.allowedOrigins.length) throw new Error('REALTIME_ALLOWED_ORIGINS is required in production');
    for (const origin of cfg.allowedOrigins) {
      const url = new URL(origin);
      if (url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname)) {
        throw new Error('REALTIME_ALLOWED_ORIGINS must use non-local HTTPS origins in production');
      }
    }
  }
  return cfg;
}
