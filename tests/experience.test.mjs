import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationDirector, dealTiming, revealTiming, tuning, DEFAULT_TUNING, timelineObservers } from '../assets/app/animations/director.js';
import { Motion } from '../assets/app/animations/motion.js';
import { peekOwnership } from '../assets/app/game/ownership.js';
import { emptyBets } from '../assets/app/game/engine.js';
import { deformPaper, springStep, resistedProgress } from '../assets/app/game/paper.js';
const card=rank=>({rank,suit:'spades',id:String(rank)});
test('cinematic card phrases exceed two seconds, with a longer opening and held fourth card',()=>{
  const total=t=>Object.values(t).reduce((a,b)=>a+b,0);
  const times=[{side:'player',index:0},{side:'banker',index:0},{side:'player',index:1},{side:'banker',index:1}].map(dealTiming);
  for(const t of times){assert.ok(t.prepare>=300);assert.ok(t.extract>=250);assert.ok(t.travel>=600);assert.ok(t.contact>=300);assert.ok(t.pause>=250);assert.ok(total(t)>2000);}
  assert.ok(total(times[0])>total(times[1]));assert.ok(total(times[2])<total(times[1]));assert.ok(times[3].pause>times[2].pause);assert.ok(times.reduce((s,t)=>s+total(t),0)>9000);
});
test('reveal has a 940ms physical turn before score display; suspense only consumes visible information',()=>{
  const initial={player:[],banker:[]};const normal=revealTiming({side:'player',index:0},initial);
  assert.equal(normal.lift+normal.turn+normal.land,940);assert.ok(normal.score>=200);
  const third=revealTiming({side:'banker',index:2},{player:[card(3),card(4)],banker:[card(2),card(3)]});assert.ok(third.pause>normal.pause);assert.ok(third.turn>normal.turn);assert.equal(third.focus,true);
  assert.equal(revealTiming({side:'banker',index:1},{player:[card(4),card(4)],banker:[card(2)]}).reason,'visible-natural');
});
test('animation director awaits every cue, reports actual boundaries and cancels before the next cue',async()=>{
  const controller=new AbortController(),events=[],actions=[];const observe=e=>events.push(e.edge+':'+e.cue);timelineObservers.add(observe);
  const director=new AnimationDirector({signal:controller.signal,scale:1,wait:async()=>{}});
  try{await assert.rejects(director.play('test',[{name:'draw',duration:350,enter:()=>actions.push('draw'),run:async()=>{await Promise.resolve();actions.push('land');controller.abort();}},{name:'next',duration:500,enter:()=>actions.push('next')}]),{name:'AbortError'});assert.deepEqual(actions,['draw','land']);assert.deepEqual(events,['start:draw','cancel:draw']);}finally{timelineObservers.delete(observe);}
});
test('slow motion is one clock, and reduced-motion preference does not speed the hand up',()=>{
  const motion=new Motion();try{motion.reduced=true;assert.equal(motion.scale,1);tuning.playbackRate=.25;assert.equal(motion.scale,4);tuning.playbackRate=.5;assert.equal(motion.scale,2);}finally{Object.assign(tuning,DEFAULT_TUNING);}
});
test('every legal combination of five wagers has defined peek ownership and fallback',()=>{
  const spots=Object.keys(emptyBets());for(let mask=1;mask<32;mask++){const bets=emptyBets();spots.forEach((spot,i)=>bets[spot]=mask&(1<<i)?5000:0);let ownership=peekOwnership(bets);if(ownership.needsChoice)ownership=peekOwnership(bets,'player');assert.ok(ownership.owned.length>0);assert.deepEqual(new Set(ownership.order),new Set(['player','banker']));if(bets.player&&bets.banker)assert.equal(ownership.owned.length,2);}
});
test('paper deformation is local, mirrors in four corners, and returns to a flat front',()=>{
  for(const p of [0,.1,.3,.62,.85,1]){const a=deformPaper(20,30,p,'tl'),b=deformPaper(280,30,p,'tr'),c=deformPaper(20,390,p,'bl'),d=deformPaper(280,390,p,'br');assert.ok(Math.abs(a.x+b.x-300)<1e-8);assert.ok(Math.abs(a.y+c.y-420)<1e-8);assert.equal(a.z,d.z);for(const v of Object.values(a))assert.ok(Number.isFinite(v));}
  const anchor=deformPaper(300,420,.2,'tl');assert.equal(anchor.x,300);assert.equal(anchor.y,420);assert.equal(anchor.z,0);
  assert.ok(deformPaper(0,0,.3,'tl').z>0);const flat=deformPaper(80,90,1,'br');assert.equal(flat.x,220);assert.equal(flat.y,90);assert.ok(Math.abs(flat.z)<1e-8);assert.equal(flat.normal,-1);
});
test('paper has resistance and a stable spring at 30, 60 and 120Hz, including a suspended-frame spike',()=>{
  assert.ok(resistedProgress(.5,1.2)<.5);assert.equal(resistedProgress(-1,1.2),0);assert.equal(resistedProgress(2,1.2),1);
  for(const rate of [30,60,120]){let p=.54,v=0;for(let frame=0;frame<rate*3;frame++){const step=springStep(p,v,0,frame===3?1:1/rate,170);p=step.position;v=step.velocity;assert.ok(p>=0&&p<=1);assert.ok(Number.isFinite(v));}assert.ok(p<.001);}
});

test('curl and its completion turn stay inside the mobile canvas for every corner and drag direction',()=>{
  for(const corner of ['tl','tr','bl','br'])for(let step=0;step<=100;step++)for(const direction of [0,.25,.5,.75,1])for(let y=0;y<=12;y++)for(let x=0;x<=8;x++){
    const p=deformPaper(x/8*300,y/12*420,step/100,corner,direction),perspective=1-p.z/2400;
    const px=(p.x-150)/perspective+210,py=(p.y-210)/perspective+275;
    assert.ok(px>=0&&px<=420&&py>=0&&py<=550,`${corner} ${step} ${direction}: ${px},${py}`);
  }
});

test('reduced motion clears inherited edge-on transforms so revealed faces remain visible',async()=>{
  const motion=new Motion();motion.reduced=true;let frames;
  const image={style:{transform:'rotateY(-90deg)',clipPath:'inset(0 0 74% 0)'},animate:(keys)=>{frames=keys;return{finished:Promise.resolve(),playState:'finished',commitStyles(){},cancel(){}};}};
  await motion.animate(image,[{transform:'rotateY(-90deg)',clipPath:'inset(0 0 74% 0)'},{transform:'rotateY(0deg)',clipPath:'none'}],800);
  assert.equal(image.style.transform,'none');assert.equal(image.style.clipPath,'none');assert.ok(frames.every(frame=>!('transform' in frame)));
});
