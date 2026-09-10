import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBigRoad } from '../dist/src/game/roadmap.js';

const rounds = (letters) => [...letters].map((letter) => ({ winner: ({ P: 'player', B: 'banker', T: 'tie' })[letter] }));
const cells = (road) => road.columns.flat().filter(Boolean);
const coordinates = (road, winner) => road.columns.flatMap((column, col) => column.flatMap((cell, row) => cell?.winner === winner ? [[col, row]] : []));

test('empty and all-tie histories preserve opening ties without inventing a winner', () => {
  assert.deepEqual(generateBigRoad([]), { columns: [], leadingTies: 0 });
  assert.deepEqual(generateBigRoad(rounds('TTT')), { columns: [], leadingTies: 3 });
  const road = generateBigRoad(rounds('TTPTTBTT'));
  assert.equal(road.leadingTies, 0);
  assert.deepEqual(road.columns[0][0], { winner: 'player', tieCount: 4 });
  assert.deepEqual(road.columns[1][0], { winner: 'banker', tieCount: 2 });
  assert.equal(cells(road).length, 2);
});

test('a new streak starts beside the previous origin, not at the end of its dragon', () => {
  const road = generateBigRoad(rounds('PPPPPPPPBB'));
  assert.deepEqual(coordinates(road, 'player'), [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 5], [2, 5]]);
  assert.deepEqual(coordinates(road, 'banker'), [[1, 0], [1, 1]]);
  assert.equal(road.columns.length, 3);
});

test('a dragon tail stays horizontal after meeting another streak', () => {
  const road = generateBigRoad(rounds('PPPPPPPPBBBBBBBBPPPPPPPP'));
  assert.deepEqual(coordinates(road, 'banker'), [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4]]);
  assert.deepEqual(road.columns[2][0], { winner: 'player', tieCount: 0 });
  assert.deepEqual(road.columns[6][3], { winner: 'player', tieCount: 0 });
  assert.equal(cells(road).length, 24, 'a crossing never overwrites an earlier result');
  assert.deepEqual(road.columns[2][5], { winner: 'player', tieCount: 0 }, 'old tail remains intact');
});

test('ties annotate the actual latest dragon cell', () => {
  const road = generateBigRoad(rounds('PPPPPPPPTTTBTT'));
  assert.equal(road.columns[2][5].tieCount, 3);
  assert.equal(road.columns[1][0].tieCount, 2);
  assert.equal(cells(road).length, 9);
});

test('long alternating dragons retain every result with at most six rows', () => {
  let history = '';
  for (let streak = 0; streak < 90; streak += 1) {
    history += (streak % 2 ? 'B' : 'P').repeat(8 + streak % 19) + 'TT';
  }
  history = 'TTT' + history;
  const inputs = Object.freeze(rounds(history).map(Object.freeze));
  const road = generateBigRoad(inputs);
  assert.equal(cells(road).length, [...history].filter((letter) => letter !== 'T').length);
  assert.equal(cells(road).reduce((sum, cell) => sum + cell.tieCount, road.leadingTies), [...history].filter((letter) => letter === 'T').length);
  assert.ok(road.columns.every((column) => column.length === 6));
  assert.deepEqual(generateBigRoad(inputs), road, 'road generation has no shared mutable history');
});

test('short alternation produces one occupied top cell per column', () => {
  const road = generateBigRoad(rounds('PBPBPBPBPB'));
  assert.equal(road.columns.length, 10);
  for (let col = 0; col < 10; col += 1) {
    assert.equal(road.columns[col][0].winner, col % 2 ? 'banker' : 'player');
    assert.ok(road.columns[col].slice(1).every((cell) => cell === null));
  }
});

test('road rejects corrupt external history', () => {
  for (const invalid of [null, {}, 'PBP', [null], [{}], [{ winner: 'unknown' }]]) assert.throws(() => generateBigRoad(invalid));
});
