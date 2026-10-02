import { createHash } from 'node:crypto';

export interface PulseGridConfig {
  durationMs: number;
  lanes: number;
  firstTargetMs: number;
  targetIntervalMs: number;
  hitWindowMs: number;
  minInputIntervalMs: number;
  maxFutureSkewMs: number;
  maxLateInputMs: number;
  rewardScoreStep: number;
  rewardCoinsPerStep: number;
  rewardCapCoins: number;
}

export interface PulseTarget {
  index: number;
  timeMs: number;
  lane: number;
}

export interface PulseInput {
  seq: number;
  elapsedMs: number;
  lane: number;
}

export type PulseInputOutcome = 'hit' | 'miss' | 'rejected_speed';

export interface PulseReplayEvent {
  seq: number;
  elapsedMs: number;
  lane: number;
  outcome: PulseInputOutcome;
  targetIndex: number | null;
  scoreAfter: number;
  comboAfter: number;
}

export interface PulseReplayResult {
  score: number;
  combo: number;
  maxCombo: number;
  hits: number;
  misses: number;
  accuracy: number;
  speedViolations: number;
  flags: string[];
  events: PulseReplayEvent[];
  replayHash: string;
}

export const PULSE_GRID_DEFAULT_CONFIG: PulseGridConfig = {
  durationMs: 45_000,
  lanes: 4,
  firstTargetMs: 1_000,
  targetIntervalMs: 700,
  hitWindowMs: 230,
  minInputIntervalMs: 45,
  maxFutureSkewMs: 350,
  maxLateInputMs: 5_000,
  rewardScoreStep: 750,
  rewardCoinsPerStep: 5,
  rewardCapCoins: 100
};

function digest(seed: string, counter: number): Buffer {
  return createHash('sha256').update(`${seed}:${counter}`).digest();
}

export function buildPulseSchedule(
  seed: string,
  config: PulseGridConfig
): PulseTarget[] {
  const targets: PulseTarget[] = [];
  let index = 0;
  for (
    let timeMs = config.firstTargetMs;
    timeMs <= config.durationMs - config.hitWindowMs;
    timeMs += config.targetIntervalMs
  ) {
    const bytes = digest(seed, index);
    const lane = bytes[0] % config.lanes;
    targets.push({ index, timeMs, lane });
    index += 1;
  }
  return targets;
}

export function hashSchedule(schedule: PulseTarget[]): string {
  return createHash('sha256')
    .update(JSON.stringify(schedule))
    .digest('hex');
}

export function calculatePulseReward(
  score: number,
  config: PulseGridConfig
): number {
  if (score <= 0) return 0;
  const steps = Math.floor(score / config.rewardScoreStep);
  return Math.min(config.rewardCapCoins, steps * config.rewardCoinsPerStep);
}

export function replayPulseGrid(
  seed: string,
  config: PulseGridConfig,
  inputs: PulseInput[]
): PulseReplayResult {
  const schedule = buildPulseSchedule(seed, config);
  const consumed = new Set<number>();
  const flags = new Set<string>();
  const events: PulseReplayEvent[] = [];

  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let hits = 0;
  let misses = 0;
  let speedViolations = 0;
  let previousElapsed: number | null = null;
  let expectedSeq = 1;

  for (const input of inputs) {
    if (input.seq !== expectedSeq) flags.add('sequence_gap');
    expectedSeq = input.seq + 1;

    if (
      !Number.isInteger(input.elapsedMs) ||
      input.elapsedMs < 0 ||
      input.elapsedMs > config.durationMs + config.hitWindowMs
    ) {
      flags.add('input_out_of_range');
    }

    if (!Number.isInteger(input.lane) || input.lane < 0 || input.lane >= config.lanes) {
      flags.add('invalid_lane');
    }

    if (previousElapsed !== null && input.elapsedMs < previousElapsed) {
      flags.add('non_monotonic_time');
    }

    if (
      previousElapsed !== null &&
      input.elapsedMs - previousElapsed < config.minInputIntervalMs
    ) {
      speedViolations += 1;
      combo = 0;
      misses += 1;
      events.push({
        ...input,
        outcome: 'rejected_speed',
        targetIndex: null,
        scoreAfter: score,
        comboAfter: combo
      });
      previousElapsed = input.elapsedMs;
      continue;
    }

    previousElapsed = input.elapsedMs;

    let best: PulseTarget | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const target of schedule) {
      if (consumed.has(target.index) || target.lane !== input.lane) continue;
      const distance = Math.abs(target.timeMs - input.elapsedMs);
      if (distance <= config.hitWindowMs && distance < bestDistance) {
        best = target;
        bestDistance = distance;
      }
    }

    if (best) {
      consumed.add(best.index);
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      const comboBonus = Math.min(10, combo - 1) * 10;
      score += 100 + comboBonus;
      hits += 1;
      events.push({
        ...input,
        outcome: 'hit',
        targetIndex: best.index,
        scoreAfter: score,
        comboAfter: combo
      });
    } else {
      combo = 0;
      misses += 1;
      events.push({
        ...input,
        outcome: 'miss',
        targetIndex: null,
        scoreAfter: score,
        comboAfter: combo
      });
    }
  }

  if (speedViolations >= 2) flags.add('impossible_input_rate');

  const totalJudged = hits + misses;
  const accuracy = totalJudged === 0 ? 0 : hits / totalJudged;
  const replayHash = createHash('sha256')
    .update(
      JSON.stringify({
        scheduleHash: hashSchedule(schedule),
        score,
        maxCombo,
        hits,
        misses,
        speedViolations,
        inputs
      })
    )
    .digest('hex');

  return {
    score,
    combo,
    maxCombo,
    hits,
    misses,
    accuracy,
    speedViolations,
    flags: [...flags].sort(),
    events,
    replayHash
  };
}
