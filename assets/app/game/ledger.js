export class Ledger {
    opening;
    current;
    entries;
    applied;
    constructor(data) {
        this.opening = data?.opening ?? 10_000_000;
        this.current = data?.balance ?? this.opening;
        this.entries = data?.entries.map(entry => ({ ...entry })) ?? [];
        this.applied = new Set(data?.appliedIds ?? []);
        this.verify();
    }
    get balance() { return this.current; }
    transact(id, amount, reason, gameId, timestamp = Date.now()) {
        if (this.applied.has(id))
            return false;
        if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(this.current + amount) || this.current + amount < 0)
            throw new Error('虚拟筹码不足，或金额无效。');
        const entry = { id, amount, before: this.current, after: this.current + amount, timestamp, gameId, reason };
        this.entries.push(entry);
        this.current = entry.after;
        this.applied.add(id);
        // Retain a verifiable checkpoint plus recent detail; IDs keep replay protection.
        if (this.entries.length > 2000)
            this.opening = this.entries.shift().after;
        return true;
    }
    verify() {
        if (!Number.isSafeInteger(this.opening) || this.opening < 0)
            throw new Error('本地账本起始值异常。');
        let expected = this.opening;
        for (const entry of this.entries) {
            if (!Number.isSafeInteger(entry.amount) || entry.before !== expected || entry.after !== expected + entry.amount || entry.after < 0 || !this.applied.has(entry.id))
                throw new Error('本地账本校验失败。');
            expected = entry.after;
        }
        if (expected !== this.current)
            throw new Error('本地余额与账本不一致。');
    }
    snapshot() { return { opening: this.opening, balance: this.current, entries: this.entries.map(entry => ({ ...entry })), appliedIds: [...this.applied] }; }
}
