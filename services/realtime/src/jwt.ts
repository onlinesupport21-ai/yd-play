import { createHmac, timingSafeEqual } from 'node:crypto';

export interface AccessPayload {
  sub: string;
  sid: string;
  type: 'access';
  exp?: number;
  iat?: number;
}

function base64UrlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, 'base64');
}

export function verifyAccessToken(token: string, secret: string): AccessPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = JSON.parse(base64UrlDecode(encodedHeader).toString('utf8')) as { alg?: string; typ?: string };
  if (header.alg !== 'HS256') throw new Error('Unsupported JWT algorithm');

  const expected = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const received = base64UrlDecode(encodedSignature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error('Invalid JWT signature');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as AccessPayload;
  if (!payload.sub || !payload.sid || payload.type !== 'access') throw new Error('Invalid JWT payload');
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp !== undefined && payload.exp <= now) throw new Error('Expired JWT');
  return payload;
}
