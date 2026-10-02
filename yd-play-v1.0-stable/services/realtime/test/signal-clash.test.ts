import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRounds, judgeInput, resultFor, SIGNAL_CLASH_CONFIG, targetLane } from '../src/signal-clash.engine';

test('same seed produces deterministic rounds', () => {
  const a = buildRounds('seed-a', 1_000_000, SIGNAL_CLASH_CONFIG);
  const b = buildRounds('seed-a', 1_000_000, SIGNAL_CLASH_CONFIG);
  assert.deepEqual(a, b);
  assert.equal(a.length, 20);
  assert.ok(a.every((r) => r.targetLane >= 0 && r.targetLane < 4));
});

test('different rounds derive valid lanes', () => {
  const values = Array.from({ length: 40 }, (_, i) => targetLane('seed-b', i + 1, 4));
  assert.ok(values.every((x) => Number.isInteger(x) && x >= 0 && x < 4));
  assert.ok(new Set(values).size > 1);
});

test('server judges input, not client score', () => {
  assert.deepEqual(judgeInput(2, 2), { outcome: 'correct', points: 100 });
  assert.deepEqual(judgeInput(2, 1), { outcome: 'wrong', points: 0 });
  assert.deepEqual(judgeInput(2, 99), { outcome: 'invalid_lane', points: 0 });
});

test('result supports win and tie without rewards', () => {
  assert.deepEqual(resultFor([{ userId: 'a', score: 500 }, { userId: 'b', score: 400 }]), { kind: 'win', winnerUserId: 'a' });
  assert.deepEqual(resultFor([{ userId: 'a', score: 500 }, { userId: 'b', score: 500 }]), { kind: 'tie', winnerUserId: null });
});
