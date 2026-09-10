export const PHASES = ['BETTING_OPEN', 'BETTING_WARNING', 'BETTING_CLOSED', 'PREPARE_DEAL', 'DEAL_PLAYER', 'DEAL_BANKER', 'PLAYER_PEEK', 'BANKER_PEEK', 'PLAYER_DRAW', 'BANKER_DRAW', 'REVEAL', 'RESULT', 'COLLECT_CHIPS', 'PAYOUT', 'RESET'];
const transitions = {
    BETTING_OPEN: ['BETTING_WARNING'], BETTING_WARNING: ['BETTING_CLOSED'], BETTING_CLOSED: ['PREPARE_DEAL'],
    PREPARE_DEAL: ['DEAL_PLAYER'], DEAL_PLAYER: ['DEAL_BANKER'], DEAL_BANKER: ['DEAL_PLAYER', 'REVEAL'],
    REVEAL: ['PLAYER_PEEK', 'BANKER_PEEK', 'PLAYER_DRAW', 'BANKER_DRAW', 'RESULT'],
    PLAYER_PEEK: ['REVEAL'], BANKER_PEEK: ['REVEAL'], PLAYER_DRAW: ['REVEAL'], BANKER_DRAW: ['REVEAL'],
    RESULT: ['COLLECT_CHIPS'], COLLECT_CHIPS: ['PAYOUT'], PAYOUT: ['RESET'], RESET: ['BETTING_OPEN'],
};
export const PHASE_LABELS = {
    BETTING_OPEN: '请选择筹码，轻触桌面下注', BETTING_WARNING: '投注已确认', BETTING_CLOSED: '停止下注', PREPARE_DEAL: '皇后准备发牌',
    DEAL_PLAYER: '闲家发牌', DEAL_BANKER: '庄家发牌', PLAYER_PEEK: '闲家咪牌', BANKER_PEEK: '庄家咪牌',
    PLAYER_DRAW: '闲家补牌', BANKER_DRAW: '庄家补牌', REVEAL: '开牌', RESULT: '本局结果', COLLECT_CHIPS: '收取筹码', PAYOUT: '结算筹码', RESET: '准备下一局',
};
export class StateMachine {
    onChange;
    phase = 'BETTING_OPEN';
    constructor(onChange = () => { }) {
        this.onChange = onChange;
    }
    move(next) {
        if (!transitions[this.phase].includes(next))
            throw new Error(`非法牌局状态：${this.phase} → ${next}`);
        this.phase = next;
        this.onChange(next);
    }
    recoverToBetting() { this.phase = 'BETTING_OPEN'; this.onChange(this.phase); }
    get canBet() { return this.phase === 'BETTING_OPEN'; }
}
