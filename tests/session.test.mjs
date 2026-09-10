import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../assets/app/game/session.js';
import { Ledger } from '../assets/app/game/ledger.js';
import { StateMachine } from '../assets/app/game/state.js';
import { emptyBets } from '../assets/app/game/engine.js';
import { parseSnapshot } from '../assets/app/services/storage.js';
let counter=0;const id=()=>`test-${++counter}`;
const make=(save=()=>{},snapshot)=>new GameSession(save,snapshot,undefined,max=>Math.floor(max/2),id);
test('bet, deliberate repeated bet, double, single undo and clear conserve total funds',()=>{
  const session=make();session.place('player',5000);session.place('player',5000);assert.equal(session.bets.player,10000);assert.equal(session.balance,9990000);
  session.double();assert.equal(session.bets.player,20000);session.undo();assert.equal(session.bets.player,10000);session.clear();assert.equal(session.balance,10000000);assert.deepEqual(session.bets,emptyBets());
});
test('invalid spot, negative, zero, nonfinite, fractional and unaffordable stakes change nothing',()=>{
  const session=make(),before=session.snapshot();
  for(const amount of [-100,0,NaN,Infinity,1050,10_000_001_000])assert.throws(()=>session.place('player',amount));
  assert.throws(()=>session.place('not-a-spot',100));assert.deepEqual(session.snapshot(),before);
});
test('rebet includes refundable current stake and replaces it atomically',()=>{
  const data=make().snapshot();data.ledger={opening:10000,balance:10000,entries:[],appliedIds:[]};data.lastBets={...emptyBets(),banker:8000};
  const session=make(()=>{},data);session.place('player',6000);assert.equal(session.balance,4000);session.rebet();assert.equal(session.balance,2000);assert.equal(session.bets.banker,8000);assert.equal(session.bets.player,0);
  session.lastBets={...emptyBets(),banker:11000};const before=session.snapshot();assert.throws(()=>session.rebet());assert.deepEqual(session.snapshot(),before);
});
test('duplicate deal and rule changes while staked/locked are rejected',()=>{
  const s=make();s.place('banker',5000);assert.throws(()=>s.setRule('super-six'));s.prepareRound();assert.throws(()=>s.prepareRound());assert.throws(()=>s.place('tie',5000));assert.throws(()=>s.clear());assert.throws(()=>s.setRule('super-six'));assert.equal(s.state.phase,'BETTING_WARNING');
});
test('settlement and nonconsecutive ledger replays are idempotent',()=>{
  const s=make();s.place('banker',5000);const plan=s.prepareRound();const before=s.balance;const result=s.settlePending();assert.equal(s.balance,before+plan.result.gross);assert.equal(result.id,plan.result.id);const snapshot=s.snapshot();assert.equal(s.settlePending(),null);assert.deepEqual(s.snapshot(),snapshot);
  const ledger=new Ledger();assert.equal(ledger.transact('A',100,'PAYOUT','1'),true);assert.equal(ledger.transact('B',200,'PAYOUT','2'),true);assert.equal(ledger.transact('A',100,'PAYOUT','1'),false);assert.equal(ledger.balance,10000300);
});
test('refresh during a pending hand completes the original result once, preserving shoe and last bet',()=>{
  let saved;const save=snapshot=>{saved=JSON.stringify(snapshot);};const first=make(save);first.place('banker',5000);const plan=first.prepareRound();const balance=first.balance;const shoe=first.shoe.snapshot();
  const second=make(save,parseSnapshot(saved));assert.equal(second.recovered,true);assert.equal(second.balance,balance+plan.result.gross);assert.equal(second.history.length,1);assert.deepEqual(second.shoe.snapshot(),shoe);assert.equal(second.lastBets.banker,5000);assert.equal(second.pending,null);
  const third=make(save,parseSnapshot(saved));assert.equal(third.recovered,false);assert.equal(third.balance,second.balance);assert.equal(third.history.length,1);
});
test('save failure rolls back a bet, a prepared shoe and a settlement without losing the prior pending record',()=>{
  let fail=false;const s=make(()=>{if(fail)throw Error('quota');});s.place('player',5000);let before=s.snapshot();fail=true;assert.throws(()=>s.place('tie',5000));assert.deepEqual(s.snapshot(),before);
  assert.throws(()=>s.prepareRound());assert.deepEqual(s.snapshot(),before);assert.equal(s.state.canBet,true);
  fail=false;s.prepareRound();before=s.snapshot();fail=true;assert.throws(()=>s.settlePending());assert.deepEqual(s.snapshot(),before);
  fail=false;assert.ok(s.settlePending());assert.equal(s.pending,null);
});
test('saved balance/ledger corruption and duplicate shoe cards fail closed',()=>{
  const s=make();s.place('player',5000);const data=s.snapshot();data.ledger.balance+=100;assert.throws(()=>parseSnapshot(JSON.stringify(data)));
  const duplicate=s.snapshot();duplicate.shoe.cards[1]=duplicate.shoe.cards[0];assert.throws(()=>parseSnapshot(JSON.stringify(duplicate)));
  assert.throws(()=>parseSnapshot('{broken'));assert.throws(()=>parseSnapshot('{"version":9}'));
});
test('state machine rejects skipped settlement and allows the full legal round route',()=>{
  const state=new StateMachine();assert.throws(()=>state.move('PAYOUT'));const route=['BETTING_WARNING','BETTING_CLOSED','PREPARE_DEAL','DEAL_PLAYER','DEAL_BANKER','DEAL_PLAYER','DEAL_BANKER','REVEAL','PLAYER_PEEK','REVEAL','PLAYER_DRAW','REVEAL','BANKER_DRAW','REVEAL','RESULT','COLLECT_CHIPS','PAYOUT','RESET','BETTING_OPEN'];for(const phase of route)state.move(phase);assert.equal(state.canBet,true);
});
test('ledger checkpoint remains verifiable after 2,001 records and retains old IDs',()=>{
  const ledger=new Ledger();for(let i=0;i<2001;i++)ledger.transact(String(i),100,'PAYOUT',String(i));const restored=new Ledger(ledger.snapshot());assert.equal(restored.balance,10200100);assert.equal(restored.snapshot().entries.length,2000);assert.equal(restored.transact('0',100,'PAYOUT','0'),false);
});
