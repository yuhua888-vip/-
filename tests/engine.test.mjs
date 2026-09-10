import test from 'node:test';
import assert from 'node:assert/strict';
import { BaccaratEngine as rules, ShoeEngine, calculatePayout, settleRound, totalBets, validateBets } from '../dist/src/game/engine.js';

const card = (value, suit = '♠') => ({ value, suit, isRed: suit === '♥' || suit === '♦' });
const pointCard = (point) => card(point === 0 ? '10' : point === 1 ? 'A' : String(point));
const hand = (score) => [pointCard(score), card('K')];
const bets = (overrides = {}) => ({ player: 0, banker: 0, tie: 0, playerPair: 0, bankerPair: 0, ...overrides });
const seeded = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x1_0000_0000; };

test('card points, modulo ten scoring and rank-based pairs', () => {
  const expected = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 0, J: 0, Q: 0, K: 0 };
  for (const [rank, point] of Object.entries(expected)) assert.equal(rules.getCardPoint(card(rank)), point, rank);
  assert.equal(rules.calculateScore([]), 0);
  assert.equal(rules.calculateScore([card('9'), card('8'), card('7')]), 4);
  assert.equal(rules.hasPair([card('J'), card('Q')]), false, 'same point value is not a pair');
  assert.equal(rules.hasPair([card('8'), card('8', '♥'), card('4')]), true);
  assert.equal(rules.hasPair([card('8'), card('4'), card('8')]), false, 'only the first two ranks count');
  assert.equal(rules.hasPair([]), false);
  assert.equal(rules.hasPair([card('A')]), false);
});

test('all 100 two-hand natural combinations and all player draw scores', () => {
  for (let p = 0; p <= 9; p += 1) {
    assert.equal(rules.shouldPlayerDraw(p), p <= 5, `player total ${p}`);
    for (let b = 0; b <= 9; b += 1) {
      assert.equal(rules.isNatural(hand(p), hand(b)), p >= 8 || b >= 8, `natural ${p}/${b}`);
      assert.equal(rules.determineWinner(p, b), p === b ? 'tie' : p > b ? 'player' : 'banker');
    }
  }
  assert.equal(rules.isNatural([card('8')], hand(9)), false);
  assert.equal(rules.isNatural([...hand(8), card('K')], hand(5)), false, 'natural is an initial two-card condition');
});

test('independently enumerated banker tableau, including every face rank and null', () => {
  // Columns are player third-card POINTS 0..9. Source: NJ 13:69F-3.9 tableau.
  const drawRows = [
    '1111111111', // banker 0
    '1111111111', // banker 1
    '1111111111', // banker 2
    '1111111101', // banker 3: stand on player 8
    '0011111100', // banker 4: draw on player 2..7
    '0000111100', // banker 5: draw on player 4..7
    '0000001100', // banker 6: draw on player 6 or 7
    '0000000000', // banker 7
    '0000000000', // banker 8
    '0000000000', // banker 9
  ];
  const standColumn = '1111110000';
  const ranksAndPoints = [['10', 0], ['J', 0], ['Q', 0], ['K', 0], ['A', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 6], ['7', 7], ['8', 8], ['9', 9]];
  for (let b = 0; b <= 9; b += 1) {
    assert.equal(rules.shouldBankerDraw(b, null), standColumn[b] === '1', `banker ${b}, player stands`);
    for (const [rank, point] of ranksAndPoints) {
      assert.equal(rules.shouldBankerDraw(b, card(rank)), drawRows[b][point] === '1', `banker ${b}, player third ${rank}`);
    }
  }
  assert.equal(rules.shouldBankerDraw(5, card('K')), false);
  assert.equal(rules.shouldBankerDraw(5, null), true, 'zero-point card must not be confused with no card');
});

test('public card, hand, score and outcome boundaries reject malformed inputs', () => {
  for (const invalid of [null, undefined, {}, card('11'), card('A', 'x'), { ...card('A'), isRed: true }]) {
    assert.throws(() => rules.getCardPoint(invalid));
  }
  for (const invalid of [null, {}, [card('A'), card('2'), card('3'), card('4')], [card('bogus')]]) {
    assert.throws(() => rules.calculateScore(invalid));
  }
  for (const invalid of [-1, 10, 1.5, NaN, Infinity, '5']) {
    assert.throws(() => rules.shouldPlayerDraw(invalid));
    assert.throws(() => rules.shouldBankerDraw(invalid, null));
    assert.throws(() => rules.determineWinner(0, invalid));
  }
  assert.throws(() => rules.shouldBankerDraw(5, undefined));
  assert.throws(() => calculatePayout('unknown', false, false, bets()));
  assert.throws(() => calculatePayout('player', 1, false, bets()));
});

test('50-credit banker win preserves the 2.50 commission exactly', () => {
  const stake = Object.freeze(bets({ banker: 5000 }));
  const pCards = Object.freeze([Object.freeze(card('A')), Object.freeze(card('3'))]);
  const bCards = Object.freeze([Object.freeze(card('2')), Object.freeze(card('4'))]);
  const result = settleRound(1, pCards, bCards, stake);
  assert.deepEqual(result, { roundId: 1, winner: 'banker', pScore: 4, bScore: 6, pPair: false, bPair: false, grossPayout: 9750, netProfit: 4750 });
  assert.deepEqual(settleRound(1, pCards, bCards, stake), result, 'pure calculation does not consume a global round ID');
  assert.equal(calculatePayout('banker', false, false, bets({ banker: 100 })), 195, 'smallest whole-credit stake retains fractional credit win');
});

test('tie pushes main bets and pays tie 8:1, pairs 11:1 including original stake', () => {
  const result = settleRound(2, [card('4'), card('4')], [card('9'), card('9')], bets({ player: 5000, banker: 10_000, tie: 1000, playerPair: 2000, bankerPair: 3000 }));
  assert.deepEqual(result, { roundId: 2, winner: 'tie', pScore: 8, bScore: 8, pPair: true, bPair: true, grossPayout: 84_000, netProfit: 63_000 });
  assert.equal(calculatePayout('player', false, false, bets({ player: 5000, banker: 5000, tie: 5000, playerPair: 5000, bankerPair: 5000 })), 10_000);
  assert.equal(calculatePayout('banker', true, false, bets({ playerPair: 5000 })), 60_000, 'pair wins independently of main winner');
  assert.equal(settleRound(3, hand(9), hand(8), bets({ banker: 5000 })).netProfit, -5000);
  assert.equal(settleRound(4, hand(9), hand(8), bets()).grossPayout, 0);
});

test('all winner/pair combinations conserve exact integer stake and payout accounting', () => {
  const stake = bets({ player: 700, banker: 1100, tie: 1300, playerPair: 1700, bankerPair: 1900 });
  const base = { player: 1400, banker: 2145, tie: 13_500 };
  for (const winner of ['player', 'banker', 'tie']) {
    for (const pPair of [false, true]) {
      for (const bPair of [false, true]) {
        const expected = base[winner] + (pPair ? 20_400 : 0) + (bPair ? 22_800 : 0);
        assert.equal(calculatePayout(winner, pPair, bPair, stake), expected);
      }
    }
  }
  assert.equal(totalBets(stake), 6700);
});

test('invalid stakes, unsafe monetary magnitudes and incomplete settlement are rejected', () => {
  for (const invalid of [-100, 1, 50, 99, 100.5, NaN, Infinity, '100', Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => validateBets(bets({ player: invalid })), `invalid ${invalid}`);
  }
  for (const invalid of [null, [], {}, { player: 0 }, bets({ invalid: 100 }), Object.create(bets())]) {
    assert.throws(() => validateBets(invalid));
  }
  assert.throws(() => validateBets(bets({ banker: 900_000_000_000_000 })));
  const largeValid = 700_000_000_000_000;
  assert.equal(calculatePayout('banker', false, false, bets({ banker: largeValid })), 1_365_000_000_000_000);
  for (const roundId of [0, -1, 1.5, '1', Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => settleRound(roundId, hand(8), hand(2), bets()));
  assert.throws(() => settleRound(1, [card('A')], hand(8), bets()));
});

test('eight-deck shoe has exactly eight of every suit/rank and correct colours', () => {
  const shoe = new ShoeEngine(seeded(42));
  assert.equal(shoe.remaining, 416);
  assert.equal(shoe.shoeNumber, 1);
  assert.ok(shoe.cutPosition >= 60 && shoe.cutPosition <= 75);
  const counts = new Map();
  while (shoe.remaining) {
    const drawn = shoe.draw();
    const key = `${drawn.suit}:${drawn.value}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    assert.equal(drawn.isRed, drawn.suit === '♥' || drawn.suit === '♦');
  }
  assert.equal(counts.size, 52);
  assert.deepEqual([...counts.values()], Array(52).fill(8));
  assert.equal(shoe.shoeNumber, 1);
  assert.throws(() => shoe.draw(), /exhausted/);
  assert.equal(shoe.remaining, 0, 'draw does not silently create a new shoe');
  assert.equal(shoe.shoeNumber, 1);
  shoe.initShoe();
  assert.equal(shoe.shoeNumber, 2);
  assert.equal(shoe.remaining, 416);
  shoe.initShoe();
  assert.equal(shoe.shoeNumber, 3, 'each explicit replacement increments once');
});

test('cut threshold includes 60 and 75; crossing it preserves the current round', () => {
  for (const [fraction, cut] of [[0, 60], [1 - Number.EPSILON, 75]]) {
    const shoe = new ShoeEngine(() => fraction);
    assert.equal(shoe.cutPosition, cut);
    while (shoe.remaining > cut + 1) shoe.draw();
    assert.equal(shoe.needsShuffle(), false);
    shoe.draw();
    assert.equal(shoe.needsShuffle(), true);
    for (let cardIndex = 0; cardIndex < 6; cardIndex += 1) shoe.draw();
    assert.equal(shoe.remaining, cut - 6);
    assert.equal(shoe.shoeNumber, 1, 'cut only signals next round; it never replaces a live shoe');
  }
});

test('deterministic injection reproduces shoe order, invalid RNG fails atomically', () => {
  const a = new ShoeEngine(seeded(1234));
  const b = new ShoeEngine(seeded(1234));
  assert.equal(a.cutPosition, b.cutPosition);
  for (let n = 0; n < 416; n += 1) assert.deepEqual(a.draw(), b.draw());
  for (const invalid of [-1, 1, NaN, Infinity, '0.5']) assert.throws(() => new ShoeEngine(() => invalid));
  let valid = true;
  const shoe = new ShoeEngine(() => valid ? 0.5 : 1);
  shoe.draw();
  valid = false;
  assert.throws(() => shoe.initShoe());
  assert.equal(shoe.shoeNumber, 1);
  assert.equal(shoe.remaining, 415);
});

test('production randomness rejection discards an out-of-range word instead of introducing modulo bias', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  let calls = 0;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: (array) => {
    calls += 1;
    array[0] = calls === 1 ? 0xffff_ffff : 0;
    return array;
  } } });
  try {
    const shoe = new ShoeEngine();
    assert.equal(calls, 417, '415 shuffle draws + 1 cut draw + 1 rejected draw');
    assert.equal(shoe.remaining, 416);
    assert.equal(shoe.cutPosition, 60);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete globalThis.crypto;
  }
});

test('a deterministic 100-round simulation observes naturals and never mutates live state', () => {
  const shoe = new ShoeEngine(seeded(2026));
  let naturalCount = 0;
  let consumed = 0;
  for (let round = 1; round <= 100; round += 1) {
    if (shoe.needsShuffle()) shoe.initShoe();
    const before = shoe.remaining;
    const pCards = [shoe.draw()];
    const bCards = [shoe.draw()];
    pCards.push(shoe.draw());
    bCards.push(shoe.draw());
    if (rules.isNatural(pCards, bCards)) {
      naturalCount += 1;
      assert.equal(before - shoe.remaining, 4);
    } else {
      let pThird = null;
      if (rules.shouldPlayerDraw(rules.calculateScore(pCards))) { pThird = shoe.draw(); pCards.push(pThird); }
      if (rules.shouldBankerDraw(rules.calculateScore(bCards), pThird)) bCards.push(shoe.draw());
    }
    const settlement = settleRound(round, pCards, bCards, bets({ banker: 5000 }));
    assert.equal(settlement.roundId, round);
    assert.ok(Number.isSafeInteger(settlement.grossPayout));
    assert.ok(Number.isSafeInteger(settlement.netProfit));
    assert.ok(before - shoe.remaining >= 4 && before - shoe.remaining <= 6);
    consumed += before - shoe.remaining;
  }
  assert.ok(naturalCount > 0);
  assert.ok(consumed >= 400 && consumed <= 600);
  assert.equal(shoe.shoeNumber, 2);
});
