import { BaccaratEngine as Rules, ShoeEngine, settleRound } from './engine.js';
import type { Card, Settlement } from './types.js';
import { VirtualWallet } from './wallet.js';
import { GameStateMachine, type Phase } from './state.js';
import { Timeline } from './timeline.js';

export type Hand = 'player' | 'banker';
export interface Presenter {
  state(phase: Phase): void;
  clear(): void;
  shoe(number: number, remaining: number): void;
  deal(hand: Hand, index: number, card: Card): Promise<void>;
  reveal(hand: Hand, index: number): Promise<void>;
  scores(player: number, banker: number): void;
  result(result: Settlement, history: readonly Settlement[]): void;
  betting(roundId: number): void;
  error(message: string): void;
}

export const MOTION = { fast: 180, normal: 450, slow: 600, cinematic: 2200 } as const;

/** Owns the round. Presentation never chooses rules or writes balances. */
export class GameController {
  readonly machine = new GameStateMachine();
  private nextRound = 1;
  private running = false;
  private disposed = false;
  private readonly abort = new AbortController();
  private readonly results: Settlement[] = [];
  constructor(
    readonly wallet: VirtualWallet,
    readonly shoe: ShoeEngine,
    readonly timeline: Timeline,
    private readonly view: Presenter
  ) {}
  get phase(): Phase { return this.machine.phase; }
  get roundId(): number { return this.nextRound; }
  get history(): readonly Settlement[] { return this.results.map(result => ({ ...result })); }
  get canBet(): boolean { return !this.running && !this.disposed && this.phase === 'BETTING'; }

  private transition(phase: Phase): void {
    this.assertActive();
    this.machine.transition(phase);
    this.view.state(phase);
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('Controller disposed');
  }

  private async step(action: () => Promise<void>): Promise<void> {
    this.assertActive();
    const signal = this.abort.signal;
    let cancel = (): void => {};
    try {
      await Promise.race([
        action(),
        new Promise<never>((_resolve, reject) => {
          cancel = () => reject(new Error('Controller disposed'));
          signal.addEventListener('abort', cancel, { once: true });
          if (signal.aborted) cancel();
        })
      ]);
      this.assertActive();
    } finally { signal.removeEventListener('abort', cancel); }
  }

  async startRound(): Promise<boolean> {
    if (!this.canBet || !this.wallet.lock(this.nextRound)) return false;
    this.running = true;
    const id = this.nextRound;
    let settled = false;
    try {
      this.transition('BETTING_CLOSED');
      await this.step(() => this.timeline.wait(MOTION.normal));
      if (this.shoe.needsShuffle()) {
        this.transition('SHUFFLING');
        await this.step(() => this.timeline.wait(1000));
        this.shoe.initShoe();
      }
      this.transition('PREPARE_DEAL');
      this.view.clear();
      this.view.shoe(this.shoe.shoeNumber, this.shoe.remaining);
      const hands: Record<Hand, Card[]> = { player: [], banker: [] };
      const deal = async (hand: Hand): Promise<void> => {
        const card = this.shoe.draw();
        const index = hands[hand].length;
        hands[hand].push(card);
        await this.step(() => this.view.deal(hand, index, card));
        this.view.shoe(this.shoe.shoeNumber, this.shoe.remaining);
        await this.step(() => this.timeline.wait(MOTION.fast));
      };
      this.transition('DEALING_INITIAL');
      for (const hand of ['player', 'banker', 'player', 'banker'] as const) await deal(hand);
      this.transition('INITIAL_REVEAL');
      for (const hand of ['player', 'banker'] as const) {
        for (let index = 0; index < 2; index++) await this.step(() => this.view.reveal(hand, index));
      }
      let pScore = Rules.calculateScore(hands.player);
      let bScore = Rules.calculateScore(hands.banker);
      this.view.scores(pScore, bScore);
      this.transition('THIRD_CARD_EVAL');
      if (!Rules.isNatural(hands.player, hands.banker)) {
        let third: Card | null = null;
        if (Rules.shouldPlayerDraw(pScore)) {
          this.transition('PLAYER_DRAW');
          await this.step(() => this.timeline.wait(MOTION.slow));
          await deal('player');
          third = hands.player[2] ?? null;
          await this.step(() => this.view.reveal('player', 2));
          pScore = Rules.calculateScore(hands.player);
          this.view.scores(pScore, bScore);
        }
        if (Rules.shouldBankerDraw(bScore, third)) {
          this.transition('BANKER_DRAW');
          await this.step(() => this.timeline.wait(MOTION.slow));
          await deal('banker');
          await this.step(() => this.view.reveal('banker', 2));
          bScore = Rules.calculateScore(hands.banker);
          this.view.scores(pScore, bScore);
        }
      }
      this.transition('REVEAL');
      await this.step(() => this.timeline.wait(MOTION.slow));
      const result = settleRound(id, hands.player, hands.banker, this.wallet.bets);
      if (!this.wallet.settle(result)) throw new Error('Settlement rejected');
      settled = true;
      this.results.push(Object.freeze({ ...result }));
      this.transition('RESULT');
      this.view.result({ ...result }, this.history);
      await this.step(() => this.timeline.wait(MOTION.normal));
      this.transition('PAYOUT');
      await this.step(() => this.timeline.wait(MOTION.cinematic));
      this.transition('RESET');
      if (!this.wallet.resetRound(id)) throw new Error('Round reset rejected');
      this.nextRound++;
      this.transition('BETTING');
      this.running = false;
      this.view.betting(this.nextRound);
      return true;
    } catch (error: unknown) {
      // A failed animation before settlement refunds once; after settlement it cannot refund twice.
      if (settled) this.wallet.resetRound(id);
      else this.wallet.cancelRound(id);
      this.nextRound = Math.max(this.nextRound, id + 1);
      this.machine.recover();
      this.machine.transition('BETTING');
      this.running = false;
      if (!this.disposed) {
        try {
          this.view.clear();
          this.view.betting(this.nextRound);
          this.view.error(settled ? '本局已结算，桌面已恢复。' : '本局已取消，虚拟筹码已退回。');
        } catch { /* Rendering failure must never strand the wallet lock. */ }
        console.error('Round recovered', error);
      }
      return false;
    } finally { this.running = false; }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const active = this.wallet.activeRoundId;
    if (active !== null && !this.wallet.resetRound(active)) this.wallet.cancelRound(active);
    this.abort.abort();
    this.timeline.cancel();
  }
}
