import test from 'node:test';
import assert from 'node:assert/strict';
import { VirtualWallet } from '../dist/src/game/wallet.js';

const empty = () => ({ player: 0, banker: 0, tie: 0, playerPair: 0, bankerPair: 0 });
const bankerWin = (roundId, grossPayout = 9_750, stake = 5_000) => ({
  roundId, winner: 'banker', pScore: 4, bScore: 7, pPair: false, bPair: false,
  grossPayout, netProfit: grossPayout - stake,
});
const playerWin = (roundId, grossPayout, stake) => ({
  roundId, winner: 'player', pScore: 7, bScore: 3, pPair: false, bPair: false,
  grossPayout, netProfit: grossPayout - stake,
});
function rejectedWithoutMutation(wallet, command) {
  const before = wallet.snapshot;
  assert.equal(command(), false);
  assert.deepEqual(wallet.snapshot, before);
}
function conserve(wallet) {
  const ledger = wallet.ledger;
  assert.equal(new Set(ledger.map(entry => entry.id)).size, ledger.length);
  let balance = 0;
  for (const entry of ledger) {
    assert.equal(entry.before, balance);
    assert.equal(entry.after, entry.before + entry.amount);
    assert.ok(Number.isSafeInteger(entry.after) && entry.after >= 0);
    assert.ok(Number.isSafeInteger(entry.timestamp));
    assert.ok(entry.reason.length > 0);
    balance = entry.after;
  }
  assert.equal(balance, wallet.balance);
  assert.equal(ledger.reduce((sum, entry) => sum + entry.amount, 0), wallet.balance);
}

test('50-credit banker win preserves 2 decimal places: 97.50 gross / 47.50 profit', () => {
  const wallet = new VirtualWallet(10_000);
  assert.equal(wallet.placeBet('banker', 5_000), true);
  assert.equal(wallet.balance, 5_000);
  assert.equal(wallet.lock(1), true);
  assert.equal(wallet.settle(bankerWin(1)), true);
  assert.equal(wallet.balance, 14_750);
  assert.equal(wallet.ledger.at(-1).amount, 9_750);
  assert.equal(wallet.ledger.at(-1).gameId, 1);
  assert.equal(wallet.bets.banker, 5_000);
  assert.equal(wallet.locked, true);
  assert.equal(wallet.resetRound(1), true);
  assert.deepEqual(wallet.bets, empty());
  assert.equal(wallet.balance, 14_750);
  conserve(wallet);
});

test('invalid spots, stakes and unsafe arithmetic cannot change the wallet', () => {
  const wallet = new VirtualWallet();
  for (const spot of ['__proto__', 'constructor', 'unknown', '', null, undefined, 0, {}]) {
    rejectedWithoutMutation(wallet, () => wallet.placeBet(spot, 100));
  }
  for (const amount of [0, -100, NaN, Infinity, -Infinity, 1.5, 99, 101, '100', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    rejectedWithoutMutation(wallet, () => wallet.placeBet('player', amount));
  }
  rejectedWithoutMutation(wallet, () => wallet.placeBet('player', wallet.balance + 100));
  const hugeWallet = new VirtualWallet(Number.MAX_SAFE_INTEGER);
  rejectedWithoutMutation(hugeWallet, () => hugeWallet.placeBet('playerPair', 9_000_000_000_000_000));
  for (const balance of [-1, NaN, Infinity, 1.5, '100', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => new VirtualWallet(balance), RangeError);
  }
  assert.equal(new VirtualWallet(0).balance, 0);
  conserve(wallet);
});

test('rebet accounts for the refund: 50 cash + 100 pending can replace a 100 previous bet', () => {
  const wallet = new VirtualWallet(15_000);
  assert.equal(wallet.placeBet('player', 10_000), true);
  assert.equal(wallet.lock(1), true);
  const push = { roundId: 1, winner: 'tie', pScore: 6, bScore: 6, pPair: false, bPair: false, grossPayout: 10_000, netProfit: 0 };
  assert.equal(wallet.settle(push), true);
  assert.equal(wallet.resetRound(1), true);
  assert.equal(wallet.placeBet('banker', 10_000), true);
  assert.equal(wallet.balance, 5_000);
  assert.equal(wallet.rebet(), true);
  assert.equal(wallet.balance, 5_000);
  assert.deepEqual(wallet.bets, { ...empty(), player: 10_000 });
  assert.equal(wallet.ledger.at(-1).source, 'rebet');
  assert.equal(wallet.ledger.at(-1).amount, 0);
  conserve(wallet);
});

test('insufficient double and rebet are atomic; clear refunds once', () => {
  const wallet = new VirtualWallet(15_000);
  rejectedWithoutMutation(wallet, () => wallet.doubleBets());
  rejectedWithoutMutation(wallet, () => wallet.rebet());
  assert.equal(wallet.placeBet('player', 10_000), true);
  rejectedWithoutMutation(wallet, () => wallet.doubleBets());
  assert.equal(wallet.clearBets(), true);
  assert.equal(wallet.balance, 15_000);
  rejectedWithoutMutation(wallet, () => wallet.clearBets());
  assert.equal(wallet.placeBet('player', 10_000), true);
  assert.equal(wallet.lock(1), true);
  assert.equal(wallet.settle(bankerWin(1, 0, 10_000)), true);
  assert.equal(wallet.resetRound(1), true);
  assert.equal(wallet.placeBet('tie', 1_000), true);
  rejectedWithoutMutation(wallet, () => wallet.rebet());
  conserve(wallet);
});

test('double adds each stake exactly once and last bets are captured at lock', () => {
  const wallet = new VirtualWallet(50_000);
  wallet.placeBet('player', 5_000);
  wallet.placeBet('tie', 1_000);
  assert.equal(wallet.doubleBets(), true);
  assert.deepEqual(wallet.bets, { ...empty(), player: 10_000, tie: 2_000 });
  assert.equal(wallet.balance, 38_000);
  assert.equal(wallet.lastBets, null);
  assert.equal(wallet.lock(1), true);
  assert.deepEqual(wallet.lastBets, wallet.bets);
  conserve(wallet);
});

test('locked commands, invalid round identifiers and premature reset leave state intact', () => {
  const wallet = new VirtualWallet();
  rejectedWithoutMutation(wallet, () => wallet.lock(1));
  wallet.placeBet('banker', 5_000);
  for (const id of [0, -1, 1.5, NaN, Infinity, '1', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
    rejectedWithoutMutation(wallet, () => wallet.lock(id));
  }
  assert.equal(wallet.lock(1), true);
  for (const command of [() => wallet.placeBet('player', 100), () => wallet.clearBets(), () => wallet.doubleBets(), () => wallet.rebet(), () => wallet.lock(2), () => wallet.resetRound(1), () => wallet.cancelRound(2)]) {
    rejectedWithoutMutation(wallet, command);
  }
});

test('duplicate settlement and A-B-A replay never credit or settle a later round', () => {
  const wallet = new VirtualWallet();
  const a = bankerWin(1);
  wallet.placeBet('banker', 5_000);
  wallet.lock(1);
  assert.equal(wallet.settle(a), true);
  rejectedWithoutMutation(wallet, () => wallet.settle(a));
  rejectedWithoutMutation(wallet, () => wallet.cancelRound(1));
  rejectedWithoutMutation(wallet, () => wallet.resetRound(2));
  assert.equal(wallet.resetRound(1), true);
  wallet.placeBet('player', 5_000);
  rejectedWithoutMutation(wallet, () => wallet.lock(1));
  wallet.lock(2);
  rejectedWithoutMutation(wallet, () => wallet.settle(a));
  rejectedWithoutMutation(wallet, () => wallet.resetRound(1));
  assert.equal(wallet.settle(playerWin(2, 10_000, 5_000)), true);
  assert.equal(wallet.resetRound(2), true);
  rejectedWithoutMutation(wallet, () => wallet.settle(a));
  assert.equal(wallet.ledger.filter(entry => entry.source === 'settlement').length, 2);
  conserve(wallet);
});

test('cancellation refunds once and permanently invalidates delayed results', () => {
  const wallet = new VirtualWallet(20_000);
  wallet.placeBet('banker', 5_000);
  wallet.lock(1);
  assert.equal(wallet.cancelRound(1), true);
  assert.equal(wallet.balance, 20_000);
  assert.deepEqual(wallet.bets, empty());
  assert.equal(wallet.locked, false);
  rejectedWithoutMutation(wallet, () => wallet.cancelRound(1));
  rejectedWithoutMutation(wallet, () => wallet.resetRound(1));
  rejectedWithoutMutation(wallet, () => wallet.settle(bankerWin(1)));
  wallet.placeBet('banker', 5_000);
  rejectedWithoutMutation(wallet, () => wallet.lock(1));
  wallet.lock(2);
  rejectedWithoutMutation(wallet, () => wallet.cancelRound(1));
  rejectedWithoutMutation(wallet, () => wallet.settle(bankerWin(1)));
  assert.equal(wallet.settle(bankerWin(2)), true);
  assert.equal(wallet.balance, 24_750);
  conserve(wallet);
});

test('mismatching payouts, outcome fields and malformed results fail before any mutation', () => {
  const wallet = new VirtualWallet();
  wallet.placeBet('banker', 5_000);
  wallet.lock(1);
  const valid = bankerWin(1);
  const mutations = [
    { roundId: 2 }, { grossPayout: 9_751 }, { netProfit: 4_751 },
    { grossPayout: 50_000, netProfit: 45_000 }, { grossPayout: -1 },
    { grossPayout: Infinity }, { grossPayout: NaN }, { grossPayout: 9_750.1 },
    { winner: 'player' }, { winner: 'bad' }, { pScore: 10 }, { bScore: -1 },
    { pScore: 4.5 }, { bScore: NaN }, { pScore: '4' }, { pPair: 1 }, { bPair: null },
  ];
  for (const result of [null, undefined, {}, ...mutations.map(patch => ({ ...valid, ...patch }))]) {
    rejectedWithoutMutation(wallet, () => wallet.settle(result));
  }
  assert.equal(wallet.settle(valid), true);
  conserve(wallet);
});

test('payout overflow is rejected, allowing a safe cancellation', () => {
  const wallet = new VirtualWallet(Number.MAX_SAFE_INTEGER);
  wallet.placeBet('player', 100);
  wallet.lock(1);
  rejectedWithoutMutation(wallet, () => wallet.settle(playerWin(1, 200, 100)));
  assert.equal(wallet.cancelRound(1), true);
  assert.equal(wallet.balance, Number.MAX_SAFE_INTEGER);
  conserve(wallet);
});

test('snapshots, bets, lastBets and ledger entries cannot mutate wallet internals', () => {
  const wallet = new VirtualWallet();
  wallet.placeBet('player', 100);
  wallet.lock(1);
  const before = wallet.snapshot;
  const snapshot = wallet.snapshot;
  snapshot.balance = -1;
  snapshot.bets.player = -100;
  snapshot.lastBets.player = 9_999;
  snapshot.ledger[0].after = -1;
  snapshot.ledger.pop();
  wallet.bets.player = 77;
  wallet.lastBets.player = 88;
  wallet.ledger[0].amount = -99;
  assert.deepEqual(wallet.snapshot, before);
  conserve(wallet);
});

test('mixed operations conserve ledger balances over many independently identified rounds', () => {
  const wallet = new VirtualWallet();
  for (let id = 1; id <= 60; id += 1) {
    assert.equal(wallet.placeBet('player', 1_000), true);
    assert.equal(wallet.placeBet('banker', 1_000), true);
    if (id % 3 === 0) assert.equal(wallet.doubleBets(), true);
    const stake = Object.values(wallet.bets).reduce((sum, amount) => sum + amount, 0);
    const playerStake = wallet.bets.player;
    assert.equal(wallet.lock(id), true);
    if (id % 4 === 0) {
      assert.equal(wallet.cancelRound(id), true);
    } else {
      assert.equal(wallet.settle(playerWin(id, playerStake * 2, stake)), true);
      assert.equal(wallet.resetRound(id), true);
    }
    conserve(wallet);
  }
  assert.equal(wallet.balance, 10_000_000);
});
