import { BaccaratEngine as Rules, settleRound } from './engine.js';
import { GameStateMachine } from './state.js';
export const MOTION = { fast: 180, normal: 450, slow: 600, cinematic: 2200 };
/** Owns the round. Presentation never chooses rules or writes balances. */
export class GameController {
    wallet;
    shoe;
    timeline;
    view;
    machine = new GameStateMachine();
    nextRound = 1;
    running = false;
    disposed = false;
    abort = new AbortController();
    results = [];
    constructor(wallet, shoe, timeline, view) {
        this.wallet = wallet;
        this.shoe = shoe;
        this.timeline = timeline;
        this.view = view;
    }
    get phase() { return this.machine.phase; }
    get roundId() { return this.nextRound; }
    get history() { return this.results.map(result => ({ ...result })); }
    get canBet() { return !this.running && !this.disposed && this.phase === 'BETTING'; }
    transition(phase) {
        this.assertActive();
        this.machine.transition(phase);
        this.view.state(phase);
    }
    assertActive() {
        if (this.disposed)
            throw new Error('Controller disposed');
    }
    async step(action) {
        this.assertActive();
        const signal = this.abort.signal;
        let cancel = () => { };
        try {
            await Promise.race([
                action(),
                new Promise((_resolve, reject) => {
                    cancel = () => reject(new Error('Controller disposed'));
                    signal.addEventListener('abort', cancel, { once: true });
                    if (signal.aborted)
                        cancel();
                })
            ]);
            this.assertActive();
        }
        finally {
            signal.removeEventListener('abort', cancel);
        }
    }
    async startRound() {
        if (!this.canBet || !this.wallet.lock(this.nextRound))
            return false;
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
            const hands = { player: [], banker: [] };
            const deal = async (hand) => {
                const card = this.shoe.draw();
                const index = hands[hand].length;
                hands[hand].push(card);
                await this.step(() => this.view.deal(hand, index, card));
                this.view.shoe(this.shoe.shoeNumber, this.shoe.remaining);
                await this.step(() => this.timeline.wait(MOTION.fast));
            };
            this.transition('DEALING_INITIAL');
            for (const hand of ['player', 'banker', 'player', 'banker'])
                await deal(hand);
            this.transition('INITIAL_REVEAL');
            for (const hand of ['player', 'banker']) {
                for (let index = 0; index < 2; index++)
                    await this.step(() => this.view.reveal(hand, index));
            }
            let pScore = Rules.calculateScore(hands.player);
            let bScore = Rules.calculateScore(hands.banker);
            this.view.scores(pScore, bScore);
            this.transition('THIRD_CARD_EVAL');
            if (!Rules.isNatural(hands.player, hands.banker)) {
                let third = null;
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
            if (!this.wallet.settle(result))
                throw new Error('Settlement rejected');
            settled = true;
            this.results.push(Object.freeze({ ...result }));
            this.transition('RESULT');
            this.view.result({ ...result }, this.history);
            await this.step(() => this.timeline.wait(MOTION.normal));
            this.transition('PAYOUT');
            await this.step(() => this.timeline.wait(MOTION.cinematic));
            this.transition('RESET');
            if (!this.wallet.resetRound(id))
                throw new Error('Round reset rejected');
            this.nextRound++;
            this.transition('BETTING');
            this.running = false;
            this.view.betting(this.nextRound);
            return true;
        }
        catch (error) {
            // A failed animation before settlement refunds once; after settlement it cannot refund twice.
            if (settled)
                this.wallet.resetRound(id);
            else
                this.wallet.cancelRound(id);
            this.nextRound = Math.max(this.nextRound, id + 1);
            this.machine.recover();
            this.machine.transition('BETTING');
            this.running = false;
            if (!this.disposed) {
                try {
                    this.view.clear();
                    this.view.betting(this.nextRound);
                    this.view.error(settled ? '本局已结算，桌面已恢复。' : '本局已取消，虚拟筹码已退回。');
                }
                catch { /* Rendering failure must never strand the wallet lock. */ }
                console.error('Round recovered', error);
            }
            return false;
        }
        finally {
            this.running = false;
        }
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        const active = this.wallet.activeRoundId;
        if (active !== null && !this.wallet.resetRound(active))
            this.wallet.cancelRound(active);
        this.abort.abort();
        this.timeline.cancel();
    }
}
