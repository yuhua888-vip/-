import { type Bets, type Card, type Deal, type Result, type Side, type Spot, emptyBets, SPOTS, totalBets, score, RULES } from '../game/engine.js';
import type { GameSession } from '../game/session.js';
import { cardElement } from '../game/cards.js';
import { bigRoad, beadRoad, derivedRoad, type Road } from '../game/roadmap.js';
import { Motion, TIMING } from '../animations/motion.js';
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
  private displayedBalance=10_000_000;
  private betFlights=new Set<Promise<void>>();
  constructor(readonly session:GameSession,readonly audio:AudioManager,readonly motion:Motion){this.displayedBalance=session.balance;this.renderChipTray();this.renderBets(session.bets);this.renderFinancial(false);this.renderRoads();this.updateControls();this.renderRule();}
  setReduced(reduced:boolean,quick:boolean):void{for(const motion of [this.motion,this.chipMotion,this.balanceMotion]){motion.reduced=reduced;motion.quick=quick;}document.body.classList.toggle('reduced',reduced);}
  chip(value:number,mini=false):HTMLElement{
    const chip=document.createElement(mini?'span':'button');chip.className=`chip${mini?' mini':''}`;chip.dataset.value=String(value);const label=document.createElement('span');label.textContent=value>=1000?`${value/1000}K`:String(value);chip.append(label);
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
    const active=this.session.canBet,hasBet=totalBets(this.session.bets)>0;document.body.dataset.busy=String(!active);
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
    this.audio.play(totalBets(before)>0?'stack':'chip');await Promise.allSettled(jobs);this.audio.play('chip');
  }
  async finishBetAnimations():Promise<void>{await Promise.allSettled([...this.betFlights]);}
  private async flyChip(from:Element,to:Element,value:number,motion:Motion):Promise<void>{
    const start=from.getBoundingClientRect(),end=to.getBoundingClientRect(),chip=this.chip(value,true);chip.classList.add('flight');chip.style.left=`${start.left+start.width/2-14}px`;chip.style.top=`${start.top+start.height/2-14}px`;chip.style.bottom='auto';
    const dx=end.left+end.width/2-(start.left+start.width/2),dy=end.top+end.height/2-(start.top+start.height/2);element('flight-layer').append(chip);
    try{await motion.animate(chip,[{transform:'translate(0,0) scale(1.25) rotate(0deg)'},{transform:`translate(${dx*.55}px,${dy*.55-28}px) scale(1.13) rotate(25deg)`,offset:.5},{transform:`translate(${dx}px,${dy-4}px) scale(.97) rotate(43deg)`,offset:.86},{transform:`translate(${dx}px,${dy}px) scale(1) rotate(45deg)`}],TIMING.chip);}finally{chip.remove();}
  }
  clearTable():void{this.visible={player:[],banker:[]};for(const side of ['player','banker'] as const)for(let index=0;index<3;index++){const slot=element(`${side}-slot-${index}`);slot.replaceChildren();if(index===2){const label=document.createElement('span');label.textContent='补牌';slot.append(label);}}for(const spot of SPOTS)this.zone(spot).classList.remove('winning');element('player-score').textContent='—';element('banker-score').textContent='—';element('result-title').textContent='正在发牌';element('result-net').textContent='';element('result-detail').textContent='';delete element('result-strip').dataset.winner;}
  async deal(deal:Deal):Promise<void>{
    const target=element(`${deal.side}-slot-${deal.index}`),origin=element('shoe-origin');const source=origin.getBoundingClientRect(),dest=target.getBoundingClientRect();const card=cardElement();card.classList.add('flight');card.style.left=`${dest.left}px`;card.style.top=`${dest.top}px`;card.style.width=`${dest.width}px`;card.style.height=`${dest.height}px`;element('flight-layer').append(card);const dx=source.left-dest.left,dy=source.top-dest.top;this.audio.play('card');
    try{await this.motion.animate(card,[{transform:`translate(${dx}px,${dy}px) scale(.55) rotate(-13deg)`,opacity:.8},{transform:`translate(${dx*.89}px,${dy+16}px) scale(.7) rotate(-11deg)`,offset:.15,opacity:1},{transform:`translate(7px,-3px) scale(1) rotate(${deal.side==='player'?-2:2}deg)`,offset:.82},{transform:'translate(-1px,1px) scale(1) rotate(-.2deg)',offset:.95},{transform:'translate(0,0) scale(1) rotate(0deg)'}],TIMING.card);target.replaceChildren(cardElement());this.audio.play('card');}finally{card.remove();}
  }
  async flip(deal:Deal):Promise<void>{const slot=element(`${deal.side}-slot-${deal.index}`),back=slot.querySelector('img');if(back)await this.motion.animate(back,[{transform:'rotateY(0deg)'},{transform:'rotateY(90deg)'}],TIMING.flip/2);const front=cardElement(deal.card);slot.replaceChildren(front);this.audio.play('flip');await this.motion.animate(front,[{transform:'rotateY(-90deg)'},{transform:'rotateY(0deg)'}],TIMING.flip/2);this.visible[deal.side].push(deal.card);element(`${deal.side}-score`).textContent=String(score(this.visible[deal.side]));}
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
  cleanupFlights():void{element('flight-layer').replaceChildren();}
}
