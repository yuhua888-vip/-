import test from 'node:test';
import assert from 'node:assert/strict';
import { GameStateMachine } from '../dist/src/game/state.js';

const initialDeal = ['BETTING_CLOSED', 'PREPARE_DEAL', 'DEALING_INITIAL', 'INITIAL_REVEAL', 'THIRD_CARD_EVAL'];
const finish = ['REVEAL', 'RESULT', 'PAYOUT', 'RESET', 'BETTING'];

test('a new table accepts betting but cannot jump directly to dealing, payout or reset', () => {
  const machine = new GameStateMachine();
  assert.equal(machine.phase, 'BETTING');
  for (const next of ['DEALING_INITIAL', 'RESULT', 'PAYOUT', 'RESET', 'BETTING', 'UNKNOWN']) {
    assert.throws(() => machine.transition(next), /Invalid transition/);
    assert.equal(machine.phase, 'BETTING');
  }
});

for (const draws of [[], ['PLAYER_DRAW'], ['BANKER_DRAW'], ['PLAYER_DRAW', 'BANKER_DRAW']]) {
  test(`a round supports the legal draw path ${draws.join(' then ') || 'both stand / natural'}`, () => {
    const machine = new GameStateMachine();
    for (const next of [...initialDeal, ...draws, ...finish]) {
      machine.transition(next);
      assert.equal(machine.phase, next);
    }
    // A completed round permits a fresh lock, not a second payout of the old round.
    assert.throws(() => machine.transition('PAYOUT'), /Invalid transition/);
    machine.transition('BETTING_CLOSED');
    assert.equal(machine.phase, 'BETTING_CLOSED');
  });
}

test('shoe replacement is allowed after betting closes and before preparation only', () => {
  const machine = new GameStateMachine();
  machine.transition('BETTING_CLOSED');
  machine.transition('SHUFFLING');
  machine.transition('PREPARE_DEAL');
  machine.transition('DEALING_INITIAL');
  assert.throws(() => machine.transition('SHUFFLING'), /Invalid transition/);
  assert.equal(machine.phase, 'DEALING_INITIAL');
});

test('a banker third card cannot be followed by a late player third card', () => {
  const machine = new GameStateMachine();
  for (const next of [...initialDeal, 'BANKER_DRAW']) machine.transition(next);
  assert.throws(() => machine.transition('PLAYER_DRAW'), /Invalid transition/);
  assert.equal(machine.phase, 'BANKER_DRAW');
  machine.transition('REVEAL');
});

test('recovery from a locked or settled table requires returning to betting', () => {
  for (const path of [['BETTING_CLOSED'], [...initialDeal, ...finish.slice(0, 3)]]) {
    const machine = new GameStateMachine();
    for (const next of path) machine.transition(next);
    machine.recover();
    assert.equal(machine.phase, 'RECOVERING');
    assert.throws(() => machine.transition('PAYOUT'), /Invalid transition/);
    machine.transition('BETTING');
    assert.equal(machine.phase, 'BETTING');
  }
});
