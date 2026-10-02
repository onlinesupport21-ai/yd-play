import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { verifyAccessToken } from '../src/jwt';

const enc = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
function sign(payload: object, secret: string) {
  const h = enc({ alg: 'HS256', typ: 'JWT' });
  const p = enc(payload);
  const s = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

test('accepts a valid HS256 access token', () => {
  const token = sign({ sub: 'u1', sid: 's1', type: 'access', exp: Math.floor(Date.now()/1000)+60 }, 'secret');
  assert.equal(verifyAccessToken(token, 'secret').sub, 'u1');
});

test('rejects wrong secret and expired tokens', () => {
  const live = sign({ sub: 'u1', sid: 's1', type: 'access', exp: Math.floor(Date.now()/1000)+60 }, 'secret');
  assert.throws(() => verifyAccessToken(live, 'wrong'));
  const expired = sign({ sub: 'u1', sid: 's1', type: 'access', exp: 1 }, 'secret');
  assert.throws(() => verifyAccessToken(expired, 'secret'));
});
