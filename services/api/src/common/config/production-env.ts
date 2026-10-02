function badSecret(value: string | undefined, min = 32): boolean {
  if (!value || value.length < min) return true;
  const lowered = value.toLowerCase();
  return lowered.includes('change-me') || lowered.includes('replace-with') || lowered.includes('example');
}

function requireHttpsOrigins(raw: string | undefined, name: string) {
  const values = (raw ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  if (!values.length) throw new Error(`${name} must contain at least one production origin`);
  for (const value of values) {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error(`${name} must use HTTPS in production`);
    if (['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error(`${name} cannot use localhost in production`);
  }
}

export function validateProductionEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== 'production') return;

  if (badSecret(env.JWT_ACCESS_SECRET)) throw new Error('JWT_ACCESS_SECRET must be a strong production secret (32+ characters)');
  if (badSecret(env.JWT_REFRESH_SECRET)) throw new Error('JWT_REFRESH_SECRET must be a strong production secret (32+ characters)');
  if (badSecret(env.ADMIN_JWT_SECRET)) throw new Error('ADMIN_JWT_SECRET must be a strong production secret (32+ characters)');
  if (env.ADMIN_API_KEY && badSecret(env.ADMIN_API_KEY, 24)) throw new Error('ADMIN_API_KEY is configured but is not strong enough');

  requireHttpsOrigins(env.CORS_ORIGIN, 'CORS_ORIGIN');

  const database = env.DATABASE_URL;
  if (!database) throw new Error('DATABASE_URL is required');
  const db = new URL(database);
  if (!['postgres:', 'postgresql:'].includes(db.protocol)) throw new Error('DATABASE_URL must be PostgreSQL');

  const pushKey = env.PUSH_TOKEN_ENCRYPTION_KEY;
  if (pushKey) {
    const decoded = Buffer.from(pushKey, 'base64');
    if (decoded.length !== 32) throw new Error('PUSH_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes');
  }
}
