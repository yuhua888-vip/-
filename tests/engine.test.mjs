import test from 'node:test';
import assert from 'node:assert/strict';
import { point, score, isNatural, hasPair, bankerDraws, playerDraws, settle, dealRound, Shoe, emptyBets, secureRandomInt } from '../assets/app/game/engine.js';
const c=(rank,suit='spades',id=`${rank}-${suit}`)=>({rank,suit,id});
const bet=(spot,units)=>({...emptyBets(),[spot]:units});
const hand=(values,bets=emptyBets(),mode='commission')=>{let index=0;return dealRound(()=>{const rank=values[index++];assert.notEqual(rank,undefined,'Unexpected draw');return c(rank,'spades',String(index));},'fixture',1,bets,mode);};
test('all thirteen ranks, modulo ten, natural length guard and rank-based pairs',()=>{
  assert.deepEqual(Array.from({length:13},(_,i)=>point(c(i+1))),[1,2,3,4,5,6,7,8,9,0,0,0,0]);
  assert.equal(score([c(9),c(8),c(7)]),4);assert.equal(score([]),0);
  assert.equal(isNatural([c(3),c(5)],[c(1),c(2)]),true);
  assert.equal(isNatural([c(3),c(3),c(3)],[c(1),c(2)]),false);
  assert.equal(hasPair([c(12),c(11)]),false);assert.equal(hasPair([c(12),c(12,'hearts')]),true);assert.equal(hasPair([c(1),c(2),c(1)]),false);
});
test('every third-card table entry, including no player third card',()=>{
  const table=['1111111111','1111111111','1111111111','1111111101','0011111100','0000111100','0000001100','0000000000','0000000000','0000000000'];
  for(let banker=0;banker<=9;banker++)for(let third=0;third<=9;third++)assert.equal(bankerDraws(banker,third),table[banker][third]==='1',`Banker ${banker}, third ${third}`);
  for(let value=0;value<=9;value++){assert.equal(bankerDraws(value,null),value<=5);assert.equal(playerDraws(value),value<=5);}
});
test('P1 B1 P2 B2 order, natural stops both hands, five and six card sequences',()=>{
  const natural=hand([3,4,5,1]);assert.deepEqual(natural.deals.map(d=>[d.side,d.index,d.card.rank]),[['player',0,3],['banker',0,4],['player',1,5],['banker',1,1]]);assert.equal(natural.result.natural,true);
  const five=hand([4,2,9,3,8]);assert.equal(five.deals.length,5);assert.equal(five.result.winner,'banker');assert.equal(five.result.bankerScore,5);
  const six=hand([1,2,1,2,6,3]);assert.equal(six.deals.length,6);assert.equal(six.result.playerScore,8);assert.equal(six.result.bankerScore,7);assert.equal(six.result.natural,false);
});
test('commission preserves 97.5 return for a 50 stake; banker six is an explicit different rule',()=>{
  const p=[c(1),c(2)],b=[c(3),c(3)];
  const classic=settle('a',1,p,b,bet('banker',5000),'commission');assert.equal(classic.gross,9750);assert.equal(classic.net,4750);
  const six=settle('b',1,p,b,bet('banker',5000),'super-six');assert.equal(six.gross,7500);assert.equal(six.net,2500);
  const seven=settle('c',1,p,[c(3),c(4)],bet('banker',5000),'super-six');assert.equal(seven.gross,10000);
});
test('tie refunds main stakes, pays 8:1 and settles pairs independently',()=>{
  const bets={player:5000,banker:10000,tie:5000,playerPair:1000,bankerPair:2000};
  const r=settle('tie',1,[c(2),c(2)],[c(1),c(3)],bets,'commission');
  assert.deepEqual(r.returns,{player:5000,banker:10000,tie:45000,playerPair:12000,bankerPair:0});assert.equal(r.gross,72000);assert.equal(r.net,49000);
});
test('416 unique cards, eight of every rank/suit, inclusive cut range and no mid-hand refill',()=>{
  const shoe=new Shoe(max=>max-1);assert.equal(shoe.remaining,416);assert.equal(shoe.cut,75);
  const cards=Array.from({length:416},()=>shoe.draw());assert.equal(new Set(cards.map(x=>x.id)).size,416);
  for(const suit of ['spades','hearts','clubs','diamonds'])for(let rank=1;rank<=13;rank++)assert.equal(cards.filter(c=>c.suit===suit&&c.rank===rank).length,8);
  assert.throws(()=>shoe.draw(),/局中/);assert.equal(shoe.remaining,0);
  const low=new Shoe(()=>0);assert.equal(low.cut,60);for(let i=0;i<355;i++)low.draw();assert.equal(low.needsShuffle,false);low.draw();assert.equal(low.needsShuffle,true);
});
test('shoe snapshots reproduce the next draws and random range validation rejects bad input',()=>{
  const shoe=new Shoe(max=>Math.floor(max/2));for(let i=0;i<33;i++)shoe.draw();const copy=new Shoe(undefined,shoe.snapshot());
  assert.deepEqual(Array.from({length:20},()=>copy.draw()),Array.from({length:20},()=>shoe.draw()));assert.throws(()=>secureRandomInt(0));assert.throws(()=>secureRandomInt(NaN));
});
test('2,000 seeded rounds conserve shoe cards and keep payouts integral across rule variants',()=>{
  let seed=71826;const random=max=>{seed=(1664525*seed+1013904223)>>>0;return seed%max;};const shoe=new Shoe(random);let results=0;
  for(let number=1;number<=2000;number++){if(shoe.needsShuffle)shoe.shuffle();const before=shoe.remaining;const plan=dealRound(()=>shoe.draw(),`run-${number}`,number,{player:5000,banker:5000,tie:5000,playerPair:5000,bankerPair:5000},number%2?'commission':'super-six');assert.equal(before-shoe.remaining,plan.deals.length);assert.ok(plan.deals.length>=4&&plan.deals.length<=6);assert.ok(Number.isSafeInteger(plan.result.gross));assert.ok(plan.result.playerScore>=0&&plan.result.playerScore<=9);assert.ok(plan.result.bankerScore>=0&&plan.result.bankerScore<=9);results++;}assert.equal(results,2000);
});
