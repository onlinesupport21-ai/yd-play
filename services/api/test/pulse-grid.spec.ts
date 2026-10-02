import {
  buildPulseSchedule,
  calculatePulseReward,
  PULSE_GRID_DEFAULT_CONFIG,
  replayPulseGrid
} from '../src/modules/games/pulse-grid.engine';

describe('Pulse Grid authoritative engine', () => {
  const seed = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('builds the same schedule for the same seed', () => {
    expect(buildPulseSchedule(seed, PULSE_GRID_DEFAULT_CONFIG)).toEqual(
      buildPulseSchedule(seed, PULSE_GRID_DEFAULT_CONFIG)
    );
  });

  it('scores only inputs inside the hit window on the correct lane', () => {
    const schedule = buildPulseSchedule(seed, PULSE_GRID_DEFAULT_CONFIG);
    const first = schedule[0];
    const replay = replayPulseGrid(seed, PULSE_GRID_DEFAULT_CONFIG, [
      { seq: 1, elapsedMs: first.timeMs, lane: first.lane },
      { seq: 2, elapsedMs: first.timeMs + 500, lane: first.lane }
    ]);
    expect(replay.hits).toBe(1);
    expect(replay.misses).toBe(1);
    expect(replay.score).toBe(100);
  });

  it('flags repeated impossible input speed', () => {
    const replay = replayPulseGrid(seed, PULSE_GRID_DEFAULT_CONFIG, [
      { seq: 1, elapsedMs: 1000, lane: 0 },
      { seq: 2, elapsedMs: 1010, lane: 1 },
      { seq: 3, elapsedMs: 1020, lane: 2 }
    ]);
    expect(replay.speedViolations).toBe(2);
    expect(replay.flags).toContain('impossible_input_rate');
  });

  it('flags backwards gameplay timestamps', () => {
    const replay = replayPulseGrid(seed, PULSE_GRID_DEFAULT_CONFIG, [
      { seq: 1, elapsedMs: 1200, lane: 0 },
      { seq: 2, elapsedMs: 1100, lane: 1 }
    ]);
    expect(replay.flags).toContain('non_monotonic_time');
  });

  it('caps coin rewards', () => {
    expect(calculatePulseReward(100_000, PULSE_GRID_DEFAULT_CONFIG)).toBe(
      PULSE_GRID_DEFAULT_CONFIG.rewardCapCoins
    );
  });
});
