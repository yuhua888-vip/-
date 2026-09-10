import { calculatePayout, totalBets, validateBets } from './engine.js';
import type { Bets, BetSpot, Settlement } from './types.js';

const SPOTS: readonly BetSpot[] = ['player', 'banker', 'tie', 'playerPair', 'bankerPair'];
const emptyBets = (): Bets => ({ player: 0, banker: 0, tie: 0, playerPair: 0, bankerPair: 0 });
const validRoundId = (roundId: number): boolean => Number.isSafeInteger(roundId) && roundId > 0;
const validBalance = (balance: number): boolean => Number.isSafeInteger(balance) && balance >= 0;

export type LedgerSource = 'opening' | 'bet' | 'clear' | 'double' | 'rebet' | 'lock' | 'settlement' | 'cancel';

/** Amounts are integer minor units: 100 units represent one virtual credit. */
export interface LedgerEntry {
  readonly id: string;
  readonly source: LedgerSource;
  readonly amount: number;
  readonly before: number;
  readonly after: number;
  readonly timestamp: number;
  readonly gameId: number | null;
  readonly reason: string;
}

export interface WalletSnapshot {
  readonly balance: number;
  readonly bets: Readonly<Bets>;
  readonly lastBets: Readonly<Bets> | null;
  readonly ledger: readonly LedgerEntry[];
  readonly locked: boolean;
  readonly activeRoundId: number | null;
}

/**
 * Local practice wallet. The production wallet must run on an authoritative
 * server; this class deliberately has no storage, network or DOM dependency.
 * Rejected commands return false and leave every field and ledger row unchanged.
 */
export class VirtualWallet {
  #balance = 0;
  #bets: Bets = emptyBets();
  #lastBets: Bets | null = null;
  #ledger: LedgerEntry[] = [];
  #activeRoundId: number | null = null;
  #settled = false;
  // Retain every used ID, including cancelled rounds, so an old result cannot
  // become valid again after later rounds complete.
  #usedRoundIds = new Set<number>();

  constructor(initialBalance = 10_000_000) {
    if (!validBalance(initialBalance)) {
      throw new RangeError('Initial virtual balance must be a nonnegative safe integer.');
    }
    this.#post('opening', initialBalance, null, 'Starting virtual practice balance');
  }

  get balance(): number { return this.#balance; }
  get bets(): Bets { return { ...this.#bets }; }
  get lastBets(): Bets | null { return this.#lastBets ? { ...this.#lastBets } : null; }
  get ledger(): readonly LedgerEntry[] { return this.#ledger.map(entry => ({ ...entry })); }
  get locked(): boolean { return this.#activeRoundId !== null; }
  get activeRoundId(): number | null { return this.#activeRoundId; }
  get snapshot(): WalletSnapshot {
    return {
      balance: this.balance,
      bets: this.bets,
      lastBets: this.lastBets,
      ledger: this.ledger,
      locked: this.locked,
      activeRoundId: this.activeRoundId,
    };
  }

  placeBet(spot: BetSpot, amount: number): boolean {
    if (this.locked || !SPOTS.includes(spot) || !Number.isSafeInteger(amount)
      || amount <= 0 || amount % 100 !== 0 || amount > this.#balance) return false;
    const next = { ...this.#bets, [spot]: this.#bets[spot] + amount };
    if (!this.#validBets(next)) return false;
    this.#post('bet', -amount, null, `Place virtual stake on ${spot}`);
    this.#bets = next;
    return true;
  }

  clearBets(): boolean {
    if (this.locked) return false;
    const refund = totalBets(this.#bets);
    if (refund === 0 || !validBalance(this.#balance + refund)) return false;
    this.#post('clear', refund, null, 'Return all unlocked stakes');
    this.#bets = emptyBets();
    return true;
  }

  doubleBets(): boolean {
    if (this.locked) return false;
    const additionalStake = totalBets(this.#bets);
    if (additionalStake === 0 || additionalStake > this.#balance) return false;
    const next = emptyBets();
    for (const spot of SPOTS) next[spot] = this.#bets[spot] * 2;
    if (!this.#validBets(next)) return false;
    this.#post('double', -additionalStake, null, 'Double all unlocked stakes');
    this.#bets = next;
    return true;
  }

  rebet(): boolean {
    if (this.locked || !this.#lastBets) return false;
    const previousStake = totalBets(this.#lastBets);
    const refundableStake = totalBets(this.#bets);
    // Validate the complete replacement before refunding or debiting anything.
    const nextBalance = this.#balance + refundableStake - previousStake;
    if (previousStake === 0 || !validBalance(nextBalance)) return false;
    this.#post('rebet', refundableStake - previousStake, null, 'Replace unlocked stakes with the previous round stakes');
    this.#bets = { ...this.#lastBets };
    return true;
  }

  lock(roundId: number): boolean {
    if (this.locked || !validRoundId(roundId) || this.#usedRoundIds.has(roundId)
      || totalBets(this.#bets) === 0) return false;
    this.#activeRoundId = roundId;
    this.#usedRoundIds.add(roundId);
    this.#lastBets = { ...this.#bets };
    this.#settled = false;
    this.#post('lock', 0, roundId, 'Lock stakes for the active round');
    return true;
  }

  settle(settlement: Settlement): boolean {
    if (!settlement || typeof settlement !== 'object' || !this.locked || this.#settled
      || settlement.roundId !== this.#activeRoundId) return false;
    const { pScore, bScore, winner, pPair, bPair, grossPayout, netProfit } = settlement;
    if (![pScore, bScore].every(score => Number.isInteger(score) && score >= 0 && score <= 9)
      || typeof pPair !== 'boolean' || typeof bPair !== 'boolean'
      || !validBalance(grossPayout) || !Number.isSafeInteger(netProfit)) return false;
    const expectedWinner = pScore > bScore ? 'player' : bScore > pScore ? 'banker' : 'tie';
    if (winner !== expectedWinner || netProfit !== grossPayout - totalBets(this.#bets)
      || !validBalance(this.#balance + grossPayout)) return false;
    // The shared rule engine remains the only implementation of payout math.
    if (grossPayout !== calculatePayout(winner, pPair, bPair, this.#bets)) return false;
    this.#post('settlement', grossPayout, settlement.roundId, `Settle ${winner} result; net virtual change ${netProfit}`);
    this.#settled = true;
    return true;
  }

  /** Cancel only an unresolved matching round, refunding its stake exactly once. */
  cancelRound(roundId: number): boolean {
    if (!this.locked || this.#settled || roundId !== this.#activeRoundId) return false;
    const refund = totalBets(this.#bets);
    if (!validBalance(this.#balance + refund)) return false;
    this.#post('cancel', refund, roundId, 'Cancel unresolved round and return locked stakes');
    this.#bets = emptyBets();
    this.#activeRoundId = null;
    this.#settled = false;
    return true;
  }

  /** Clear the display stakes after payout; never refund an already settled bet. */
  resetRound(roundId: number): boolean {
    if (!this.#settled || roundId !== this.#activeRoundId) return false;
    this.#bets = emptyBets();
    this.#activeRoundId = null;
    this.#settled = false;
    return true;
  }

  #validBets(bets: Bets): boolean {
    try {
      validateBets(bets);
      return true;
    } catch {
      return false;
    }
  }

  /** Called only after a command has validated every precondition. */
  #post(source: LedgerSource, amount: number, gameId: number | null, reason: string): void {
    const before = this.#balance;
    const after = before + amount;
    this.#ledger.push({
      id: `ledger-${this.#ledger.length + 1}`,
      source, amount, before, after, timestamp: Date.now(), gameId, reason,
    });
    this.#balance = after;
  }
}
