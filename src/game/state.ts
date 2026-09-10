export const PHASES = [
  'BETTING', 'BETTING_CLOSED', 'SHUFFLING', 'PREPARE_DEAL', 'DEALING_INITIAL',
  'INITIAL_REVEAL', 'THIRD_CARD_EVAL', 'PLAYER_DRAW', 'BANKER_DRAW',
  'REVEAL', 'RESULT', 'PAYOUT', 'RESET', 'RECOVERING'
] as const;
export type Phase = typeof PHASES[number];

const transitions: Record<Phase, readonly Phase[]> = {
  BETTING: ['BETTING_CLOSED'], BETTING_CLOSED: ['SHUFFLING', 'PREPARE_DEAL'],
  SHUFFLING: ['PREPARE_DEAL'], PREPARE_DEAL: ['DEALING_INITIAL'],
  DEALING_INITIAL: ['INITIAL_REVEAL'], INITIAL_REVEAL: ['THIRD_CARD_EVAL'],
  THIRD_CARD_EVAL: ['PLAYER_DRAW', 'BANKER_DRAW', 'REVEAL'],
  PLAYER_DRAW: ['BANKER_DRAW', 'REVEAL'], BANKER_DRAW: ['REVEAL'],
  REVEAL: ['RESULT'], RESULT: ['PAYOUT'], PAYOUT: ['RESET'],
  RESET: ['BETTING'], RECOVERING: ['BETTING']
};

export class GameStateMachine {
  private current: Phase = 'BETTING';
  get phase(): Phase { return this.current; }
  transition(next: Phase): void {
    if (!transitions[this.current].includes(next)) throw new Error(`Invalid transition ${this.current} → ${next}`);
    this.current = next;
  }
  recover(): void { this.current = 'RECOVERING'; }
}
