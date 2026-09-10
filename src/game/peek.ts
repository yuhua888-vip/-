import type { Card, Side } from './engine.js';
import { Motion } from '../animations/motion.js';
import { AnimationDirector, tuning } from '../animations/director.js';
import type { AudioManager } from '../audio/manager.js';
import { PaperRenderer, resistedProgress, springStep, type Corner } from './paper.js';
export type { Corner } from './paper.js';
export function dragProgress(startX:number,startY:number,x:number,y:number,width:number,height:number,corner:Corner):number{
  const inwardX=(x-startX)*(corner.endsWith('r')?-1:1),inwardY=(y-startY)*(corner.startsWith('b')?-1:1);
  return Math.max(0,Math.min(1,(inwardX+inwardY)/((width+height)*.62)));
}
export const REVEAL_THRESHOLD=.62;
const name=(side:Side)=>side==='player'?'闲':'庄';
export class PeekController{
  private dialog=document.querySelector<HTMLDialogElement>('#peek-dialog')!;
  private input=document.querySelector<HTMLElement>('#peek-input')!;
  private renderer:PaperRenderer|null=null;
  private motion=new Motion();
  constructor(private audio:AudioManager){}
  private choice(title:string,detail:string,options:[string,string],signal:AbortSignal):Promise<number>{
    const dialog=document.querySelector<HTMLDialogElement>('#peek-choice-dialog')!,heading=dialog.querySelector<HTMLElement>('h2')!,copy=dialog.querySelector<HTMLElement>('p')!,clock=dialog.querySelector<HTMLElement>('output')!;
    const buttons=Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-choice]'));
    heading.textContent=title;copy.textContent=detail;buttons.forEach((button,i)=>button.textContent=options[i]!);dialog.showModal();
    const timer=new Motion();let done=false;
    return new Promise((resolve,reject)=>{
      const clean=()=>{done=true;timer.cancel();dialog.close();signal.removeEventListener('abort',abort);dialog.removeEventListener('cancel',cancel);buttons.forEach(button=>button.removeEventListener('click',click));};
      const finish=(index:number)=>{if(done)return;clean();resolve(index);};
      const abort=()=>{if(done)return;clean();reject(new DOMException('Choice cancelled','AbortError'));};
      const cancel=(event:Event)=>{event.preventDefault();finish(1);};
      const click=(event:Event)=>finish(Number((event.currentTarget as HTMLElement).dataset.choice));
      buttons.forEach(button=>button.addEventListener('click',click));dialog.addEventListener('cancel',cancel);signal.addEventListener('abort',abort,{once:true});
      if(signal.aborted){abort();return;}
      void(async()=>{for(let remaining=15;remaining>0;remaining--){clock.textContent=`${remaining} 秒后：${options[1]}`;await timer.wait(1000,true);}finish(1);})().catch(()=>{});
    });
  }
  async chooseSide(signal:AbortSignal):Promise<Side>{return await this.choice('这一局，想咪哪一方？','和与对子投注也可以慢慢开牌。',['咪庄家牌','咪闲家牌'],signal)===0?'banker':'player';}
  async chooseOpponent(side:Side,signal:AbortSignal):Promise<boolean>{
    return await this.choice(`先开${name(side)}家牌`,`随后由你咪${name(side==='player'?'banker':'player')}家的每一张牌。`,[`亲自咪${name(side)}家牌`,`${name(side)}家直接开牌`],signal)===0;
  }
  open(card:Card,label:string,signal:AbortSignal):Promise<boolean>{
    this.motion.reset();this.motion.reduced=document.body.classList.contains('reduced');
    if(!this.renderer)this.renderer=new PaperRenderer(this.input);this.renderer.resize();this.renderer.setCard(card);
    const renderer=this.renderer,title=this.dialog.querySelector<HTMLElement>('#peek-title')!,hint=this.dialog.querySelector<HTMLElement>('#peek-hint')!,clock=this.dialog.querySelector<HTMLElement>('#peek-time')!,openButton=this.dialog.querySelector<HTMLButtonElement>('#peek-open')!;
    const buttons=Array.from(this.dialog.querySelectorAll<HTMLButtonElement>('[data-corner]'));
    title.textContent=label;hint.textContent='按住任意牌角，慢慢向内搓开';clock.textContent='静置 45 秒后直接开牌';
    this.audio.focusPeek(true);document.body.classList.add('peek-focus');this.dialog.showModal();this.input.focus();
    let corner:Corner='br',progress=0,target=0,velocity=0,direction=.5,pointer:number|null=null,done=false,completing=false,frame=0,lastFrame=0,startX=0,startY=0,lastX=0,lastY=0,lastMove=0,thresholdReached=false;
    let rect=this.input.getBoundingClientRect(),lastInteraction=performance.now();const opened=lastInteraction;
    const render=()=>{renderer.render(progress,corner,direction);this.input.setAttribute('aria-valuenow',String(Math.round(progress*100)));};render();
    return new Promise((resolve,reject)=>{
      const clean=()=>{
        done=true;cancelAnimationFrame(frame);this.motion.cancel();this.audio.stopPaper();this.audio.focusPeek(false);document.body.classList.remove('peek-focus');
        if(pointer!==null&&this.input.hasPointerCapture(pointer))this.input.releasePointerCapture(pointer);pointer=null;
        this.dialog.close();signal.removeEventListener('abort',abort);window.removeEventListener('resize',resize);
        this.input.removeEventListener('pointerdown',down);this.input.removeEventListener('pointermove',move);this.input.removeEventListener('pointerup',up);this.input.removeEventListener('pointercancel',cancelPointer);this.input.removeEventListener('lostpointercapture',cancelPointer);this.input.removeEventListener('keydown',key);
        this.dialog.removeEventListener('cancel',cancelDialog);openButton.removeEventListener('click',direct);buttons.forEach(button=>button.removeEventListener('click',select));
      };
      const complete=async(squeezed:boolean)=>{
        if(done||completing)return;completing=true;cancelAnimationFrame(frame);frame=0;this.audio.stopPaper();
        try{if(squeezed){hint.textContent='缓缓揭晓';await new AnimationDirector(this.motion).play(`peek:${corner}`,[{name:'unfold-and-turn',duration:780,run:duration=>{if(this.motion.reduced){progress=1;render();return this.motion.wait(duration);}return this.motion.tween(progress,1,duration,value=>{progress=value;render();});}},{name:'read-the-card',duration:380}]);}
          if(!done){clean();resolve(squeezed);}
        }catch(error){if(!done){clean();reject(error);}}
      };
      const direct=()=>{void complete(false);};
      const abort=()=>{if(done)return;clean();reject(new DOMException('Peek cancelled','AbortError'));};
      const tick=(time:number)=>{
        frame=0;if(done||completing)return;
        const next=springStep(progress,velocity,target,lastFrame?(time-lastFrame)/1000:1/60,tuning.spring);lastFrame=time;progress=next.position;velocity=next.velocity;
        if(Math.abs(target-progress)<.0008&&Math.abs(velocity)<.008){progress=target;velocity=0;}
        if(progress>=tuning.threshold&&!thresholdReached){thresholdReached=true;this.audio.haptic('threshold');}else if(progress<tuning.threshold-.03)thresholdReached=false;
        hint.textContent=progress>=tuning.threshold?'松手，揭晓这张牌':pointer!==null?'慢慢向内搓开':'按住任意牌角，慢慢向内搓开';render();
        if(pointer!==null&&time-lastMove>90)this.audio.rub(0);
        if(pointer!==null||progress!==target||Math.abs(velocity)>.008)frame=requestAnimationFrame(tick);
      };
      const queue=()=>{if(!frame&&!done&&!completing){lastFrame=0;frame=requestAnimationFrame(tick);}};
      const coords=(event:PointerEvent)=>({x:(event.clientX-rect.left)*420/rect.width-60,y:(event.clientY-rect.top)*550/rect.height-65});
      const down=(event:PointerEvent)=>{
        if(pointer!==null||event.button!==0||completing)return;rect=this.input.getBoundingClientRect();const p=coords(event);
        if(p.x<0||p.x>300||p.y<0||p.y>420)return;
        event.preventDefault();lastInteraction=performance.now();corner=((p.y<210?'t':'b')+(p.x<150?'l':'r')) as Corner;
        progress=target=velocity=0;thresholdReached=false;startX=lastX=p.x;startY=lastY=p.y;lastMove=performance.now();pointer=event.pointerId;
        this.input.setPointerCapture(pointer);buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.corner===corner)));queue();
      };
      const move=(event:PointerEvent)=>{
        if(event.pointerId!==pointer||completing)return;const p=coords(event),now=performance.now();lastInteraction=now;
        target=resistedProgress(dragProgress(startX,startY,p.x,p.y,300,420,corner),tuning.resistance);
        const ix=Math.max(0,(p.x-startX)*(corner.endsWith('r')?-1:1)),iy=Math.max(0,(p.y-startY)*(corner.startsWith('b')?-1:1));
        if(ix+iy>10)direction=iy/(ix+iy);
        this.audio.rub(Math.hypot(p.x-lastX,p.y-lastY)/Math.max(.008,(now-lastMove)/1000));lastX=p.x;lastY=p.y;lastMove=now;queue();
      };
      const up=(event:PointerEvent)=>{
        if(event.pointerId!==pointer||completing)return;const id=pointer;pointer=null;if(this.input.hasPointerCapture(id))this.input.releasePointerCapture(id);this.audio.stopPaper();lastInteraction=performance.now();
        if(progress>=tuning.threshold)void complete(true);else{target=0;queue();}
      };
      const cancelPointer=()=>{if(pointer===null)return;pointer=null;target=0;this.audio.stopPaper();queue();};
      const resize=()=>{cancelPointer();rect=this.input.getBoundingClientRect();renderer.resize();render();};
      const key=(event:KeyboardEvent)=>{lastInteraction=performance.now();if(event.key==='Enter'||event.key===' '){event.preventDefault();direct();}else if(event.key.startsWith('Arrow')){event.preventDefault();target=Math.min(1,target+.13);if(target>=tuning.threshold)void complete(true);else queue();}};
      const cancelDialog=(event:Event)=>{event.preventDefault();direct();};
      const select=(event:Event)=>{if(completing)return;corner=(event.currentTarget as HTMLElement).dataset.corner as Corner;progress=target=velocity=0;lastInteraction=performance.now();buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.corner===corner)));render();this.input.focus();};
      this.input.addEventListener('pointerdown',down);this.input.addEventListener('pointermove',move);this.input.addEventListener('pointerup',up);this.input.addEventListener('pointercancel',cancelPointer);this.input.addEventListener('lostpointercapture',cancelPointer);this.input.addEventListener('keydown',key);this.dialog.addEventListener('cancel',cancelDialog);openButton.addEventListener('click',direct);buttons.forEach(button=>button.addEventListener('click',select));window.addEventListener('resize',resize);signal.addEventListener('abort',abort,{once:true});
      if(signal.aborted){abort();return;}
      void(async()=>{while(!done){await this.motion.wait(1000,true);const remaining=Math.ceil(Math.min(45000-(performance.now()-lastInteraction),180000-(performance.now()-opened))/1000);clock.textContent=`静置 ${Math.max(0,remaining)} 秒后直接开牌`;if(remaining<=0){direct();return;}}})().catch(()=>{});
    });
  }
  dispose():void{this.motion.cancel();this.renderer?.dispose();this.renderer=null;}
}
