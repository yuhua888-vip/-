export const opposite = (side) => side === 'player' ? 'banker' : 'player';
/** Main wagers determine ownership. Side-only wagers ask once; all special bets remain legal. */
export function peekOwnership(bets, selected) {
    if (bets.player > 0 && bets.banker > 0)
        return { owned: ['player', 'banker'], order: ['player', 'banker'], needsChoice: false };
    const owner = bets.banker > 0 ? 'banker' : bets.player > 0 ? 'player' : selected;
    if (!owner)
        return { owned: [], order: ['player', 'banker'], needsChoice: true };
    return { owned: [owner], order: [opposite(owner), owner], needsChoice: false };
}
export function initialRevealOrder(deals, ownership) {
    return ownership.order.flatMap(side => deals.filter(deal => deal.side === side && deal.index < 2));
}
