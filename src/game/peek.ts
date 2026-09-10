import { type Card } from './engine.js';
import { drawFront, drawBack } from './cards.js';
import { Motion } from '../animations/motion.js';
import { type AudioManager } from '../audio/manager.js';
export type Corner = 'tl' | 'tr' | 'bl' | 'br';
export function dragProgress(startX: number, startY: number, x: number, y: number, width: number, height: number, corner: Corner): number {
  const inwardX = (x-startX)*(corner.endsWith('r')?-1:1), inwardY=(y-startY)*(corner.startsWith('b')?-1:1);
  return Math.max(0,Math.min(1,(inwardX+inwardY)/((width+height)*.62)));
}
export const REVEAL_THRESHOLD = .58;
type Point = [number,number];
function clippedBack(width: number,height: number,distance: number): Point[] {
  const input: Point[]=[[0,0],[width,0],[width,height],[0,height]], output:Point[]=[];
  for(let i=0;i<input.length;i++){const a=input[i]!,b=input[(i+1)%input.length]!;const fa=a[0]+a[1]-distance,fb=b[0]+b[1]-distance;if(fa>=0)output.push(a);if((fa>=0)!==(fb>=0)){const t=fa/(fa-fb);output.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}
  return output;
}
export class PeekController {
  private dialog: HTMLDialogElement;
  private canvas: HTMLCanvasElement;
  private motion = new Motion();
  constructor(private audio: AudioManager) { this.dialog=document.querySelector<HTMLDialogElement>('#peek-dialog')!;this.canvas=document.querySelector<HTMLCanvasElement>('#peek-canvas')!; }
  open(card: Card,label: string,signal: AbortSignal): Promise<void> {
    this.motion.reset();this.audio.focusPeek(true);
    const ctx=this.canvas.getContext('2d');if(!ctx)return Promise.resolve();
    const width=300,height=420,dpr=Math.min(2,window.devicePixelRatio||1);this.canvas.width=width*dpr;this.canvas.height=height*dpr;ctx.scale(dpr,dpr);
    const title=this.dialog.querySelector<HTMLElement>('#peek-title')!,hint=this.dialog.querySelector<HTMLElement>('#peek-hint')!,time=this.dialog.querySelector<HTMLElement>('#peek-time')!;
    title.textContent=label;hint.textContent='从任意牌角向内拖动';time.textContent='20 秒后自动开牌';
    let corner:Corner='br',progress=0,startX=0,startY=0,pointer:number|null=null,done=false,frame=0,gesture=0;
    const buttons=Array.from(this.dialog.querySelectorAll<HTMLButtonElement>('[data-corner]'));
    const map=(point:Point):Point=>[corner.endsWith('r')?width-point[0]:point[0],corner.startsWith('b')?height-point[1]:point[1]];
    const path=(points:Point[])=>{ctx.beginPath();points.forEach((point,index)=>{const p=map(point);if(index===0)ctx.moveTo(...p);else ctx.lineTo(...p);});ctx.closePath();};
    const render=()=>{
      frame=0;ctx.clearRect(0,0,width,height);drawFront(ctx,card,width,height);
      const distance=progress*(width+height)*.87;
      ctx.save();path(clippedBack(width,height,distance));ctx.clip();drawBack(ctx,width,height);ctx.restore();
      if(distance>1&&progress<1){ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();const a=map([distance,0]),b=map([0,distance]),tip=map([distance*.86,distance*.86]);const gradient=ctx.createLinearGradient(...map([distance*.42,distance*.42]),...tip);gradient.addColorStop(0,'#aaa99f');gradient.addColorStop(.22,'#fdfbf2');gradient.addColorStop(.68,'#d8d7cc');gradient.addColorStop(1,'#8b9086');ctx.shadowColor='#0009';ctx.shadowBlur=12+progress*12;ctx.shadowOffsetX=corner.endsWith('r')?-5:5;ctx.shadowOffsetY=corner.startsWith('b')?-5:5;ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(...a);ctx.quadraticCurveTo(...map([distance*.83,distance*.18]),...tip);ctx.quadraticCurveTo(...map([distance*.18,distance*.83]),...b);ctx.closePath();ctx.fill();ctx.restore();}
      this.canvas.setAttribute('aria-valuenow',String(Math.round(progress*100)));
      for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.corner===corner));
    };
    const queue=()=>{if(!frame)frame=requestAnimationFrame(render);};render();this.dialog.showModal();
    return new Promise((resolve,reject)=>{
      const clean=()=>{done=true;cancelAnimationFrame(frame);this.motion.cancel();this.audio.focusPeek(false);this.dialog.close();signal.removeEventListener('abort',abort);this.canvas.removeEventListener('pointerdown',down);this.canvas.removeEventListener('pointermove',move);this.canvas.removeEventListener('pointerup',up);this.canvas.removeEventListener('pointercancel',cancelPointer);this.canvas.removeEventListener('keydown',key);this.dialog.removeEventListener('cancel',cancelDialog);openButton.removeEventListener('click',complete);for(const button of buttons)button.removeEventListener('click',select);};
      const finish=()=>{if(done)return;clean();this.audio.play('flip');resolve();};
      const complete=()=>{if(done)return;pointer=null;progress=1;render();finish();};
      const abort=()=>{if(done)return;clean();reject(new DOMException('Peek cancelled','AbortError'));};
      const coords=(event:PointerEvent)=>{const r=this.canvas.getBoundingClientRect();return{x:(event.clientX-r.left)*width/r.width,y:(event.clientY-r.top)*height/r.height};};
      const down=(event:PointerEvent)=>{if(pointer!==null||event.button!==0)return;event.preventDefault();gesture++;const p=coords(event);corner=(p.y<height/2?'t':'b')+(p.x<width/2?'l':'r') as Corner;startX=p.x;startY=p.y;progress=0;pointer=event.pointerId;this.canvas.setPointerCapture(pointer);queue();};
      const move=(event:PointerEvent)=>{if(event.pointerId!==pointer)return;const p=coords(event);progress=dragProgress(startX,startY,p.x,p.y,width,height,corner);hint.textContent=progress>=REVEAL_THRESHOLD?'松手开牌':'慢慢向内拖动';this.audio.play('peek');queue();};
      const rebound=()=>{progress=0;hint.textContent='未过阈值，牌角已回弹';queue();};
      const up=(event:PointerEvent)=>{if(event.pointerId!==pointer)return;pointer=null;if(this.canvas.hasPointerCapture(event.pointerId))this.canvas.releasePointerCapture(event.pointerId);if(progress>=REVEAL_THRESHOLD)complete();else{const from=progress,version=gesture;void this.motion.tween(from,0,260,value=>{if(pointer===null&&gesture===version){progress=value;queue();}}).then(()=>{if(pointer===null&&gesture===version)rebound();}).catch(()=>{});}};
      const cancelPointer=()=>{pointer=null;rebound();};
      const key=(event:KeyboardEvent)=>{if(['Enter',' '].includes(event.key)){event.preventDefault();complete();}else if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();progress=Math.min(1,progress+.12);if(progress>=REVEAL_THRESHOLD)complete();else queue();}};
      const cancelDialog=(event:Event)=>{event.preventDefault();complete();};
      const select=(event:Event)=>{gesture++;corner=(event.currentTarget as HTMLButtonElement).dataset.corner as Corner;progress=0;render();this.canvas.focus();};
      const openButton=this.dialog.querySelector<HTMLButtonElement>('#peek-open')!;
      this.canvas.addEventListener('pointerdown',down);this.canvas.addEventListener('pointermove',move);this.canvas.addEventListener('pointerup',up);this.canvas.addEventListener('pointercancel',cancelPointer);this.canvas.addEventListener('keydown',key);this.dialog.addEventListener('cancel',cancelDialog);openButton.addEventListener('click',complete);for(const button of buttons)button.addEventListener('click',select);signal.addEventListener('abort',abort,{once:true});
      if(signal.aborted){abort();return;}
      void (async()=>{for(let remaining=19;remaining>=0;remaining--){await this.motion.wait(1000,true);if(done)return;time.textContent=`${remaining} 秒后自动开牌`;}complete();})().catch(()=>{});
    });
  }
}
