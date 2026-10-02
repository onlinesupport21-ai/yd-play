import { assertBalanced } from '../src/modules/wallet/ledger';

describe('ledger invariant', () => {
  it('accepts a balanced two-entry transfer', () => {
    expect(() =>
      assertBalanced([
        { accountId: 'system', delta: -1000n },
        { accountId: 'user', delta: 1000n }
      ])
    ).not.toThrow();
  });

  it('rejects an unbalanced transaction', () => {
    expect(() =>
      assertBalanced([
        { accountId: 'system', delta: -1000n },
        { accountId: 'user', delta: 999n }
      ])
    ).toThrow(/Unbalanced/);
  });

  it('rejects zero-value entries', () => {
    expect(() =>
      assertBalanced([
        { accountId: 'a', delta: 0n },
        { accountId: 'b', delta: 0n }
      ])
    ).toThrow();
  });
});
