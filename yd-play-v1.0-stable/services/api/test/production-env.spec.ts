import { validateProductionEnvironment } from '../src/common/config/production-env';

const good = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@db.example.internal:5432/ydplay',
  JWT_ACCESS_SECRET: 'access-abcdefghijklmnopqrstuvwxyz-123456789',
  JWT_REFRESH_SECRET: 'refresh-abcdefghijklmnopqrstuvwxyz-123456789',
  ADMIN_JWT_SECRET: 'admin-abcdefghijklmnopqrstuvwxyz-123456789',
  CORS_ORIGIN: 'https://admin.example.com',
  REALTIME_ALLOWED_ORIGINS: 'https://app.example.com',
  PUSH_TOKEN_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY='
};

describe('production environment validation', () => {
  it('accepts strong production settings', () => {
    expect(() => validateProductionEnvironment(good as NodeJS.ProcessEnv)).not.toThrow();
  });

  it('rejects repository-style placeholder secrets', () => {
    expect(() => validateProductionEnvironment({
      ...good,
      JWT_ACCESS_SECRET: 'dev-access-change-me'
    } as NodeJS.ProcessEnv)).toThrow();
  });

  it('rejects cleartext production origins', () => {
    expect(() => validateProductionEnvironment({
      ...good,
      CORS_ORIGIN: 'http://example.com'
    } as NodeJS.ProcessEnv)).toThrow();
  });
});
