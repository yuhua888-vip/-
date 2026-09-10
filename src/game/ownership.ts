import type { Bets, Deal, Side } from './engine.js';
export interface PeekOwnership { owned: Side[]; order: Side[]; needsChoice: boolean }
export const opposite = (side: Side): Side => side === 'player' ? 'banker' : 'player';
/** Main wagers determine ownership. Side-only wagers ask once; all special bets remain legal. */
export function peekOwnership(bets: Bets, selected?: Side): PeekOwnership {
  if (bets.player > 0 && bets.banker > 0) return { owned: ['player', 'banker'], order: ['player', 'banker'], needsChoice: false };
  const owner: Side | undefined = bets.banker > 0 ? 'banker' : bets.player > 0 ? 'player' : selected;
  if (!owner) return { owned: [], order: ['player', 'banker'], needsChoice: true };
  return { owned: [owner], order: [opposite(owner), owner], needsChoice: false };
}
export function initialRevealOrder(deals: readonly Deal[], ownership: PeekOwnership): Deal[] {
  return ownership.order.flatMap(side => deals.filter(deal => deal.side === side && deal.index < 2));
}
