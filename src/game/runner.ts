import type { Deal, Side, RoundPlan, Result } from './engine.js';
import type { GameSession } from './session.js';
import type { TableView } from '../ui/table.js';
import { peekOwnership, initialRevealOrder } from './ownership.js';
import type { PeekController } from './peek.js';
export interface Preferences { autoReveal: boolean; quick: boolean; reduced: boolean }
export class GameRunner {
  running=false;
  constructor(private session:GameSession,private view:TableView,private peek:PeekController,private preferences:()=>Preferences,private fatal:(message:string)=>void){}
  skip():void{if(this.running)this.view.motion.cancel();}
  async start():Promise<void>{
    if(this.running)return;
    let plan:RoundPlan;
    try{plan=this.session.prepareRound();}catch(error){this.view.toast(error instanceof Error?error.message:'不能开始牌局。');return;}
    this.running=true;this.view.motion.reset();this.view.updateControls();
    const state=this.session.state,motion=this.view.motion;
    let ownership=peekOwnership(plan.result.bets);
    const manual:Record<Side,boolean>={player:false,banker:false};
    const reveal=async(deal:Deal)=>{
      let squeezed=false;
      if(!this.preferences().autoReveal&&manual[deal.side]){
        state.move(deal.side==='player'?'PLAYER_PEEK':'BANKER_PEEK');this.view.focus(true);
        try{squeezed=await this.peek.open(deal.card,`${deal.side==='player'?'闲':'庄'}家 · ${deal.index===2?'第三张补牌':`第 ${deal.index+1} 张`}`,motion.signal);}finally{this.view.focus(false);}
        state.move('REVEAL');
      }
      await this.view.flip(deal,squeezed);
    };
    try{
      await this.view.finishBetAnimations();await this.view.countdown();state.move('BETTING_CLOSED');this.view.audio.play('tick');await motion.wait(800);
      state.move('PREPARE_DEAL');this.view.clearTable();if(plan.shuffled){this.view.toast('已启用新牌靴');await motion.wait(900);}await motion.wait(300);
      for(const deal of plan.deals.slice(0,4)){state.move(deal.side==='player'?'DEAL_PLAYER':'DEAL_BANKER');await this.view.deal(deal);}
      state.move('REVEAL');
      if(!this.preferences().autoReveal){
        if(ownership.needsChoice)ownership=peekOwnership(plan.result.bets,await this.peek.chooseSide(motion.signal));
        for(const side of ownership.owned)manual[side]=true;
        if(ownership.owned.length===1){const opponent=ownership.order[0]!;manual[opponent]=await this.peek.chooseOpponent(opponent,motion.signal);}
      }
      for(const deal of initialRevealOrder(plan.deals,ownership))await reveal(deal);
      for(const deal of plan.deals.slice(4)){await motion.wait(500);state.move(deal.side==='player'?'PLAYER_DRAW':'BANKER_DRAW');await this.view.deal(deal);state.move('REVEAL');await reveal(deal);}
      state.move('RESULT');this.view.showResult(plan.result);await motion.wait(700);
      const result=this.session.settlePending()??plan.result;this.view.renderFinancial();this.view.renderRoads();
      state.move('COLLECT_CHIPS');await this.view.collect(result);state.move('PAYOUT');await this.view.payout(result);await motion.wait(500);
      state.move('RESET');this.view.renderBets(this.session.bets);state.move('BETTING_OPEN');
    }catch(error){
      let result:Result|null=null;
      try{result=this.session.settlePending()??plan.result;}catch(storageError){this.fatal(storageError instanceof Error?storageError.message:'本局记录暂时无法保存，请重新打开恢复。');}
      if(result){this.view.cleanupFlights();this.view.showFinalCards(result);this.view.showResult(result);this.view.renderBets(this.session.bets);this.view.renderFinancial(false);this.view.renderRoads();
        if(error instanceof Error&&error.name==='AbortError')this.view.toast('本局结果已保存');
        else{console.error('Round presentation failed',error);this.view.toast('动画已恢复，牌局按原结果完成结算。');}
      }
    }finally{
      this.running=false;this.view.cleanupFlights();if(!this.session.pending)state.recoverToBetting();this.view.updateControls();
    }
  }
}
