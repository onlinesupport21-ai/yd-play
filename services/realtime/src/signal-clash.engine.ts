import { createHash } from 'node:crypto';

export interface SignalClashConfig {
  lanes: number;
  roundCount: number;
  countdownMs: number;
  roundIntervalMs: number;
  responseWindowMs: number;
  correctPoints: number;
  wrongPoints: number;
  reconnectGraceMs: number;
}

export const SIGNAL_CLASH_CONFIG: SignalClashConfig = {
  lanes: 4,
  roundCount: 20,
  countdownMs: 3000,
  roundIntervalMs: 1200,
  responseWindowMs: 750,
  correctPoints: 100,
  wrongPoints: 0,
  reconnectGraceMs: 20000
};

export interface SignalRound {
  roundNo: number;
  targetLane: number;
  opensAtMs: number;
  closesAtMs: number;
}

export function targetLane(seed: string, roundNo: number, lanes = 4): number {
  if (!Number.isInteger(roundNo) || roundNo < 1) throw new Error('roundNo must be >= 1');
  if (!Number.isInteger(lanes) || lanes < 2 || lanes > 12) throw new Error('invalid lanes');
  return createHash('sha256').update(`${seed}:signal-clash:${roundNo}`).digest()[0] % lanes;
}

export function buildRounds(
  seed: string,
  startsAtMs: number,
  config: SignalClashConfig = SIGNAL_CLASH_CONFIG
): SignalRound[] {
  return Array.from({ length: config.roundCount }, (_, idx) => {
    const roundNo = idx + 1;
    const opensAtMs = startsAtMs + idx * config.roundIntervalMs;
    return {
      roundNo,
      targetLane: targetLane(seed, roundNo, config.lanes),
      opensAtMs,
      closesAtMs: opensAtMs + config.responseWindowMs
    };
  });
}

export function matchEndsAtMs(rounds: SignalRound[]): number {
  if (!rounds.length) throw new Error('rounds required');
  return rounds[rounds.length - 1].closesAtMs;
}

export function judgeInput(target: number, lane: number, config: SignalClashConfig = SIGNAL_CLASH_CONFIG) {
  if (!Number.isInteger(lane) || lane < 0 || lane >= config.lanes) {
    return { outcome: 'invalid_lane' as const, points: 0 };
  }
  if (lane === target) return { outcome: 'correct' as const, points: config.correctPoints };
  return { outcome: 'wrong' as const, points: config.wrongPoints };
}

export function resultFor(scores: Array<{ userId: string; score: number }>) {
  if (scores.length !== 2) throw new Error('Signal Clash requires exactly two players');
  if (scores[0].score === scores[1].score) return { kind: 'tie' as const, winnerUserId: null };
  const winner = scores[0].score > scores[1].score ? scores[0] : scores[1];
  return { kind: 'win' as const, winnerUserId: winner.userId };
}
