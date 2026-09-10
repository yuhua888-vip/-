import { ShoeEngine, totalBets, RULESET } from './game/engine.js';
import { BET_SPOTS, type BetSpot, type Settlement } from './game/types.js';
import { getRoadWindow } from './presentation/road-window.js';
import { VirtualWallet } from './game/wallet.js';
import { GameController, type Presenter, type Hand } from './game/controller.js';
import type { Phase } from './game/state.js';
import { Timeline } from './game/timeline.js';
import { CardPresenter } from './presentation/cards.js';

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) throw new Error(`Missing view element: ${id}`);
  return result as T;
}
const creditFormat = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
const credits = (units: number): string => creditFormat.format(units / 100);
const labels: Record<BetSpot, string> = { player: '闲 PLAYER', banker: '庄 BANKER', tie: '和 TIE', playerPair: '闲对 P.PAIR', bankerPair: '庄对 B.PAIR' };
const phaseLabels: Record<Phase, string> = {
  BETTING: '请选择筹码并下注', BETTING_CLOSED: '停止下注 · NO MORE BETS', SHUFFLING: '正在更换牌靴',
  PREPARE_DEAL: '准备发牌', DEALING_INITIAL: '正在发牌', INITIAL_REVEAL: '正在开牌',
  THIRD_CARD_EVAL: '检查补牌', PLAYER_DRAW: '闲家补牌', BANKER_DRAW: '庄家补牌',
  REVEAL: '本局开牌完成', RESULT: '本局结果', PAYOUT: '结算完成', RESET: '准备下一局', RECOVERING: '恢复牌桌'
};

const wallet = new VirtualWallet();
const timeline = new Timeline();
const shoe = new ShoeEngine();
const cards = new CardPresenter(timeline, element('flight-overlay'), element('shoe-chute-origin'));
const betButtons = [...document.querySelectorAll<HTMLButtonElement>('button[data-bet-target]')];
const chipButtons = [...document.querySelectorAll<HTMLButtonElement>('button[data-val]')];
const dealButton = element<HTMLButtonElement>('btn-deal');
let selectedChip = 1000 * 100;
let latestResult: Settlement | null = null;
let controller: GameController;

function message(text: string): void { element('action-message').textContent = text; }

function renderWallet(): void {
  element('player-balance').textContent = credits(wallet.balance);
  element('total-bet').textContent = credits(totalBets(wallet.bets));
}

function renderControls(): void {
  const canBet = controller.canBet;
  const total = totalBets(wallet.bets);
  for (const button of betButtons) button.disabled = !canBet;
  for (const button of chipButtons) {
    button.disabled = !canBet;
    button.setAttribute('aria-pressed', String(Number(button.dataset.val) * 100 === selectedChip));
  }
  element<HTMLButtonElement>('btn-clear-bets').disabled = !canBet || total === 0;
  element<HTMLButtonElement>('btn-double-bets').disabled = !canBet || total === 0;
  element<HTMLButtonElement>('btn-rebet').disabled = !canBet || wallet.lastBets === null;
  dealButton.disabled = !canBet || total === 0;
}

function renderBets(): void {
  const bets = wallet.bets;
  for (const button of betButtons) {
    const spot = button.dataset.betTarget as BetSpot;
    const anchor = button.querySelector<HTMLElement>('.chip-stack-anchor');
    if (!anchor) throw new Error('Missing betting amount anchor');
    button.classList.toggle('bet-cell-active', bets[spot] > 0);
    anchor.textContent = bets[spot] ? credits(bets[spot]) : '';
    button.setAttribute('aria-label', `${labels[spot]}，已下注 ${credits(bets[spot])} 虚拟筹码`);
  }
  renderWallet();
  renderControls();
}

function renderRoadmaps(history: readonly Settlement[]): void {
  const bead = element('bead-road-grid');
  const big = element('big-road-grid');
  const road = getRoadWindow(history);
  bead.replaceChildren();
  for (const result of road.beads) {
    const cell = document.createElement('div');
    cell.className = `bead-cell ${result.winner}`;
    cell.textContent = result.winner === 'player' ? '闲' : result.winner === 'banker' ? '庄' : '和';
    cell.title = `第 ${result.roundId} 局：${labels[result.winner]} ${result.pScore}:${result.bScore}`;
    bead.appendChild(cell);
  }
  big.replaceChildren();
  if (road.leadingTies) {
    const pending = document.createElement('span');
    pending.className = 'leading-ties';
    pending.textContent = `开局和 ×${road.leadingTies}`;
    big.appendChild(pending);
  }
  for (const column of road.columns) {
    const col = document.createElement('div');
    col.className = 'road-column';
    for (const data of column) {
      const cell = document.createElement('div');
      cell.className = 'road-grid-cell';
      if (data) {
        const marker = document.createElement('span');
        marker.className = `road-marker ${data.winner}`;
        marker.textContent = data.tieCount > 0 ? '/' : '';
        cell.title = `${labels[data.winner]}${data.tieCount ? ` · 和 ${data.tieCount} 次` : ''}`;
        cell.appendChild(marker);
      }
      col.appendChild(cell);
    }
    big.appendChild(col);
  }
  for (const [id, winner] of [['stat-p', 'player'], ['stat-b', 'banker'], ['stat-t', 'tie']] as const) {
    element(id).textContent = String(history.filter(result => result.winner === winner).length);
  }
  bead.scrollLeft = bead.scrollWidth;
  big.scrollLeft = road.focusColumn === null ? 0 : Math.max(0, road.focusColumn * 14 - big.clientWidth / 2);
}

const slot = (hand: Hand, index: number): HTMLElement => element(`${hand}-slot-${index}`);
const view: Presenter = {
  state(phase) {
    document.body.dataset.phase = phase;
    if (phase !== 'PAYOUT' && phase !== 'RESET') element('announcement-text').textContent = phaseLabels[phase];
    renderControls();
  },
  clear() {
    for (const hand of ['player', 'banker'] as const) {
      for (let i = 0; i < 3; i++) slot(hand, i).replaceChildren();
      element(`${hand}-score-badge`).classList.add('hidden');
    }
    for (const button of betButtons) button.classList.remove('result-winner');
  },
  shoe(number, remaining) {
    element('shoe-num').textContent = `#${String(number).padStart(3, '0')}`;
    element('cards-remaining').textContent = String(remaining);
  },
  deal: (hand, index, card) => cards.deal(slot(hand, index), card),
  reveal: (hand, index) => cards.reveal(slot(hand, index)),
  scores(player, banker) {
    for (const [hand, score] of [['player', player], ['banker', banker]] as const) {
      const badge = element(`${hand}-score-badge`);
      badge.textContent = String(score);
      badge.classList.remove('hidden');
    }
  },
  result(result, history) {
    latestResult = result;
    element('announcement-text').textContent = `${labels[result.winner]}${result.winner === 'tie' ? '局' : ' 胜'} · ${result.pScore} : ${result.bScore}`;
    element('last-profit').textContent = `${result.netProfit > 0 ? '+' : ''}${credits(result.netProfit)}`;
    betButtons.find(button => button.dataset.betTarget === result.winner)?.classList.add('result-winner');
    renderWallet();
    renderRoadmaps(history);
  },
  betting(roundId) {
    for (const button of betButtons) button.classList.remove('result-winner');
    element('round-num').textContent = `#${roundId}`;
    element('announcement-text').textContent = phaseLabels.BETTING;
    renderBets();
    message(latestResult ? '上一局已结算，可重新下注。' : '选择面额后点击投注区域。');
  },
  error: message
};
controller = new GameController(wallet, shoe, timeline, view);

for (const button of chipButtons) {
  button.addEventListener('click', () => {
    if (!controller.canBet) return;
    selectedChip = Number(button.dataset.val) * 100;
    renderControls();
    message(`已选择 ${credits(selectedChip)} 虚拟筹码。`);
  });
}
for (const button of betButtons) {
  button.addEventListener('click', () => {
    const spot = button.dataset.betTarget;
    if (!controller.canBet || !BET_SPOTS.includes(spot as BetSpot)) return;
    if (!wallet.placeBet(spot as BetSpot, selectedChip)) { message('可用虚拟筹码不足，请选择更小面额。'); return; }
    renderBets();
    message(`${labels[spot as BetSpot]} +${credits(selectedChip)} 虚拟筹码。`);
  });
}
for (const [id, action, success, failure] of [
  ['btn-clear-bets', () => wallet.clearBets(), '当前投注已全部退回。', '当前没有可清空的投注。'],
  ['btn-double-bets', () => wallet.doubleBets(), '当前投注已加倍。', '虚拟筹码不足，无法加倍。'],
  ['btn-rebet', () => wallet.rebet(), '已按上一局重新下注。', '虚拟筹码不足，无法重押。']
] as const) {
  element<HTMLButtonElement>(id).addEventListener('click', () => {
    if (!controller.canBet) return;
    message(action() ? success : failure);
    renderBets();
  });
}
dealButton.addEventListener('click', () => { message(''); void controller.startRound(); });

function visibility(): void {
  timeline.setPaused(document.hidden);
  cards.setPaused(document.hidden);
}
document.addEventListener('visibilitychange', visibility);
window.addEventListener('pagehide', (event: PageTransitionEvent) => {
  if (event.persisted) { timeline.setPaused(true); cards.setPaused(true); }
  else { controller.dispose(); cards.dispose(); }
});
window.addEventListener('pageshow', visibility);

element('rule-summary').textContent = `庄赢净赔 ${RULESET.bankerProfitPercent / 100}:1（${100 - RULESET.bankerProfitPercent}% 佣金） · 和 ${RULESET.tieProfit}:1 · 对子 ${RULESET.pairProfit}:1`;
for (const button of betButtons) {
  const spot = button.dataset.betTarget as BetSpot;
  const title = button.querySelector('span');
  if (title) title.textContent = labels[spot];
  const odds = button.querySelectorAll('span')[1];
  const rate = spot === 'banker' ? RULESET.bankerProfitPercent / 100 : spot === 'player' ? RULESET.playerProfit : spot === 'tie' ? RULESET.tieProfit : RULESET.pairProfit;
  if (odds) odds.textContent = `${rate} TO 1`;
}
view.shoe(shoe.shoeNumber, shoe.remaining);
renderRoadmaps([]);
view.betting(1);
visibility();
