import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../assets/app/game/session.js';
import { GameRunner } from '../assets/app/game/runner.js';
function fixture({failDeal=false,peek=true,opponent=false,selected="banker",ranks=null}={}){
  const events=[],phases=[],errors=[];let id=0;const session=new GameSession(()=>{},undefined,p=>phases.push(p),max=>Math.floor(max/2),()=>`runner-${++id}`);
  if(ranks){session.shoe.cards=ranks.map((rank,i)=>({id:`fixture-${i}`,rank,suit:i%2?"hearts":"spades"})).reverse();session.shoe.cut=0;}
  const controller=new AbortController();
  const view={motion:{reset(){},wait:async()=>{},signal:controller.signal,cancel(){controller.abort();}},audio:{play(){}},toast:message=>events.push(['toast',message]),updateControls(){},finishBetAnimations:async()=>{},countdown:async()=>events.push(["countdown"]),focus(){},clearTable(){},
    deal:async deal=>{events.push(['deal',deal.side,deal.index]);if(failDeal)throw new DOMException('Cancelled','AbortError');},flip:async deal=>events.push(['flip',deal.side,deal.index]),
    showResult:result=>events.push(['result',result.id]),renderFinancial(){},renderRoads(){},collect:async()=>events.push(['collect']),payout:async()=>events.push(['payout']),renderBets(){},cleanupFlights(){},showFinalCards:result=>events.push(['restored',result.id])};
  const peeker={open:async(card,label)=>{events.push(['peek',card.id,label]);return true;},chooseOpponent:async side=>{events.push(['opponent-choice',side]);return opponent;},chooseSide:async()=>{events.push(['side-choice',selected]);return selected;}};
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

for(const owner of ['banker','player'])test(`${owner} wager owns every card, opponent reveals first, including a third card`,async()=>{
  const f=fixture({ranks:[1,2,2,3,6,3]});f.session.place(owner,5000);await f.runner.start();
  assert.equal(f.errors.length,0);assert.equal(f.session.history.length,1);
  const flips=f.events.filter(e=>e[0]==='flip').map(e=>e.slice(1));const opponent=owner==='banker'?'player':'banker';
  assert.deepEqual(flips.slice(0,4),[[opponent,0],[opponent,1],[owner,0],[owner,1]]);
  const peeks=f.events.filter(e=>e[0]==='peek');assert.equal(peeks.length,3);assert.ok(peeks.every(e=>e[2].startsWith(owner==='banker'?'庄':'闲')));
  assert.deepEqual(f.events.find(e=>e[0]==='opponent-choice'),['opponent-choice',opponent]);
});
test('choosing to squeeze the opponent includes both opponent cards and their third card',async()=>{
  const f=fixture({opponent:true,ranks:[1,2,2,3,6,3]});f.session.place('banker',5000);await f.runner.start();assert.equal(f.events.filter(e=>e[0]==='peek').length,6);assert.equal(f.session.history.length,1);
});
test('simultaneous player and banker wagers give six-card manual ownership without a choice dialog',async()=>{
  const f=fixture({ranks:[1,2,2,3,6,3]});f.session.place('player',5000);f.session.place('banker',10000);await f.runner.start();assert.equal(f.events.filter(e=>e[0]==='peek').length,6);assert.ok(!f.events.some(e=>e[0].endsWith('choice')));
});
for(const spot of ['tie','playerPair','bankerPair'])test(`${spot}-only wager selects ownership and terminates normally`,async()=>{
  const f=fixture({selected:'banker',ranks:[4,4,4,5]});f.session.place(spot,5000);await f.runner.start();assert.equal(f.events.filter(e=>e[0]==='side-choice').length,1);assert.equal(f.events.filter(e=>e[0]==='peek').length,2);assert.equal(f.session.history.length,1);assert.equal(f.session.pending,null);
});
