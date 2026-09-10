export interface Entry { id: string; amount: number; before: number; after: number; timestamp: number; gameId: string; reason: 'BET' | 'UNDO' | 'CLEAR' | 'DOUBLE' | 'REBET' | 'PAYOUT' }
export interface LedgerData { opening: number; balance: number; entries: Entry[]; appliedIds: string[] }
export class Ledger {
  private opening: number;
  private current: number;
  private entries: Entry[];
  private applied: Set<string>;
  constructor(data?: LedgerData) {
    this.opening = data?.opening ?? 10_000_000;
    this.current = data?.balance ?? this.opening;
    this.entries = data?.entries.map(entry => ({ ...entry })) ?? [];
    this.applied = new Set(data?.appliedIds ?? []);
    this.verify();
  }
  get balance(): number { return this.current; }
  transact(id: string, amount: number, reason: Entry['reason'], gameId: string, timestamp = Date.now()): boolean {
    if (this.applied.has(id)) return false;
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(this.current + amount) || this.current + amount < 0) throw new Error('虚拟筹码不足，或金额无效。');
    const entry: Entry = { id, amount, before: this.current, after: this.current + amount, timestamp, gameId, reason };
    this.entries.push(entry); this.current = entry.after; this.applied.add(id);
    // Retain a verifiable checkpoint plus recent detail; IDs keep replay protection.
    if (this.entries.length > 2000) this.opening = this.entries.shift()!.after;
    return true;
  }
  private verify(): void {
    if (!Number.isSafeInteger(this.opening) || this.opening < 0) throw new Error('本地账本起始值异常。');
    let expected = this.opening;
    for (const entry of this.entries) {
      if (!Number.isSafeInteger(entry.amount) || entry.before !== expected || entry.after !== expected + entry.amount || entry.after < 0 || !this.applied.has(entry.id)) throw new Error('本地账本校验失败。');
      expected = entry.after;
    }
    if (expected !== this.current) throw new Error('本地余额与账本不一致。');
  }
  snapshot(): LedgerData { return { opening: this.opening, balance: this.current, entries: this.entries.map(entry => ({ ...entry })), appliedIds: [...this.applied] }; }
}
