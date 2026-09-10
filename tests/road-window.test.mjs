import test from 'node:test';
import assert from 'node:assert/strict';
import { getRoadWindow } from '../dist/src/presentation/road-window.js';

function rounds(winners) {
  return winners.map((winner, index) => ({
    roundId: index + 1, winner, pScore: winner === 'player' ? 7 : 3,
    bScore: winner === 'banker' ? 7 : 3, pPair: false, bPair: false,
    grossPayout: 0, netProfit: 0,
  }));
}
const streak = (length, winner = 'banker') => Array(length).fill(winner);

test('empty and all-opening-tie histories have no fabricated focus cell', () => {
  assert.deepEqual(getRoadWindow([]), {
    columns: [], startColumn: 0, focusColumn: null, leadingTies: 0, beads: [],
  });
  const result = getRoadWindow(rounds(['tie', 'tie', 'tie']));
  assert.deepEqual(result.columns, []);
  assert.equal(result.focusColumn, null);
  assert.equal(result.leadingTies, 3);
  assert.equal(result.beads.length, 3);
});

test('a first decisive result carries opening ties into the focused marker', () => {
  const result = getRoadWindow(rounds(['tie', 'tie', 'banker']));
  assert.equal(result.startColumn, 0);
  assert.equal(result.focusColumn, 0);
  assert.equal(result.leadingTies, 0);
  assert.deepEqual(result.columns[0][0], { winner: 'banker', tieCount: 2 });
});

test('B x80 then P retains and focuses the newest player marker at absolute column1', () => {
  const result = getRoadWindow(rounds([...streak(80), 'player']));
  assert.equal(result.columns.length, 60);
  assert.equal(result.startColumn, 0);
  assert.equal(result.focusColumn, 1);
  assert.equal(result.columns[result.focusColumn][0].winner, 'player');
  assert.ok(result.columns.flat().some(cell => cell?.winner === 'player'));
});

test('a tie after a long-tail reversal keeps focus on the left-side player marker', () => {
  const result = getRoadWindow(rounds([...streak(80), 'player', 'tie', 'tie']));
  assert.equal(result.startColumn, 0);
  assert.equal(result.focusColumn, 1);
  assert.deepEqual(result.columns[result.focusColumn][0], { winner: 'player', tieCount: 2 });
});

test('the latest tail marker is kept within a bounded sixty-column window', () => {
  const result = getRoadWindow(rounds(streak(80)));
  assert.equal(result.columns.length, 60);
  assert.equal(result.startColumn, 15);
  assert.equal(result.focusColumn, 59);
  assert.equal(result.startColumn + result.focusColumn, 74);
  assert.equal(result.columns[result.focusColumn][5].winner, 'banker');
});

test('bead history121 retains the original row positions and history126 drops one whole column', () => {
  const source = rounds(Array.from({ length: 126 }, (_, index) => index % 2 === 0 ? 'banker' : 'player'));
  const at121 = getRoadWindow(source.slice(0, 121));
  const at126 = getRoadWindow(source);
  assert.equal(at121.beads.length, 121);
  assert.equal(at121.beads[0].roundId, 1);
  assert.equal(at121.beads.at(-1).roundId, 121);
  assert.equal(at126.beads.length, 120);
  assert.equal(at126.beads[0].roundId, 7);
  assert.equal(at126.beads.at(-1).roundId, 126);
  for (const result of [at121, at126]) {
    for (let index = 0; index < result.beads.length; index += 1) {
      assert.equal(index % 6, (result.beads[index].roundId - 1) % 6);
    }
  }
});

test('bead rendering remains bounded and aligned at each removal boundary', () => {
  for (const length of [119, 120, 121, 125, 126, 127, 131, 132, 200, 500]) {
    const result = getRoadWindow(rounds(streak(length)));
    assert.ok(result.beads.length <= 125);
    assert.equal((result.beads[0].roundId - 1) % 6, 0);
    assert.equal(result.beads.at(-1).roundId, length);
    assert.ok(result.columns.length <= 60);
    assert.ok(result.focusColumn >= 0 && result.focusColumn < result.columns.length);
  }
});

test('window snapshots cannot mutate input history or a later generated road', () => {
  const history = rounds(['banker', 'banker', 'tie', 'player']);
  const before = structuredClone(history);
  const result = getRoadWindow(history);
  result.beads[0].winner = 'player';
  result.columns[0][0].tieCount = 999;
  assert.deepEqual(history, before);
  const fresh = getRoadWindow(history);
  assert.equal(fresh.beads[0].winner, 'banker');
  assert.equal(fresh.columns[0][0].tieCount, 0);
});
