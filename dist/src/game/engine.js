import { BET_SPOTS } from './types.js';
const SUITS = Object.freeze(['♠', '♥', '♣', '♦']);
const VALUES = Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
const ZERO_RANKS = ['10', 'J', 'Q', 'K'];
const RANDOM_RANGE = 0x1_0000_0000;
/** Single source for settlement arithmetic and displayed odds. All ratios describe profit. */
export const RULESET = Object.freeze({
    id: 'standard-commission',
    name: '标准佣金百家乐',
    bankerProfitPercent: 95,
    playerProfit: 1,
    tieProfit: 8,
    pairProfit: 11,
});
function validateCard(card) {
    if (!card || typeof card !== 'object' || !SUITS.includes(card.suit) || !VALUES.includes(card.value)) {
        throw new TypeError('A card must have a valid suit and rank.');
    }
    if (card.isRed !== (card.suit === '♥' || card.suit === '♦')) {
        throw new TypeError('Card colour must match its suit.');
    }
}
function validateHand(cards) {
    if (!Array.isArray(cards) || cards.length > 3)
        throw new TypeError('A hand must contain zero to three cards.');
    for (const card of cards)
        validateCard(card);
}
function validateScore(score) {
    if (!Number.isInteger(score) || score < 0 || score > 9)
        throw new RangeError('A baccarat score must be an integer from 0 to 9.');
}
function validateWinner(winner) {
    if (winner !== 'player' && winner !== 'banker' && winner !== 'tie')
        throw new TypeError('Invalid round winner.');
}
function getCardPoint(card) {
    validateCard(card);
    if (ZERO_RANKS.includes(card.value))
        return 0;
    return card.value === 'A' ? 1 : Number(card.value);
}
function calculateScore(cards) {
    validateHand(cards);
    return cards.reduce((total, card) => total + getCardPoint(card), 0) % 10;
}
function isNatural(pCards, bCards) {
    validateHand(pCards);
    validateHand(bCards);
    return pCards.length === 2 && bCards.length === 2 && (calculateScore(pCards) >= 8 || calculateScore(bCards) >= 8);
}
function hasPair(cards) {
    validateHand(cards);
    return cards.length >= 2 && cards[0]?.value === cards[1]?.value;
}
function shouldPlayerDraw(pScore) {
    validateScore(pScore);
    return pScore <= 5;
}
/** Call only after the two-hand natural check. null means the player stood. */
function shouldBankerDraw(bScore, pThirdCard) {
    validateScore(bScore);
    if (pThirdCard === null)
        return bScore <= 5;
    const thirdPoint = getCardPoint(pThirdCard);
    switch (bScore) {
        case 0:
        case 1:
        case 2: return true;
        case 3: return thirdPoint !== 8;
        case 4: return thirdPoint >= 2 && thirdPoint <= 7;
        case 5: return thirdPoint >= 4 && thirdPoint <= 7;
        case 6: return thirdPoint === 6 || thirdPoint === 7;
        default: return false;
    }
}
function determineWinner(pScore, bScore) {
    validateScore(pScore);
    validateScore(bScore);
    return pScore > bScore ? 'player' : bScore > pScore ? 'banker' : 'tie';
}
/** Pure Punto Banco rules; natural hands must stand before consulting the third-card table. */
export const BaccaratEngine = Object.freeze({
    SUITS, VALUES, getCardPoint, calculateScore, isNatural, hasPair,
    shouldPlayerDraw, shouldBankerDraw, determineWinner,
});
export function validateBets(bets) {
    if (!bets || typeof bets !== 'object' || Array.isArray(bets) || Object.keys(bets).length !== BET_SPOTS.length) {
        throw new TypeError('Bets must contain exactly the five supported betting spots.');
    }
    let total = 0;
    for (const spot of BET_SPOTS) {
        if (!Object.prototype.hasOwnProperty.call(bets, spot))
            throw new TypeError('A betting spot is missing.');
        const amount = bets[spot];
        if (!Number.isSafeInteger(amount) || amount < 0 || amount % 100 !== 0) {
            throw new RangeError('Stakes must be nonnegative whole virtual credits in integer minor units.');
        }
        total += amount;
    }
    // All winning outcomes pay at most 12 times their own stake, including returned stake.
    if (!Number.isSafeInteger(total) || total > Math.floor(Number.MAX_SAFE_INTEGER / 12)) {
        throw new RangeError('The total stake exceeds exact payout arithmetic.');
    }
}
export function totalBets(bets) {
    validateBets(bets);
    return BET_SPOTS.reduce((total, spot) => total + bets[spot], 0);
}
/** Returned stake plus winnings, with standard 5% commission on banker winnings. */
export function calculatePayout(winner, pPair, bPair, bets) {
    validateWinner(winner);
    if (typeof pPair !== 'boolean' || typeof bPair !== 'boolean')
        throw new TypeError('Pair results must be boolean.');
    validateBets(bets);
    let grossPayout = 0;
    if (winner === 'player')
        grossPayout = bets.player * (1 + RULESET.playerProfit);
    else if (winner === 'banker')
        grossPayout = (bets.banker / 100) * (100 + RULESET.bankerProfitPercent);
    else
        grossPayout = bets.player + bets.banker + bets.tie * (1 + RULESET.tieProfit);
    if (pPair)
        grossPayout += bets.playerPair * (1 + RULESET.pairProfit);
    if (bPair)
        grossPayout += bets.bankerPair * (1 + RULESET.pairProfit);
    return grossPayout;
}
/** Pure calculation: recording a settlement and applying it once belong to the wallet. */
export function settleRound(roundId, pCards, bCards, bets) {
    if (!Number.isSafeInteger(roundId) || roundId < 1)
        throw new RangeError('Round ID must be a positive safe integer.');
    validateHand(pCards);
    validateHand(bCards);
    if (pCards.length < 2 || bCards.length < 2)
        throw new RangeError('Settlement needs two or three cards per hand.');
    const pScore = calculateScore(pCards);
    const bScore = calculateScore(bCards);
    const winner = determineWinner(pScore, bScore);
    const pPair = hasPair(pCards);
    const bPair = hasPair(bCards);
    const grossPayout = calculatePayout(winner, pPair, bPair, bets);
    return { roundId, winner, pScore, bScore, pPair, bPair, grossPayout, netProfit: grossPayout - totalBets(bets) };
}
/** Eight decks. Reshuffle only between rounds; exhaustion can never silently replace a shoe. */
export class ShoeEngine {
    cards = [];
    currentShoeNumber = 0;
    cut = 0;
    random;
    constructor(random) {
        if (random !== undefined && typeof random !== 'function')
            throw new TypeError('Random source must be a function.');
        this.random = random;
        this.initShoe();
    }
    /** Injected sources enable reproducible tests. Production uses rejection sampling to avoid modulo bias. */
    randomIndex(upperExclusive) {
        if (this.random) {
            const fraction = this.random();
            if (!Number.isFinite(fraction) || fraction < 0 || fraction >= 1)
                throw new RangeError('Random source must return a fraction in [0, 1).');
            return Math.floor(fraction * upperExclusive);
        }
        if (!globalThis.crypto?.getRandomValues)
            throw new Error('Secure randomness is unavailable.');
        const sample = new Uint32Array(1);
        const limit = RANDOM_RANGE - (RANDOM_RANGE % upperExclusive);
        do {
            globalThis.crypto.getRandomValues(sample);
        } while (sample[0] >= limit);
        return sample[0] % upperExclusive;
    }
    initShoe() {
        if (this.currentShoeNumber >= Number.MAX_SAFE_INTEGER)
            throw new RangeError('Shoe number exhausted.');
        const nextCards = [];
        for (let deck = 0; deck < 8; deck += 1) {
            for (const suit of SUITS) {
                for (const value of VALUES) {
                    nextCards.push(Object.freeze({ suit, value, isRed: suit === '♥' || suit === '♦' }));
                }
            }
        }
        for (let index = nextCards.length - 1; index > 0; index -= 1) {
            const target = this.randomIndex(index + 1);
            const temporary = nextCards[index];
            nextCards[index] = nextCards[target];
            nextCards[target] = temporary;
        }
        const nextCut = 60 + this.randomIndex(16);
        // Commit only a complete replacement, so an invalid injected RNG leaves the old shoe intact.
        this.cards = nextCards;
        this.cut = nextCut;
        this.currentShoeNumber += 1;
    }
    needsShuffle() { return this.remaining <= this.cut; }
    draw() {
        const card = this.cards.pop();
        if (!card)
            throw new Error('Shoe exhausted; reshuffle between rounds before dealing.');
        return card;
    }
    get remaining() { return this.cards.length; }
    get shoeNumber() { return this.currentShoeNumber; }
    get cutPosition() { return this.cut; }
}
