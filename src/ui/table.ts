import { type Bets, type Card, type Deal, type Result, type Side, type Spot, emptyBets, SPOTS, totalBets, score, RULES } from '../game/engine.js';
import type { GameSession } from '../game/session.js';
import { cardElement } from '../game/cards.js';
import { bigRoad, beadRoad, derivedRoad, type Road } from '../game/roadmap.js';
import { Motion } from '../animations/motion.js';
import { AnimationDirector, dealTiming, revealTiming, tuning, type DealStage } from '../animations/director.js';
import { chipTexture } from './chips.js';
import type { DealerController } from '../dealer/controller.js';
import type { AudioManager } from '../audio/manager.js';
export function element<T extends HTMLElement = HTMLElement>(id: string): T { const found=document.getElementById(id);if(!found)throw new Error(`Missing UI: ${id}`);return found as T; }
export const format = (units: number): string => (units/100).toLocaleString('en-US',{ maximumFractionDigits:2 });
export const signed = (units: number): string => `${units>0?'+':''}${format(units)}`;
const DENOMINATIONS=[50,100,500,1000,5000,10000];
const sideName = (side: string): string => side==='player'?'闲':side==='banker'?'庄':'和';
export type RoadType='big'|'bead'|'eye'|'small'|'cockroach';
export class TableView {
  selected=1000;
  road:RoadType='big';
  private balanceMotion=new Motion();
  private toastMotion=new Motion();
  private chipMotion=new Motion();
  private visible:Record<Side,Card[]>={player:[],banker:[]};
  private layoutEpoch=0;
  reflow():void{this.layoutEpoch++;this.motion.finishAnimations();this.chipMotion.finishAnimations();}
  private displayedBalance=10_000_000;
  private betFlights=new Set<Promise<void>>();
  constructor(readonly session:GameSession,readonly audio:AudioManager,readonly motion:Motion,private dealer?:DealerController){this.displayedBalance=session.balance;this.renderChipTray();this.renderBets(session.bets);this.renderFinancial(false);this.renderRoads();this.updateControls();this.renderRule();}
  setReduced(reduced:boolean,quick:boolean):void{for(const motion of [this.motion,this.chipMotion,this.balanceMotion]){motion.reduced=reduced;motion.quick=quick;}document.body.classList.toggle('reduced',reduced);}
  chip(value:number,mini=false):HTMLElement{
    const chip=document.createElement(mini?'span':'button');chip.className=`chip${mini?' mini':''}`;chip.dataset.value=String(value);const label=document.createElement('span');label.textContent=value>=1000?`${value/1000}K`:String(value);label.className='sr-only';chip.append(label);chip.style.backgroundImage=`url("${chipTexture(value)}")`;
    if(!mini){chip.setAttribute('aria-label',`选择 ${value.toLocaleString('en-US')} 筹码`);chip.setAttribute('aria-pressed',String(value===this.selected));}return chip;
  }
  private renderChipTray():void{element('chip-tray').replaceChildren(...DENOMINATIONS.map(value=>this.chip(value)));}
  chooseChip(value:number):void{if(!DENOMINATIONS.includes(value))return;this.selected=value;for(const chip of document.querySelectorAll<HTMLElement>('#chip-tray .chip'))chip.setAttribute('aria-pressed',String(Number(chip.dataset.value)===value));element('selected-amount').textContent=`已选 ${value.toLocaleString('en-US')}`;this.audio.play('select');}
  private zone(spot:Spot):HTMLButtonElement{const zone=document.querySelector<HTMLButtonElement>(`[data-spot="${spot}"]`);if(!zone)throw new Error('Missing betting zone');return zone;}
  private anchor(spot:Spot):HTMLElement{return this.zone(spot).querySelector<HTMLElement>('.chip-anchor')!;}
  private stack(spot:Spot,units:number):void{
    const anchor=this.anchor(spot);anchor.replaceChildren();let remaining=units/100;const pieces:number[]=[];
    for(const denom of [...DENOMINATIONS].reverse()){const count=Math.floor(remaining/denom);remaining-=count*denom;for(let i=0;i<Math.min(count,5-pieces.length);i++)pieces.push(denom);}
    if(remaining>0&&pieces.length<5)pieces.push(50);
    pieces.forEach((denom,index)=>{const piece=this.chip(denom,true);piece.style.bottom=`${index*3}px`;piece.style.left=`${(index%2)*1}px`;piece.style.transform=`rotate(${index%2?5:-4}deg)`;anchor.append(piece);});
  }
  renderBets(bets:Bets):void{for(const spot of SPOTS){this.stack(spot,bets[spot]);const zone=this.zone(spot);zone.classList.toggle('has-bet',bets[spot]>0);zone.querySelector('output')!.textContent=bets[spot]?format(bets[spot]):'';}}
  renderRule():void{element('rule-name').textContent=RULES[this.session.rule].name;element('banker-payout').textContent=this.session.rule==='commission'?'0.95 : 1':'1 : 1 · 六点赔半';element('rules-description').textContent=RULES[this.session.rule].description;element<HTMLSelectElement>('rule-select').value=this.session.rule;}
  renderFinancial(animated=true):void{
    this.balanceMotion.reset();const balance=this.session.balance;
    if(animated)void this.balanceMotion.tween(this.displayedBalance,balance,420,value=>{this.displayedBalance=value;element('balance').textContent=format(Math.round(value));}).catch(()=>{});
    else{this.displayedBalance=balance;element('balance').textContent=format(balance);}
    element('total-bet').textContent=format(totalBets(this.session.bets));element('shoe-info').textContent=`第 ${this.session.shoe.number} 靴 · ${this.session.shoe.remaining} 张`;element('round-label').textContent=`第 ${this.session.number} 局`;
  }
  updateControls():void{
    const active=this.session.canBet&&document.body.dataset.debugPlayback!=='true',hasBet=totalBets(this.session.bets)>0;document.body.dataset.busy=String(!active);
    for(const zone of document.querySelectorAll<HTMLButtonElement>('[data-spot]'))zone.disabled=!active;
    for(const chip of document.querySelectorAll<HTMLButtonElement>('#chip-tray button'))chip.disabled=!active;
    element<HTMLButtonElement>('deal-button').disabled=!active||!hasBet;
    element<HTMLButtonElement>('undo-button').disabled=!active||!this.session.canUndo;
    element<HTMLButtonElement>('clear-button').disabled=!active||!hasBet;
    element<HTMLButtonElement>('double-button').disabled=!active||!hasBet||this.session.balance<totalBets(this.session.bets);
    element<HTMLButtonElement>('rebet-button').disabled=!active||!totalBets(this.session.lastBets);
    element<HTMLButtonElement>('settings-open').disabled=!active;element<HTMLButtonElement>('peek-toggle').disabled=!active;
    element<HTMLSelectElement>('rule-select').disabled=!active||hasBet;
  }
  toast(message:string):void{this.toastMotion.reset();const toast=element('toast');toast.textContent=message;void this.toastMotion.animate(toast,[{opacity:0,offset:0},{opacity:1,offset:.08},{opacity:1,offset:.88},{opacity:0,offset:1}],3500).catch(()=>{});}
  async betChanged(before:Bets):Promise<void>{
    this.renderFinancial();this.updateControls();this.renderBets(this.session.bets);
    const jobs:Promise<void>[]=[];
    for(const spot of SPOTS){const difference=this.session.bets[spot]-before[spot];if(!difference)continue;const tray=document.querySelector<HTMLElement>(`#chip-tray [data-value="${this.selected}"]`)!;const anchor=this.anchor(spot);const from=difference>0?tray:anchor,to=difference>0?anchor:tray;
      const job=this.flyChip(from,to,this.selected,this.chipMotion);jobs.push(job);this.betFlights.add(job);void job.finally(()=>this.betFlights.delete(job)).catch(()=>{});
      void this.chipMotion.animate(this.zone(spot),[{backgroundColor:'#d2e2c81c'},{backgroundColor:'#d2e2c800'}],360).catch(()=>{});
    }
    this.audio.play(totalBets(before)>0?'stack':'chip');await Promise.allSettled(jobs);this.audio.play('chip');this.audio.haptic('chip');
  }
  async finishBetAnimations():Promise<void>{await Promise.allSettled([...this.betFlights]);}
  private async flyChip(from:Element,to:Element,value:number,motion:Motion):Promise<void>{
    const epoch=this.layoutEpoch;
    const start=from.getBoundingClientRect(),end=to.getBoundingClientRect(),chip=this.chip(value,true);chip.classList.add('flight');chip.style.left=`${start.left+start.width/2-14}px`;chip.style.top=`${start.top+start.height/2-14}px`;chip.style.bottom='auto';
    const dx=end.left+end.width/2-(start.left+start.width/2),dy=end.top+end.height/2-(start.top+start.height/2);element('flight-layer').append(chip);
    try{await new AnimationDirector(motion).play('chip-flight',[
      {name:'travel',duration:tuning.chip*.72,run:duration=>motion.animate(chip,[{transform:'translate3d(0,0,0) scale(1.2) rotate(-5deg)',boxShadow:'0 4px 6px #0008'},{transform:`translate3d(${dx*.53}px,${dy*.5-36}px,0) scale(1.12) rotate(28deg)`,boxShadow:'2px 18px 14px #0004',offset:.55},{transform:`translate3d(${dx+3}px,${dy-5}px,0) scale(1) rotate(57deg)`,boxShadow:'1px 6px 5px #0007'}],duration,{easing:'cubic-bezier(.34,.03,.43,1)'})},
      {name:'contact',duration:tuning.chip*.28,enter:()=>{this.audio.play('chip');this.audio.haptic('chip');},run:duration=>epoch!==this.layoutEpoch?Promise.resolve():motion.animate(chip,[{transform:chip.style.transform},{transform:`translate3d(${dx+2}px,${dy+1}px,0) scale(1.035,.94) rotate(60deg)`,offset:.26},{transform:`translate3d(${dx-1}px,${dy-1}px,0) scale(.99,1.01) rotate(59deg)`,offset:.62},{transform:`translate3d(${dx}px,${dy}px,0) scale(1) rotate(60deg)`,boxShadow:'0 2px 0 #26363b,1px 4px 4px #0008'}],duration)}
    ]);}finally{chip.remove();}
  }
  clearTable():void{this.visible={player:[],banker:[]};for(const side of ['player','banker'] as const)for(let index=0;index<3;index++){const slot=element(`${side}-slot-${index}`);slot.replaceChildren();if(index===2){const label=document.createElement('span');label.textContent='补牌';slot.append(label);}}for(const spot of SPOTS)this.zone(spot).classList.remove('winning');element('player-score').textContent='—';element('banker-score').textContent='—';element('result-title').textContent='正在发牌';element('result-net').textContent='';element('result-detail').textContent='';delete element('result-strip').dataset.winner;}
  async countdown():Promise<void>{
    const clock=element('deal-countdown');clock.hidden=false;
    try{for(let remaining=5;remaining>0;remaining--){clock.textContent=String(remaining);clock.dataset.urgency=String(remaining);element('announcement').textContent='投注已确认 · 准备发牌';this.audio.play('tick');
      await this.motion.animate(clock,[{transform:'scale(.91)',opacity:.55},{transform:'scale(1)',opacity:1,offset:.18},{transform:'scale(1)',opacity:.65}],1000,{easing:'linear'});
    }}finally{clock.hidden=true;}
  }
  focus(active:boolean):void{document.documentElement.style.setProperty('--camera-duration',`${420*this.motion.scale}ms`);document.body.classList.toggle('table-focus',active);document.documentElement.style.setProperty('--camera-scale',String(1+(this.motion.reduced?0:tuning.camera)));}
  async deal(deal:Deal):Promise<void>{
    const epoch=this.layoutEpoch;
    const target=element(`${deal.side}-slot-${deal.index}`),origin=element('shoe-origin');
    // All layout reads happen before animation. A fixed flight layer avoids transformed parents.
    const source=origin.getBoundingClientRect(),dest=target.getBoundingClientRect();
    const card=cardElement();card.classList.add('flight','dealing-card');
    Object.assign(card.style,{left:`${dest.left}px`,top:`${dest.top}px`,width:`${dest.width}px`,height:`${dest.height}px`,visibility:'hidden'});
    const dx=source.left+source.width/2-dest.left-dest.width/2,dy=source.top-dest.top-dest.height*.22;
    const sign=deal.side==='player'?-1:1,angle=sign*(1.2+deal.index*.35);
    const poses={
      prepare:`translate3d(${dx}px,${dy}px,0) scale(.56) rotate(-12deg)`,
      extract:`translate3d(${dx-12}px,${dy+27}px,0) scale(.64) rotate(-9deg)`,
      travel:`translate3d(${sign*19}px,-11px,0) scale(1.025) rotate(${angle+sign*3}deg)`,
      contact:`translate3d(${sign*2}px,1px,0) scale(1) rotate(${angle}deg)`,
      settle:'translate3d(0,0,0) scale(1) rotate(0deg)',pause:'translate3d(0,0,0) scale(1) rotate(0deg)',
    };
    card.style.transform=poses.prepare;card.style.clipPath='inset(0 0 74% 0)';element('flight-layer').append(card);
    const times=dealTiming(deal),director=new AnimationDirector(this.motion);
    const animate=async(stage:DealStage,duration:number)=>{
      if(epoch!==this.layoutEpoch)return;
      const from=card.style.transform;
      const frames:Keyframe[]=stage==='travel'?[
        {transform:from,boxShadow:'2px 15px 20px #0004'},
        {transform:`translate3d(${dx*.43}px,${dy*.47-32}px,0) scale(.88) rotate(${sign*5}deg)`,boxShadow:'4px 24px 26px #0003',offset:.48},
        {transform:poses.travel,boxShadow:'1px 8px 10px #0006'}
      ]:[{transform:from,clipPath:card.style.clipPath,boxShadow:card.style.boxShadow||'1px 2px 3px #0005'},
         {transform:poses[stage],clipPath:stage==='extract'?'inset(0 0 0% 0)':card.style.clipPath,boxShadow:stage==='contact'||stage==='settle'?'0 1px 0 #d5d0bf,1px 3px 4px #0008':'2px 13px 16px #0004'}];
      await Promise.all([this.motion.animate(card,frames,duration,{easing:stage==='contact'?'cubic-bezier(.12,.66,.22,1)':stage==='travel'?'cubic-bezier(.42,0,.2,1)':'ease-in-out'}),this.dealer?.cue(stage,deal.side,duration,this.motion)]);
    };
    try{await director.play(`deal:${deal.side}:${deal.index}`,(['prepare','extract','travel','contact','settle','pause'] as DealStage[]).map(stage=>({name:stage,duration:times[stage],enter:()=>{
      if(epoch!==this.layoutEpoch)return;
      origin.dataset.stage=stage;
      if(stage==='extract'){card.style.visibility='visible';this.audio.paperCue('draw',times.extract*this.motion.scale);}
      if(stage==='travel')this.audio.paperCue('travel',times.travel*this.motion.scale);
      if(stage==='contact'){this.audio.paperCue('land',110*this.motion.scale);this.audio.paperCue('slide',times.contact*this.motion.scale);}
    },run:duration=>stage==='pause'?this.motion.wait(duration):animate(stage,duration)})));
    target.replaceChildren(cardElement());
    }finally{card.remove();delete origin.dataset.stage;this.dealer?.rest();}
  }
  async flip(deal:Deal,peeked=false):Promise<void>{
    const slot=element(`${deal.side}-slot-${deal.index}`),timing=revealTiming(deal,this.visible),director=new AnimationDirector(this.motion);
    const back=slot.querySelector<HTMLImageElement>('img')??cardElement();if(!back.parentElement)slot.append(back);
    const front=cardElement(deal.card);front.style.position='absolute';front.style.inset='0';front.style.transform='perspective(850px) rotateY(-90deg)';front.style.opacity='0';
    slot.dataset.revealing='true';if(timing.focus)this.focus(true);
    try{
      if(peeked){slot.replaceChildren(front);front.style.opacity='1';await this.motion.animate(front,[{transform:'translateY(-5px) rotate(-1deg)',opacity:.65},{transform:'translateY(0) rotate(0deg)',opacity:1}],360);}
      else await director.play(`reveal:${deal.side}:${deal.index}:${timing.reason}`,[
        {name:'anticipation',duration:timing.pause},
        {name:'edge-lift',duration:timing.lift,enter:()=>this.audio.paperCue('lift',timing.lift*this.motion.scale),run:duration=>this.motion.animate(back,[{transform:'perspective(850px) rotateY(0deg) translateY(0)',boxShadow:'0 2px 4px #0007'},{transform:'perspective(850px) rotateY(22deg) translateY(-5px)',boxShadow:'-6px 10px 15px #0005'}],duration,{easing:'ease-in-out'})},
        {name:'turn-back',duration:timing.turn*.52,run:duration=>this.motion.animate(back,[{transform:back.style.transform},{transform:'perspective(850px) rotateY(90deg) translateY(-7px)'}],duration,{easing:'ease-in'})},
        {name:'turn-face',duration:timing.turn*.48,enter:()=>{back.remove();slot.append(front);front.style.opacity='1';},run:duration=>this.motion.animate(front,[{transform:'perspective(850px) rotateY(-90deg) translateY(-7px)'},{transform:'perspective(850px) rotateY(-12deg) translateY(-3px)'}],duration,{easing:'ease-out'})},
        {name:'contact',duration:timing.land,enter:()=>this.audio.paperCue('land',100*this.motion.scale),run:duration=>this.motion.animate(front,[{transform:front.style.transform,boxShadow:'5px 9px 13px #0005'},{transform:'perspective(850px) rotateY(0deg) translateY(0)',boxShadow:'0 1px 0 #d5d0bf,1px 3px 4px #0008'}],duration)},
      ]);
      await this.motion.wait(timing.score);this.visible[deal.side][deal.index]=deal.card;
      element(`${deal.side}-score`).textContent=String(score(this.visible[deal.side].filter(Boolean)));
    }finally{delete slot.dataset.revealing;if(timing.focus)this.focus(false);}
  }
  showResult(result:Result):void{element('result-strip').dataset.winner=result.winner;element('result-title').textContent=result.winner==='tie'?'和局':`${sideName(result.winner)}家胜`;const net=element('result-net');net.textContent=`${signed(result.net)}`;net.className=result.net>0?'positive':result.net<0?'negative':'';element('result-detail').textContent=`${result.playerScore} : ${result.bankerScore}${result.natural?' · 天生牌':''}${result.playerPair?' · 闲对':''}${result.bankerPair?' · 庄对':''}`;for(const spot of SPOTS)this.zone(spot).classList.toggle('winning',spot===result.winner||(spot==='playerPair'&&result.playerPair)||(spot==='bankerPair'&&result.bankerPair));this.audio.play(result.net>0?'win':result.net<0?'loss':'settle');}
  showFinalCards(result:Result):void{for(const side of ['player','banker'] as const){for(let i=0;i<3;i++){const card=result[side][i];const slot=element(`${side}-slot-${i}`);slot.replaceChildren(...(card?[cardElement(card)]:[]));}element(`${side}-score`).textContent=String(side==='player'?result.playerScore:result.bankerScore);}}
  async collect(result:Result):Promise<void>{const collector=element('dealer');const jobs:Promise<void>[]=[];for(const spot of SPOTS){if(result.bets[spot]>0&&result.returns[spot]===0){const anchor=this.anchor(spot);jobs.push(this.flyChip(anchor,collector,1000,this.motion));anchor.replaceChildren();this.zone(spot).querySelector('output')!.textContent='';}}await Promise.all(jobs);this.audio.play('stack');}
  async payout(result:Result):Promise<void>{
    const jobs:Promise<void>[]=[];for(const spot of SPOTS){if(result.returns[spot]>result.bets[spot])jobs.push(this.flyChip(element('dealer'),this.anchor(spot),1000,this.motion));}await Promise.all(jobs);
    for(const spot of SPOTS)if(result.returns[spot]>0){this.stack(spot,result.returns[spot]);this.zone(spot).querySelector('output')!.textContent=format(result.returns[spot]);}
    this.audio.play('settle');await this.motion.wait(400);
    const returns:Promise<void>[]=[];for(const spot of SPOTS)if(result.returns[spot]>0){returns.push(this.flyChip(this.anchor(spot),element('chip-tray'),1000,this.motion));this.anchor(spot).replaceChildren();}await Promise.all(returns);this.renderBets(emptyBets());
  }
  renderRoads():void{
    const history=this.session.history,winners=history.map(result=>result.winner);
    let road:Road=bigRoad(winners);if(this.road==='bead')road=beadRoad(winners);else if(this.road!=='big')road=derivedRoad(winners,this.road==='eye'?1:this.road==='small'?2:3);
    const grid=element('road-grid'),maxColumns=55,offset=Math.max(0,road.columns-maxColumns),columns=Math.min(maxColumns,Math.max(15,road.columns));grid.style.width=`${columns*18}px`;grid.replaceChildren();
    for(const cell of road.cells){if(cell.column<offset)continue;const dot=document.createElement('span');dot.className=`road-dot ${cell.winner} ${this.road}${cell.ties?' tie-mark':''}`;dot.style.left=`${(cell.column-offset)*18}px`;dot.style.top=`${cell.row*18}px`;if(this.road==='bead')dot.textContent=sideName(cell.winner);dot.title=`${sideName(cell.winner)}${cell.ties?` · 和 ${cell.ties} 次`:''}`;grid.append(dot);}
    const names:Record<RoadType,string>={big:'大路',bead:'珠盘路',eye:'大眼仔',small:'小路',cockroach:'曱甴路'};grid.setAttribute('aria-label',`${names[this.road]}，${history.length} 局记录`);
    const empty=element('empty-road');empty.hidden=road.cells.length>0;empty.textContent=history.length===0?'完成首局后，牌路将在这里记录。':road.leadingTies>0?`开局和 ${road.leadingTies} 次，等待庄或闲结果。`:'有效列数不足，继续记录后显示。';
    const scroll=element('road-scroll');scroll.scrollLeft=scroll.scrollWidth;
    for(const [id,outcome] of [['stat-p','player'],['stat-b','banker'],['stat-t','tie']] as const)element(id).textContent=String(winners.filter(w=>w===outcome).length);
    element('stat-rounds').textContent=String(this.session.number-1);
    const net=this.session.balance+totalBets(this.session.bets)-10_000_000;const pnl=element('session-net');pnl.textContent=signed(net);pnl.className=net>0?'positive':net<0?'negative':'';
    const last=winners.at(-1);let streak=0;for(let i=winners.length-1;i>=0&&winners[i]===last;i--)streak++;element('stat-streak').textContent=last?`${streak} ${sideName(last)}`:'—';
    element('road-description').textContent=this.road==='big'||this.road==='bead'?'路单仅记录已发生的牌局，不预测下一局。':'红蓝表示大路结构是否一致，不代表庄闲，也不预测结果。';
  }
  renderHistory():void{
    const host=element('history-content');host.replaceChildren();if(!this.session.history.length){const p=document.createElement('p');p.textContent='完成首局后即可查看记录。';host.append(p);return;}
    const table=document.createElement('table');const head=document.createElement('thead');head.innerHTML='<tr><th>局数</th><th>结果</th><th>闲 : 庄</th><th>规则</th><th>净收益</th></tr>';table.append(head);const body=document.createElement('tbody');
    for(const result of this.session.history.slice(-100).reverse()){const row=document.createElement('tr');const values=[String(result.number),sideName(result.winner),`${result.playerScore} : ${result.bankerScore}`,RULES[result.rule].name,signed(result.net)];for(const [index,value]of values.entries()){const cell=document.createElement('td');cell.textContent=value;if(index===4)cell.className=result.net>0?'positive':result.net<0?'negative':'';row.append(cell);}body.append(row);}table.append(body);host.append(table);
  }
  cleanupFlights():void{element('flight-layer').replaceChildren();this.focus(false);this.dealer?.rest();this.audio.cancelPresentation();element('deal-countdown').hidden=true;}
}
