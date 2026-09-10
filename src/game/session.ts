import { type Bets, type Spot, type RuleMode, type Result, type RoundPlan, type ShoeData, type RandomInt, SPOTS, emptyBets, totalBets, validateBets, validateStake, isSpot, Shoe, dealRound } from './engine.js';
import { Ledger, type LedgerData, type Entry } from './ledger.js';
import { StateMachine, type Phase } from './state.js';
export interface Snapshot {
  version: 1; revision: number; rule: RuleMode; number: number;
  shoe: ShoeData; ledger: LedgerData; bets: Bets; lastBets: Bets;
  history: Result[]; pending: RoundPlan | null;
}
export type Save = (snapshot: Snapshot) => void;
export class GameSession {
  readonly state: StateMachine;
  shoe: Shoe;
  ledger: Ledger;
  bets: Bets;
  lastBets: Bets;
  rule: RuleMode;
  number: number;
  history: Result[];
  pending: RoundPlan | null;
  revision: number;
  recovered = false;
  private undoStack: Bets[] = [];
  private readonly newId: () => string;
  constructor(private save: Save = () => {}, data?: Snapshot, onPhase?: (phase: Phase) => void, random?: RandomInt, newId: () => string = () => crypto.randomUUID()) {
    this.state = new StateMachine(onPhase);
    this.shoe = new Shoe(random, data?.shoe); this.ledger = new Ledger(data?.ledger);
    this.bets = { ...(data?.bets ?? emptyBets()) }; this.lastBets = { ...(data?.lastBets ?? emptyBets()) };
    this.rule = data?.rule ?? 'commission'; this.number = data?.number ?? 1;
    this.history = data?.history ?? []; this.pending = data?.pending ?? null; this.revision = data?.revision ?? 0;
    this.newId = newId;
    validateBets(this.bets); validateBets(this.lastBets);
    if (this.pending) { this.settlePending(); this.recovered = true; }
  }
  get canBet(): boolean { return this.state.canBet && this.pending === null; }
  get canUndo(): boolean { return this.canBet && this.undoStack.length > 0; }
  get balance(): number { return this.ledger.balance; }
  private checkBetting(): void { if (!this.canBet) throw new Error('本局已停止下注，请等待下一局。'); }
  private replace(next: Bets, reason: Entry['reason'], recordUndo = true): void {
    this.checkBetting(); validateBets(next);
    const delta = totalBets(this.bets) - totalBets(next);
    if (this.balance + delta < 0) throw new Error('虚拟筹码不足，可以减小面额或撤回部分投注。');
    const previous = this.snapshot(); const undo = [...this.undoStack];
    try {
      this.ledger.transact(`bet:${this.newId()}`, delta, reason, `round:${this.number}`);
      if (recordUndo) this.undoStack.push({ ...this.bets });
      this.bets = { ...next }; this.persist();
    } catch (error) { this.restoreFinancial(previous); this.undoStack = undo; throw error; }
  }
  place(spot: Spot, units: number): void {
    if (!isSpot(spot)) throw new Error('无效的投注位置。');
    validateStake(units); if (units <= 0) throw new Error('请选择筹码面额。');
    this.replace({ ...this.bets, [spot]: this.bets[spot] + units }, 'BET');
  }
  clear(): void { this.replace(emptyBets(), 'CLEAR'); }
  undo(): void {
    this.checkBetting(); const previous = this.undoStack.at(-1); if (!previous) throw new Error('没有可撤销的投注。');
    this.replace(previous, 'UNDO', false); this.undoStack.pop();
  }
  double(): void {
    if (totalBets(this.bets) === 0) throw new Error('先下注，再加倍。');
    const next = emptyBets(); for (const spot of SPOTS) next[spot] = this.bets[spot] * 2;
    this.replace(next, 'DOUBLE');
  }
  rebet(): void {
    if (!totalBets(this.lastBets)) throw new Error('完成一局后即可续押。');
    this.replace(this.lastBets, 'REBET');
  }
  setRule(mode: RuleMode): void {
    this.checkBetting(); if (totalBets(this.bets)) throw new Error('请先清空投注，再切换规则。');
    if (mode !== 'commission' && mode !== 'super-six') throw new Error('无效规则。');
    const previous = this.rule; this.rule = mode;
    try { this.persist(); } catch (error) { this.rule = previous; throw error; }
  }
  prepareRound(): RoundPlan {
    this.checkBetting(); if (!totalBets(this.bets)) throw new Error('请先选择投注位置。');
    const before = this.snapshot();
    try {
      const shuffled = this.shoe.needsShuffle; if (shuffled) this.shoe.shuffle();
      const plan = dealRound(() => this.shoe.draw(), this.newId(), this.number, this.bets, this.rule);
      plan.shuffled = shuffled; this.pending = plan; this.lastBets = { ...this.bets };
      this.persist(); this.state.move('BETTING_WARNING'); this.undoStack = []; return plan;
    } catch (error) { this.shoe = new Shoe(undefined, before.shoe); this.pending = before.pending; this.lastBets = before.lastBets; this.revision = before.revision; this.state.recoverToBetting(); throw error; }
  }
  settlePending(): Result | null {
    const plan = this.pending; if (!plan) return null;
    const before = this.snapshot();
    try {
      const result = plan.result;
      this.ledger.transact(`payout:${result.id}`, result.gross, 'PAYOUT', result.id);
      if (!this.history.some(item => item.id === result.id)) this.history.push(result);
      this.history = this.history.slice(-1200);
      this.number = Math.max(this.number, result.number + 1); this.bets = emptyBets(); this.pending = null;
      this.persist(); return result;
    } catch (error) { this.restoreFinancial(before); this.history = before.history; this.number = before.number; this.pending = before.pending; throw error; }
  }
  private restoreFinancial(data: Snapshot): void { this.ledger = new Ledger(data.ledger); this.bets = { ...data.bets }; this.revision = data.revision; }
  snapshot(): Snapshot {
    return { version: 1, revision: this.revision, rule: this.rule, number: this.number, shoe: this.shoe.snapshot(), ledger: this.ledger.snapshot(), bets: { ...this.bets }, lastBets: { ...this.lastBets }, history: [...this.history], pending: this.pending };
  }
  persist(): void { const next = this.snapshot(); next.revision++; this.save(next); this.revision = next.revision; }
}
