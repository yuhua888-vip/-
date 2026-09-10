import type { ready } from '../main.js';
import type { TuningKey, TimelineEvent } from '../animations/director.js';
import { DEFAULT_TUNING } from '../animations/director.js';
import { dealRound, emptyBets, type Card } from '../game/engine.js';
type Context=Exclude<Awaited<typeof ready>,void>;
const definitions:[TuningKey,string,number,number,number][]=[
  ['dealSpeed','Deal Speed',.65,1.3,.05],['flight','Card Flight · ms',450,1200,10],['landing','Card Landing · ms',250,700,10],['gap','Between Cards · ms',250,1000,10],
  ['revealSpeed','Reveal Speed',.65,1.2,.05],['resistance','Peek Resistance',.85,2,.05],['threshold','Peek Threshold',.35,.85,.01],['spring','Peek Spring',70,260,5],
  ['camera','Camera Zoom',0,.05,.005],['audio','Audio Volume',0,1,.05],['chip','Chip Flight · ms',400,1200,10],['dealerSpeed','Dealer Speed',.7,1.4,.05],
];
export function mountDebug(context:Context):void{
  if(document.querySelector('#animation-debug'))return;
  const {view,runner,peek,audio,tuning,timelineObservers}=context;
  const panel=document.createElement('details');panel.id='animation-debug';panel.innerHTML='<summary>Animation Studio · DEV</summary><div class="debug-content"><div class="debug-rate" role="group" aria-label="慢动作倍率"></div><p>参数对下一个动作生效。调试播放使用独立牌序，不扣筹码。</p><div class="debug-tuning"></div><div class="debug-scenarios"><select aria-label="调试牌型"><option value="six">双方补牌 · 高悬念</option><option value="natural">Natural 8 / 9</option><option value="tie">两张和局</option></select><button data-preview="deal">播放发牌</button><button data-preview="reveal">播放开牌</button><button data-preview="peek">四角咪牌</button><button data-stop>停止</button><button data-reset>恢复参数</button></div><output class="debug-performance">尚未采样</output><ol class="debug-trace"></ol></div>';
  const style=document.createElement('style');style.textContent='#animation-debug{position:fixed;right:12px;bottom:12px;z-index:300;width:310px;max-width:calc(100vw - 24px);background:#10252bef;border:1px solid #94b2a365;border-radius:12px;color:#dce4d6;font:12px/1.4 system-ui;box-shadow:0 10px 40px #0009}#animation-debug summary{padding:13px;cursor:pointer}#animation-debug .debug-content{padding:0 13px 13px;max-height:78svh;overflow:auto}#animation-debug label{display:grid;grid-template-columns:1fr 100px 40px;gap:8px;align-items:center;margin:10px 0}#animation-debug input{width:100%;accent-color:#c6b68e}#animation-debug output{text-align:right;font-variant-numeric:tabular-nums}#animation-debug button,#animation-debug select{min-height:32px;border:1px solid #88a79950;border-radius:6px;background:#1d383e;color:#dae6d5;padding:5px 8px;font-size:12px}#animation-debug button[aria-pressed="true"]{background:#c4bd9e;color:#173235}#animation-debug .debug-rate,#animation-debug .debug-scenarios{display:flex;gap:7px;flex-wrap:wrap}#animation-debug .debug-trace{padding-left:16px;font:10px/1.6 monospace;max-height:150px;overflow:auto}#animation-debug .debug-performance{display:block;margin:12px 0;text-align:left}#animation-debug p{color:#9fb8b1;font-size:11px}';document.head.append(style);document.body.append(panel);
  const rateHost=panel.querySelector('.debug-rate')!;
  for(const rate of [.25,.5,1]){const button=document.createElement('button');button.textContent=`${rate}×`;button.setAttribute('aria-pressed',String(rate===tuning.playbackRate));button.onclick=()=>{tuning.playbackRate=rate;for(const other of rateHost.children)other.setAttribute('aria-pressed',String(other===button));};rateHost.append(button);}
  const controls=new Map<TuningKey,{input:HTMLInputElement;output:HTMLOutputElement}>();
  for(const [key,label,min,max,step]of definitions){const row=document.createElement('label'),name=document.createElement('span'),input=document.createElement('input'),output=document.createElement('output');name.textContent=label;input.type='range';input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(tuning[key]);output.textContent=input.value;input.oninput=()=>{tuning[key]=Number(input.value);output.textContent=input.value;if(key==='audio'){void audio.unlock();audio.settings.master=tuning.audio;audio.update();}if(key==='camera')document.documentElement.style.setProperty('--camera-scale',String(1+tuning.camera));};row.append(name,input,output);panel.querySelector('.debug-tuning')!.append(row);controls.set(key,{input,output});}
  panel.querySelector<HTMLButtonElement>('[data-reset]')!.onclick=()=>{Object.assign(tuning,DEFAULT_TUNING);for(const [key,{input,output}]of controls){input.value=String(tuning[key]);output.textContent=input.value;}for(const button of rateHost.children)button.setAttribute('aria-pressed',String(button.textContent==='1×'));audio.settings.master=tuning.audio;audio.update();};
  const trace=panel.querySelector('ol')!,meter=panel.querySelector<HTMLOutputElement>('.debug-performance')!;
  const log=(event:TimelineEvent)=>{if(!panel.open)return;const line=document.createElement('li');line.textContent=`${event.timeline} / ${event.cue} ${event.edge} ${Math.round(event.duration)}ms`;trace.append(line);while(trace.children.length>80)trace.firstElementChild?.remove();trace.scrollTop=trace.scrollHeight;};timelineObservers.add(log);
  let frame=0,last=0,samples:number[]=[],previewing=false;
  const measure=(time:number)=>{if(last)samples.push(time-last);last=time;if(samples.length>1800)samples.shift();if(previewing)frame=requestAnimationFrame(measure);};
  panel.querySelector<HTMLButtonElement>('[data-stop]')!.onclick=()=>{if(previewing)view.motion.cancel();};
  const play=async(kind:string)=>{
    if(runner.running||!view.session.canBet){view.toast('请等待当前牌局结束，再播放调试片段。');return;}
    previewing=true;runner.running=true;trace.replaceChildren();samples=[];last=0;frame=requestAnimationFrame(measure);view.motion.reset();await audio.unlock();
    const choice=panel.querySelector<HTMLSelectElement>('select')!.value;
    const ranks=choice==='natural'?[4,4,4,5]:choice==='tie'?[3,2,4,5]:[1,2,2,3,6,3];let index=0;
    const cards:Card[]=ranks.map((rank,i)=>({id:`debug-${i}`,rank,suit:i%2?'hearts':'spades'}));
    const plan=dealRound(()=>cards[index++]!,'debug-presentation',0,emptyBets(),'commission');
    document.body.dataset.debugPlayback='true';view.updateControls();
    try{view.clearTable();if(kind==='peek'){await peek.open(cards[0]!,'调试 · 四角咪牌',view.motion.signal);}
      else if(kind==='deal'){for(const deal of plan.deals)await view.deal(deal);}
      else{view.showFinalCards(plan.result);view.clearTable();for(const deal of plan.deals){const slot=document.getElementById(`${deal.side}-slot-${deal.index}`)!;const image=document.createElement('img');image.className='playing-card';const url='/assets/app/game/cards.js';const module=await import(url) as typeof import('../game/cards.js');image.src=module.cardImage();slot.replaceChildren(image);}for(const deal of plan.deals)await view.flip(deal);}
      await view.motion.wait(900);
    }catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))view.toast(String(error));}
    finally{previewing=false;runner.running=false;cancelAnimationFrame(frame);delete document.body.dataset.debugPlayback;view.cleanupFlights();view.clearTable();const previous=view.session.history.at(-1);if(previous){view.showFinalCards(previous);view.showResult(previous);}view.renderBets(view.session.bets);view.renderFinancial(false);view.updateControls();
      const ordered=[...samples].sort((a,b)=>a-b),mean=samples.reduce((a,b)=>a+b,0)/Math.max(1,samples.length);meter.textContent=samples.length?`${samples.length} 帧 · 平均 ${(1000/mean).toFixed(1)} FPS · p95 ${(ordered[Math.floor(ordered.length*.95)]??0).toFixed(1)}ms · >25ms ${samples.filter(n=>n>25).length} 帧`:'没有有效帧样本';}
  };
  for(const button of panel.querySelectorAll<HTMLButtonElement>('[data-preview]'))button.onclick=()=>{void play(button.dataset.preview!);};
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);timelineObservers.delete(log);},{once:true});
}
const mainURL='/assets/app/main.js';
const app=await import(mainURL) as {ready:typeof ready};
const context=await app.ready;if(context)mountDebug(context);
