import test from 'node:test';
import assert from 'node:assert/strict';
import { GameController } from '../dist/src/game/controller.js';
import { ShoeEngine } from '../dist/src/game/engine.js';
import { Timeline } from '../dist/src/game/timeline.js';
import { VirtualWallet } from '../dist/src/game/wallet.js';

const card = value => ({ suit: '♠', value: String(value), isRed: false });
const emptyBets = () => ({ player: 0, banker: 0, tie: 0, playerPair: 0, bankerPair: 0 });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

// Keep the production shoe class/API, replacing only the draw fixture for reproducibility.
class FixtureShoe extends ShoeEngine {
  constructor(values, shuffle = false) {
    super(() => 0.5);
    this.queue = values.map(card);
    this.drawn = [];
    this.shufflePending = shuffle;
    this.replacements = 0;
  }
  draw() {
    const next = this.queue.shift();
    assert.ok(next, 'Fixture exhausted: the controller drew an unexpected extra card');
    this.drawn.push(next);
    return next;
  }
  needsShuffle() { return this.shufflePending; }
  initShoe() {
    super.initShoe();
    if (this.queue) {
      this.replacements++;
      this.shufflePending = false;
    }
  }
  get remaining() { return 416 - (this.drawn?.length ?? 0); }
}

class ImmediateTimeline extends Timeline {
  cancelled = false;
  waits = [];
  wait(ms) {
    this.waits.push(ms);
    return this.cancelled ? Promise.reject(new Error('Timeline stopped')) : Promise.resolve();
  }
  cancel() { this.cancelled = true; super.cancel(); }
}

class ManualClock {
  time = 0;
  nextId = 1;
  tasks = new Map();
  now = () => this.time;
  schedule = (callback, ms) => {
    const id = this.nextId++;
    this.tasks.set(id, { callback, due: this.time + ms });
    return id;
  };
  clear = id => { this.tasks.delete(id); };
  advance(ms) {
    this.time += ms;
    for (const [id, task] of [...this.tasks]) {
      if (task.due <= this.time) {
        this.tasks.delete(id);
        task.callback();
      }
    }
  }
}

function setup(values = ['4', '3', '4', '2'], overrides = {}, options = {}) {
  const wallet = new VirtualWallet(100_000);
  const shoe = new FixtureShoe(values, options.shuffle);
  const timeline = options.timeline ?? new ImmediateTimeline();
  const events = [];
  const view = {};
  for (const name of ['state', 'clear', 'shoe', 'deal', 'reveal', 'scores', 'result', 'betting', 'error']) {
    view[name] = (...args) => {
      events.push([name, ...args]);
      if (overrides[name]) return overrides[name](...args);
      if (name === 'deal' || name === 'reveal') return Promise.resolve();
    };
  }
  const controller = new GameController(wallet, shoe, timeline, view);
  if (options.bet !== false) assert.equal(wallet.placeBet('player', 5_000), true);
  return { wallet, shoe, timeline, controller, events };
}

test('no stake means no round, no lock and no presentation side effects', async () => {
  const { wallet, controller, events, shoe } = setup(undefined, {}, { bet: false });
  const before = wallet.snapshot;
  assert.equal(await controller.startRound(), false);
  assert.deepEqual(wallet.snapshot, before);
  assert.deepEqual(events, []);
  assert.equal(shoe.drawn.length, 0);
  assert.equal(controller.roundId, 1);
  assert.equal(controller.canBet, true);
});

test('natural 8 deals P1 B1 P2 B2, reveals four cards, settles once and reopens', async () => {
  const { wallet, controller, events, shoe } = setup();
  assert.equal(await controller.startRound(), true);
  assert.deepEqual(events.filter(([name]) => name === 'deal').map(([, hand, index, value]) => [hand, index, value.value]), [
    ['player', 0, '4'], ['banker', 0, '3'], ['player', 1, '4'], ['banker', 1, '2'],
  ]);
  assert.deepEqual(events.filter(([name]) => name === 'reveal').map(([, hand, index]) => [hand, index]), [
    ['player', 0], ['player', 1], ['banker', 0], ['banker', 1],
  ]);
  assert.deepEqual(events.filter(([name]) => name === 'state').map(([, phase]) => phase), [
    'BETTING_CLOSED', 'PREPARE_DEAL', 'DEALING_INITIAL', 'INITIAL_REVEAL', 'THIRD_CARD_EVAL',
    'REVEAL', 'RESULT', 'PAYOUT', 'RESET', 'BETTING',
  ]);
  assert.equal(shoe.drawn.length, 4);
  assert.deepEqual(events.filter(([name]) => name === 'scores').at(-1), ['scores', 8, 5]);
  assert.equal(wallet.balance, 105_000);
  assert.equal(wallet.locked, false);
  assert.deepEqual(wallet.bets, emptyBets());
  assert.deepEqual(wallet.lastBets, { ...emptyBets(), player: 5_000 });
  assert.equal(wallet.ledger.filter(entry => entry.source === 'settlement').length, 1);
  assert.equal(controller.history.length, 1);
  assert.equal(controller.history[0].roundId, 1);
  assert.equal(controller.canBet, true);
  assert.equal(controller.roundId, 2);
  assert.deepEqual(events.at(-1), ['betting', 2]);
});

for (const fixture of [
  { name: 'both draw', cards: ['A', 'A', '2', '3', '6', '3'], draws: ['PLAYER_DRAW', 'BANKER_DRAW'], final: [9, 7] },
  { name: 'player draws 8 and banker 3 stands', cards: ['A', 'A', '2', '2', '8'], draws: ['PLAYER_DRAW'], final: [1, 3] },
  { name: 'player 6 stands and banker 5 draws', cards: ['3', '2', '3', '3', '4'], draws: ['BANKER_DRAW'], final: [6, 9] },
  { name: 'both stand on 6 and 7', cards: ['3', '3', '3', '4'], draws: [], final: [6, 7] },
]) {
  test(`third-card progression: ${fixture.name}`, async () => {
    const { controller, events, shoe } = setup(fixture.cards);
    assert.equal(await controller.startRound(), true);
    assert.deepEqual(events.filter(([name, phase]) => name === 'state' && ['PLAYER_DRAW', 'BANKER_DRAW'].includes(phase)).map(([, phase]) => phase), fixture.draws);
    assert.equal(shoe.drawn.length, fixture.cards.length);
    assert.deepEqual(events.filter(([name]) => name === 'scores').at(-1), ['scores', ...fixture.final]);
    assert.deepEqual([controller.history[0].pScore, controller.history[0].bScore], fixture.final);
    const deals = events.filter(([name]) => name === 'deal');
    const reveals = events.filter(([name]) => name === 'reveal');
    assert.equal(deals.length, reveals.length);
    for (const phase of fixture.draws) {
      const hand = phase === 'PLAYER_DRAW' ? 'player' : 'banker';
      assert.ok(deals.some(([, dealtHand, index]) => dealtHand === hand && index === 2));
      assert.ok(reveals.some(([, revealedHand, index]) => revealedHand === hand && index === 2));
    }
  });
}

test('a cut shoe is replaced after locking and before the first card', async () => {
  const { controller, shoe, events } = setup(undefined, {}, { shuffle: true });
  assert.equal(await controller.startRound(), true);
  assert.equal(shoe.replacements, 1);
  assert.equal(shoe.shoeNumber, 2);
  const phases = events.filter(([name]) => name === 'state').map(([, phase]) => phase);
  assert.deepEqual(phases.slice(0, 4), ['BETTING_CLOSED', 'SHUFFLING', 'PREPARE_DEAL', 'DEALING_INITIAL']);
  assert.deepEqual(events.find(([name]) => name === 'shoe'), ['shoe', 2, 416]);
});

test('a paired natural tie preserves all five betting spots, pushes main stakes and pays both pairs', async () => {
  const { controller, wallet } = setup(['4', '4', '4', '4'], {}, { bet: false });
  for (const [spot, amount] of Object.entries({ player: 100, banker: 200, tie: 300, playerPair: 400, bankerPair: 500 })) {
    assert.equal(wallet.placeBet(spot, amount), true);
  }
  assert.equal(await controller.startRound(), true);
  assert.deepEqual(controller.history[0], {
    roundId: 1, winner: 'tie', pScore: 8, bScore: 8, pPair: true, bPair: true,
    grossPayout: 13_800, netProfit: 12_300,
  });
  assert.equal(wallet.balance, 112_300);
  assert.deepEqual(wallet.lastBets, { player: 100, banker: 200, tie: 300, playerPair: 400, bankerPair: 500 });
  assert.equal(wallet.rebet(), true);
  assert.equal(wallet.balance, 110_800);
  assert.deepEqual(wallet.bets, wallet.lastBets);
});

test('banker winning on six pays standard 5% commission with exact half-credit precision', async () => {
  const { controller, wallet } = setup(['2', '3', '2', '3', '10'], {}, { bet: false });
  assert.equal(wallet.placeBet('banker', 5_000), true);
  assert.equal(await controller.startRound(), true);
  assert.equal(controller.history[0].bScore, 6);
  assert.equal(controller.history[0].grossPayout, 9_750);
  assert.equal(controller.history[0].netProfit, 4_750);
  assert.equal(wallet.balance, 104_750);
});

test('concurrent DEAL clicks acquire one wallet lock and cannot double settle', async () => {
  const { controller, wallet, shoe } = setup();
  const first = controller.startRound();
  assert.equal(controller.canBet, false);
  assert.equal(wallet.locked, true);
  const duplicates = await Promise.all(Array.from({ length: 20 }, () => controller.startRound()));
  assert.ok(duplicates.every(result => result === false));
  assert.equal(await first, true);
  assert.equal(shoe.drawn.length, 4);
  assert.equal(wallet.ledger.filter(entry => entry.source === 'lock').length, 1);
  assert.equal(wallet.ledger.filter(entry => entry.source === 'settlement').length, 1);
});

test('locked rounds reject all betting mutations throughout presentation', async () => {
  let wallet;
  const check = () => {
    const before = wallet.snapshot;
    assert.equal(wallet.placeBet('banker', 100), false);
    assert.equal(wallet.clearBets(), false);
    assert.equal(wallet.doubleBets(), false);
    assert.equal(wallet.rebet(), false);
    assert.deepEqual(wallet.snapshot, before);
  };
  const fixture = setup(undefined, { deal: async () => check(), reveal: async () => check() });
  wallet = fixture.wallet;
  assert.equal(await fixture.controller.startRound(), true);
});

for (const location of ['state', 'clear', 'deal', 'reveal', 'scores']) {
  test(`presentation error in ${location} before settlement refunds once and allows the next round`, async t => {
    t.mock.method(console, 'error', () => {});
    let fail = true;
    const fixture = setup([...Array(3)].flatMap(() => ['4', '3', '4', '2']), {
      [location]: () => {
        if (fail) { fail = false; throw new Error(`Fixture ${location} failed`); }
        return Promise.resolve();
      },
    });
    const { controller, wallet, events } = fixture;
    assert.equal(await controller.startRound(), false);
    assert.equal(wallet.balance, 100_000);
    assert.equal(wallet.locked, false);
    assert.deepEqual(wallet.bets, emptyBets());
    assert.equal(wallet.ledger.filter(entry => entry.source === 'cancel').length, 1);
    assert.equal(wallet.ledger.filter(entry => entry.source === 'settlement').length, 0);
    assert.equal(controller.history.length, 0);
    assert.equal(controller.roundId, 2);
    assert.equal(controller.canBet, true);
    assert.ok(events.some(([name]) => name === 'error'));
    assert.equal(wallet.placeBet('player', 100), true);
    assert.equal(await controller.startRound(), true);
    assert.equal(controller.history.length, 1);
    assert.equal(controller.history[0].roundId, 2);
  });
}

test('a result presentation error after settlement cannot refund the winning stake twice', async t => {
  t.mock.method(console, 'error', () => {});
  const { wallet, controller, events } = setup(undefined, { result: () => { throw new Error('Result panel failed'); } });
  assert.equal(await controller.startRound(), false);
  assert.equal(wallet.balance, 105_000);
  assert.equal(wallet.locked, false);
  assert.equal(wallet.ledger.filter(entry => entry.source === 'settlement').length, 1);
  assert.equal(wallet.ledger.filter(entry => entry.source === 'cancel').length, 0);
  assert.equal(controller.history.length, 1);
  assert.equal(controller.canBet, true);
  assert.ok(events.find(([name]) => name === 'error')[1].includes('已结算'));
});

test('failure of both initial and recovery rendering still releases the wallet', async t => {
  t.mock.method(console, 'error', () => {});
  const { wallet, controller } = setup(undefined, { clear: () => { throw new Error('DOM removed'); } });
  assert.equal(await controller.startRound(), false);
  assert.equal(wallet.balance, 100_000);
  assert.equal(wallet.locked, false);
  assert.equal(controller.canBet, true);
});

test('returned history snapshots and presenter result cannot mutate controller results', async () => {
  const { controller } = setup(undefined, { result(result) { result.winner = 'banker'; result.grossPayout = -1; } });
  assert.equal(await controller.startRound(), true);
  const snapshot = controller.history;
  snapshot[0].winner = 'banker';
  snapshot[0].grossPayout = -1;
  snapshot.pop();
  assert.equal(controller.history.length, 1);
  assert.equal(controller.history[0].winner, 'player');
  assert.equal(controller.history[0].grossPayout, 10_000);
});

test('pausing before the first deadline freezes dealing; disposal rejects and refunds', async () => {
  const clock = new ManualClock();
  const timeline = new Timeline(clock);
  const { wallet, controller, shoe, events } = setup(undefined, {}, { timeline });
  const running = controller.startRound();
  clock.advance(100);
  timeline.setPaused(true);
  clock.advance(60_000);
  await Promise.resolve();
  assert.equal(shoe.drawn.length, 0);
  assert.equal(wallet.locked, true);
  const eventCount = events.length;
  controller.dispose();
  controller.dispose();
  assert.equal(await running, false);
  assert.equal(wallet.balance, 100_000);
  assert.equal(wallet.locked, false);
  assert.equal(controller.canBet, false);
  assert.equal(await controller.startRound(), false);
  assert.equal(events.length, eventCount);
  assert.equal(clock.tasks.size, 0);
});

test('a deadline resolved just before disposal cannot continue with a stale microtask', async () => {
  const clock = new ManualClock();
  const timeline = new Timeline(clock);
  const { controller, wallet, shoe, events } = setup(undefined, {}, { timeline });
  const running = controller.startRound();
  clock.advance(450); // Promise resolves, but its async continuation has not run yet.
  controller.dispose();
  const eventCount = events.length;
  assert.equal(await running, false);
  assert.equal(shoe.drawn.length, 0, 'Disposed controllers must not draw from an already resolved wait');
  assert.equal(events.length, eventCount, 'Disposed controllers must not publish stale UI updates');
  assert.equal(wallet.balance, 100_000);
  assert.equal(wallet.locked, false);
});

test('disposal unlocks a round with a pending presenter and ignores its later completion', async () => {
  const pending = deferred();
  const entered = deferred();
  const { controller, wallet, shoe, events } = setup(undefined, {
    deal: () => { entered.resolve(); return pending.promise; },
  });
  const running = controller.startRound();
  await entered.promise;
  assert.equal(shoe.drawn.length, 1);
  controller.dispose();
  const immediatelyUnlocked = !wallet.locked;
  const eventCount = events.length;
  pending.resolve();
  assert.equal(await running, false);
  assert.equal(immediatelyUnlocked, true, 'Refund must not depend on a removed presenter resolving');
  assert.equal(events.length, eventCount, 'A late presenter completion must not update remaining cards');
  assert.equal(shoe.drawn.length, 1);
  assert.equal(wallet.balance, 100_000);
  assert.equal(wallet.ledger.filter(entry => entry.source === 'cancel').length, 1);
});

test('a removed presenter cannot leave startRound pending after disposal', async () => {
  const pending = deferred();
  const entered = deferred();
  const { controller, wallet } = setup(undefined, {
    reveal: () => { entered.resolve(); return pending.promise; },
  });
  const running = controller.startRound();
  await entered.promise;
  controller.dispose();
  const outcome = await Promise.race([
    running,
    new Promise(resolve => setImmediate(() => resolve('still pending'))),
  ]);
  // Let any late continuation clean up even if the cancellation contract is broken.
  pending.resolve();
  await running;
  assert.equal(outcome, false, 'Abort must finish the round even when the presenter never completes');
  assert.equal(wallet.locked, false);
  assert.equal(wallet.balance, 100_000);
});

test('disposal from result presentation retains the committed payout without a refund', async () => {
  let controller;
  const fixture = setup(undefined, { result: () => controller.dispose() });
  controller = fixture.controller;
  assert.equal(await controller.startRound(), false);
  assert.equal(fixture.wallet.balance, 105_000);
  assert.equal(fixture.wallet.locked, false);
  assert.equal(fixture.wallet.ledger.filter(entry => entry.source === 'settlement').length, 1);
  assert.equal(fixture.wallet.ledger.filter(entry => entry.source === 'cancel').length, 0);
  assert.equal(controller.canBet, false);
});
