import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../assets/app/game/session.js';
import { GameRunner } from '../assets/app/game/runner.js';
function fixture({failDeal=false,peek=true}={}){
  const events=[],phases=[],errors=[];let id=0;const session=new GameSession(()=>{},undefined,p=>phases.push(p),max=>Math.floor(max/2),()=>`runner-${++id}`);
  const controller=new AbortController();
  const view={motion:{reset(){},wait:async()=>{},signal:controller.signal,cancel(){controller.abort();}},audio:{play(){}},toast:message=>events.push(['toast',message]),updateControls(){},finishBetAnimations:async()=>{},clearTable(){},
    deal:async deal=>{events.push(['deal',deal.side,deal.index]);if(failDeal)throw new DOMException('Cancelled','AbortError');},flip:async deal=>events.push(['flip',deal.side,deal.index]),
    showResult:result=>events.push(['result',result.id]),renderFinancial(){},renderRoads(){},collect:async()=>events.push(['collect']),payout:async()=>events.push(['payout']),renderBets(){},cleanupFlights(){},showFinalCards:result=>events.push(['restored',result.id])};
  const peeker={open:async()=>events.push(['peek'])};
  const runner=new GameRunner(session,view,peeker,()=>({autoReveal:!peek,reduced:false,quick:false}),message=>errors.push(message));
  return {session,runner,events,phases,errors};
}
test('complete controller flow preserves order, peek transitions and exactly one payout under double click',async()=>{
  const f=fixture();f.session.place('player',5000);await Promise.all([f.runner.start(),f.runner.start()]);
  assert.equal(f.session.history.length,1);assert.equal(f.session.pending,null);assert.equal(f.session.state.phase,'BETTING_OPEN');assert.equal(f.runner.running,false);
  assert.deepEqual(f.events.filter(e=>e[0]==='deal').slice(0,4).map(e=>e.slice(1)),[['player',0],['banker',0],['player',1],['banker',1]]);
  assert.equal(f.events.filter(e=>e[0]==='payout').length,1);assert.ok(f.phases.includes('PLAYER_PEEK'));assert.equal(f.errors.length,0);
});
test('interrupted presentation completes the precommitted hand and returns controls without a second settlement',async()=>{
  const f=fixture({failDeal:true});f.session.place('banker',5000);await f.runner.start();
  assert.equal(f.session.history.length,1);assert.ok(f.events.some(e=>e[0]==='restored'));assert.equal(f.session.pending,null);assert.equal(f.session.state.canBet,true);assert.equal(f.errors.length,0);
  const balance=f.session.balance;assert.equal(f.session.settlePending(),null);assert.equal(f.session.balance,balance);
});
test('automatic reveal skips peek interactions without changing the dealing protocol',async()=>{
  const f=fixture({peek:false});f.session.place('player',5000);await f.runner.start();assert.equal(f.events.filter(e=>e[0]==='peek').length,0);assert.equal(f.session.history.length,1);assert.equal(f.errors.length,0);
});
