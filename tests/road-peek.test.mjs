import test from 'node:test';
import assert from 'node:assert/strict';
import { bigRoad, beadRoad, derivedRoad } from '../assets/app/game/roadmap.js';
import { dragProgress, REVEAL_THRESHOLD } from '../assets/app/game/peek.js';
test('dragon tails do not push the next streak to the farthest occupied column',()=>{
  const road=bigRoad([...Array(8).fill('banker'),'player','banker']);assert.deepEqual(road.cells.map(c=>[c.column,c.row]),[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[1,5],[2,5],[1,0],[2,0]]);
});
test('leading ties are retained and subsequent ties decorate the current result',()=>{
  const only=bigRoad(['tie','tie']);assert.equal(only.leadingTies,2);assert.equal(only.cells.length,0);
  const road=bigRoad(['tie','tie','player','tie','banker','tie']);assert.equal(road.cells[0].ties,3);assert.equal(road.cells[1].ties,1);assert.equal(road.cells.length,2);
});
test('bead road has six rows and derived roads wait for sufficient comparison columns',()=>{
  assert.deepEqual(beadRoad(Array(7).fill('banker')).cells.map(c=>[c.column,c.row]),[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[1,0]]);
  const equal=['banker','banker','banker','banker','player','player','player','player','banker','banker','banker','banker'];
  const eye=derivedRoad(equal,1);assert.equal(eye.cells.length,7);assert.ok(eye.cells.every(c=>c.winner==='banker'));assert.equal(derivedRoad(equal,2).cells.length,3);assert.equal(derivedRoad(equal,3).cells.length,0);
});
test('long irregular history never overwrites road cells or leaves the six-row grid',()=>{
  let seed=7;const history=Array.from({length:1000},()=>{seed=(seed*16807)%2147483647;return ['banker','player','tie'][seed%3];});
  const road=bigRoad(history);assert.equal(new Set(road.cells.map(c=>`${c.column}:${c.row}`)).size,road.cells.length);assert.ok(road.cells.every(c=>c.row>=0&&c.row<6));assert.equal(road.cells.length,history.filter(w=>w!=='tie').length);
});
test('all four corners respond to inward drag, rebound below threshold, and clamp outward drag',()=>{
  for(const corner of ['tl','tr','bl','br']){const sx=corner.endsWith('r')?300:0,sy=corner.startsWith('b')?420:0;const dx=corner.endsWith('r')?-1:1,dy=corner.startsWith('b')?-1:1;assert.ok(dragProgress(sx,sy,sx+dx*50,sy+dy*50,300,420,corner)<REVEAL_THRESHOLD);assert.ok(dragProgress(sx,sy,sx+dx*200,sy+dy*200,300,420,corner)>REVEAL_THRESHOLD);assert.equal(dragProgress(sx,sy,sx-dx*100,sy-dy*100,300,420,corner),0);assert.equal(dragProgress(sx,sy,sx+dx*1000,sy+dy*1000,300,420,corner),1);}
});
