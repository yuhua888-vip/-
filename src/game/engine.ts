export const SPOTS = ['player', 'banker', 'tie', 'playerPair', 'bankerPair'] as const;
export type Spot = typeof SPOTS[number];
export type Side = 'player' | 'banker';
export type Winner = Side | 'tie';
export type RuleMode = 'commission' | 'super-six';
export type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';
export interface Card { id: string; rank: number; suit: Suit }
export type Bets = Record<Spot, number>;
export interface Deal { side: Side; index: number; card: Card }
export interface Result {
  id: string; number: number; rule: RuleMode; winner: Winner;
  player: Card[]; banker: Card[]; playerScore: number; bankerScore: number;
  playerPair: boolean; bankerPair: boolean; natural: boolean;
  bets: Bets; returns: Bets; gross: number; net: number; timestamp: number;
}
export interface RoundPlan { deals: Deal[]; result: Result; shuffled: boolean }
export const RULES = {
  commission: { name: '经典佣金', bankerLabel: '庄净赔 0.95 : 1', description: '庄赢收取 5% 佣金；闲净赔 1:1；和净赔 8:1；对子净赔 11:1。和局时庄、闲投注退回。' },
  'super-six': { name: '庄六赔半', bankerLabel: '庄 1 : 1 · 六点赔半', description: '庄赢净赔 1:1，庄以六点获胜时净赔 0.5:1；闲净赔 1:1；和净赔 8:1；对子净赔 11:1。和局时庄、闲投注退回。' },
} satisfies Record<RuleMode, { name: string; bankerLabel: string; description: string }>;
export const emptyBets = (): Bets => ({ player: 0, banker: 0, tie: 0, playerPair: 0, bankerPair: 0 });
export const totalBets = (bets: Bets): number => SPOTS.reduce((sum, spot) => sum + bets[spot], 0);
export function isSpot(value: unknown): value is Spot { return SPOTS.some(spot => spot === value); }
export function validateStake(units: number): void {
  if (!Number.isSafeInteger(units) || units < 0 || units % 100 !== 0 || units > 1_000_000_000_000) throw new Error('投注必须为合法的整数虚拟筹码。');
}
export function validateBets(bets: Bets): void { for (const spot of SPOTS) validateStake(bets[spot]); }
export function point(card: Card): number { return card.rank >= 10 ? 0 : card.rank; }
export function score(cards: readonly Card[]): number { return cards.reduce((sum, card) => sum + point(card), 0) % 10; }
export function isNatural(player: readonly Card[], banker: readonly Card[]): boolean { return player.length === 2 && banker.length === 2 && (score(player) >= 8 || score(banker) >= 8); }
export function hasPair(cards: readonly Card[]): boolean { return cards.length >= 2 && cards[0]?.rank === cards[1]?.rank; }
export function playerDraws(value: number): boolean { return value <= 5; }
export function bankerDraws(value: number, thirdPoint: number | null): boolean {
  if (thirdPoint === null) return value <= 5;
  if (value <= 2) return true;
  if (value === 3) return thirdPoint !== 8;
  if (value === 4) return thirdPoint >= 2 && thirdPoint <= 7;
  if (value === 5) return thirdPoint >= 4 && thirdPoint <= 7;
  if (value === 6) return thirdPoint === 6 || thirdPoint === 7;
  return false;
}
export function winner(player: number, banker: number): Winner { return player === banker ? 'tie' : player > banker ? 'player' : 'banker'; }
export function settle(id: string, number: number, player: Card[], banker: Card[], bets: Bets, rule: RuleMode, timestamp = Date.now()): Result {
  validateBets(bets);
  if (player.length < 2 || banker.length < 2) throw new Error('无法结算不完整的牌局。');
  const playerScore = score(player), bankerScore = score(banker);
  const outcome = winner(playerScore, bankerScore), returns = emptyBets();
  if (outcome === 'player') returns.player = bets.player * 2;
  if (outcome === 'banker') {
    const numerator = rule === 'commission' ? 195 : bankerScore === 6 ? 150 : 200;
    returns.banker = bets.banker * numerator / 100;
  }
  if (outcome === 'tie') { returns.player = bets.player; returns.banker = bets.banker; returns.tie = bets.tie * 9; }
  const playerPair = hasPair(player), bankerPair = hasPair(banker);
  if (playerPair) returns.playerPair = bets.playerPair * 12;
  if (bankerPair) returns.bankerPair = bets.bankerPair * 12;
  const gross = totalBets(returns);
  return { id, number, rule, winner: outcome, player: [...player], banker: [...banker], playerScore, bankerScore, playerPair, bankerPair, natural: isNatural(player, banker), bets: { ...bets }, returns, gross, net: gross - totalBets(bets), timestamp };
}
export function dealRound(draw: () => Card, id: string, number: number, bets: Bets, rule: RuleMode): RoundPlan {
  const player: Card[] = [], banker: Card[] = [], deals: Deal[] = [];
  const take = (side: Side) => { const cards = side === 'player' ? player : banker; const card = draw(); deals.push({ side, index: cards.length, card }); cards.push(card); return card; };
  take('player'); take('banker'); take('player'); take('banker');
  if (!isNatural(player, banker)) {
    const bankerInitial = score(banker);
    const third = playerDraws(score(player)) ? take('player') : null;
    if (bankerDraws(bankerInitial, third ? point(third) : null)) take('banker');
  }
  return { deals, result: settle(id, number, player, banker, bets, rule), shuffled: false };
}

export interface ShoeData { cards: Card[]; number: number; cut: number }
export type RandomInt = (maximum: number) => number;
export function secureRandomInt(maximum: number): number {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 0x100000000) throw new Error('Invalid random range');
  const limit = 0x100000000 - (0x100000000 % maximum);
  const bytes = new Uint32Array(1);
  do { crypto.getRandomValues(bytes); } while (bytes[0]! >= limit);
  return bytes[0]! % maximum;
}
export class Shoe {
  private cards: Card[] = [];
  number = 1;
  cut = 60;
  constructor(private random: RandomInt = secureRandomInt, data?: ShoeData) {
    if (data) { this.cards = data.cards.map(card => ({ ...card })); this.number = data.number; this.cut = data.cut; }
    else this.shuffle(false);
  }
  shuffle(increment = true): void {
    if (increment) this.number++;
    const suits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
    this.cards = [];
    for (let deck = 0; deck < 8; deck++) for (const suit of suits) for (let rank = 1; rank <= 13; rank++) this.cards.push({ id: `${this.number}-${deck}-${suit}-${rank}`, suit, rank });
    for (let index = this.cards.length - 1; index > 0; index--) { const other = this.random(index + 1); const a = this.cards[index]!, b = this.cards[other]!; this.cards[index] = b; this.cards[other] = a; }
    this.cut = 60 + this.random(16);
  }
  get remaining(): number { return this.cards.length; }
  get needsShuffle(): boolean { return this.remaining <= this.cut; }
  draw(): Card { const card = this.cards.pop(); if (!card) throw new Error('牌靴不足，不能在局中重洗。'); return card; }
  snapshot(): ShoeData { return { cards: this.cards.map(card => ({ ...card })), number: this.number, cut: this.cut }; }
}
