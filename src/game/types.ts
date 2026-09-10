export type Suit = '♠' | '♥' | '♣' | '♦';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  readonly suit: Suit;
  readonly value: Rank;
  readonly isRed: boolean;
}

export type Winner = 'player' | 'banker' | 'tie';
export const BET_SPOTS = ['player', 'banker', 'tie', 'playerPair', 'bankerPair'] as const;
export type BetSpot = (typeof BET_SPOTS)[number];
/** Integer minor units: 100 units = one virtual credit. Stakes use whole credits. */
export type Bets = Record<BetSpot, number>;

export interface Settlement {
  readonly roundId: number;
  readonly winner: Winner;
  readonly pScore: number;
  readonly bScore: number;
  readonly pPair: boolean;
  readonly bPair: boolean;
  readonly grossPayout: number;
  readonly netProfit: number;
}

export interface RoadCell {
  readonly winner: Exclude<Winner, 'tie'>;
  tieCount: number;
}

export interface BigRoad {
  /** Column first; each column has exactly six rows, with null for empty cells. */
  readonly columns: Array<Array<RoadCell | null>>;
  /** Unattached opening ties; transferred to the first decisive cell when one exists. */
  readonly leadingTies: number;
}
