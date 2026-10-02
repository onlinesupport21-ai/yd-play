export interface LedgerEntryInput {
  accountId: string;
  delta: bigint;
}

export function assertBalanced(entries: LedgerEntryInput[]): void {
  if (entries.length < 2) {
    throw new Error('Ledger transaction requires at least two entries');
  }
  const sum = entries.reduce((acc, entry) => acc + entry.delta, 0n);
  if (sum !== 0n) {
    throw new Error(`Unbalanced ledger transaction: ${sum.toString()}`);
  }
  if (entries.some((entry) => entry.delta === 0n)) {
    throw new Error('Ledger entry delta cannot be zero');
  }
}
