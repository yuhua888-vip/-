import type { Card, Suit } from './engine.js';
export const SUIT_SYMBOL: Record<Suit,string> = { spades: '♠', hearts: '♥', clubs: '♣', diamonds: '♦' };
export const rankLabel = (rank: number): string => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[rank] ?? String(rank));
export const isRed = (card: Card): boolean => card.suit === 'hearts' || card.suit === 'diamonds';
const pipRows: Record<number, number[][]> = {
  1: [[.5,.5]], 2: [[.5,.23],[.5,.77]], 3: [[.5,.2],[.5,.5],[.5,.8]],
  4: [[.3,.23],[.7,.23],[.3,.77],[.7,.77]],
  5: [[.3,.23],[.7,.23],[.5,.5],[.3,.77],[.7,.77]],
  6: [[.3,.2],[.7,.2],[.3,.5],[.7,.5],[.3,.8],[.7,.8]],
  7: [[.3,.2],[.7,.2],[.5,.35],[.3,.5],[.7,.5],[.3,.8],[.7,.8]],
  8: [[.3,.2],[.7,.2],[.5,.35],[.3,.5],[.7,.5],[.5,.65],[.3,.8],[.7,.8]],
  9: [[.3,.18],[.7,.18],[.3,.39],[.7,.39],[.5,.5],[.3,.61],[.7,.61],[.3,.82],[.7,.82]],
  10: [[.3,.18],[.7,.18],[.5,.285],[.3,.39],[.7,.39],[.3,.61],[.7,.61],[.5,.715],[.3,.82],[.7,.82]],
};
export function drawFront(ctx: CanvasRenderingContext2D, card: Card, width: number, height: number): void {
  ctx.fillStyle = '#f4f0e7'; ctx.fillRect(0,0,width,height);
  const grain = ctx.createLinearGradient(0,0,width,height); grain.addColorStop(0,'#ffffff45'); grain.addColorStop(1,'#b5aaa51c'); ctx.fillStyle = grain; ctx.fillRect(0,0,width,height);
  ctx.strokeStyle = '#c9c6bd'; ctx.lineWidth = Math.max(.5,width*.006); ctx.strokeRect(1,1,width-2,height-2);
  ctx.fillStyle = isRed(card) ? '#962f43' : '#202c37'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const index = () => { ctx.font = `600 ${width*.135}px Georgia,serif`; ctx.fillText(rankLabel(card.rank),width*.11,height*.09); ctx.font = `${width*.12}px Georgia,serif`; ctx.fillText(SUIT_SYMBOL[card.suit],width*.11,height*.19); };
  index(); ctx.save(); ctx.translate(width,height); ctx.rotate(Math.PI); index(); ctx.restore();
  if (card.rank <= 10) {
    ctx.font = `${width*(card.rank===1?.4:.185)}px Georgia,serif`;
    for (const position of pipRows[card.rank] ?? []) {
      const [x,y] = position; ctx.save(); ctx.translate(width*(.15+x!*.7),height*(.08+y!*.84)); if(y!>.5)ctx.rotate(Math.PI); ctx.fillText(SUIT_SYMBOL[card.suit],0,0); ctx.restore();
    }
  } else {
    ctx.strokeStyle = isRed(card) ? '#962f4370' : '#344c5a70'; ctx.lineWidth = width*.012;
    const crest = (flip: boolean) => { ctx.save(); if(flip){ctx.translate(width,height);ctx.rotate(Math.PI);} ctx.beginPath(); ctx.moveTo(width*.31,height*.43); ctx.lineTo(width*.27,height*.29); ctx.lineTo(width*.41,height*.34); ctx.lineTo(width*.5,height*.23); ctx.lineTo(width*.59,height*.34); ctx.lineTo(width*.73,height*.29); ctx.lineTo(width*.69,height*.43); ctx.closePath(); ctx.stroke(); ctx.font = `${width*.28}px Georgia,serif`; ctx.fillText(rankLabel(card.rank),width*.5,height*.49); ctx.restore(); };
    crest(false); crest(true); ctx.font = `${width*.14}px Georgia,serif`; ctx.fillText(SUIT_SYMBOL[card.suit],width*.5,height*.5);
  }
}
export function drawBack(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = '#f0eadf'; ctx.fillRect(0,0,width,height); ctx.fillStyle = '#183f47'; ctx.fillRect(width*.045,height*.03,width*.91,height*.94);
  ctx.strokeStyle = '#9cbbb82e'; ctx.lineWidth = .8;
  const step = width*.1;
  for (let offset = -height; offset < width + height; offset += step) { ctx.beginPath(); ctx.moveTo(offset,0); ctx.lineTo(offset+height,height); ctx.stroke(); ctx.beginPath(); ctx.moveTo(offset,0); ctx.lineTo(offset-height,height); ctx.stroke(); }
  ctx.strokeStyle = '#b6cbc3'; ctx.lineWidth = width*.008; ctx.strokeRect(width*.105,height*.075,width*.79,height*.85);
  ctx.fillStyle = '#17373f'; ctx.save(); ctx.translate(width*.5,height*.5); ctx.rotate(Math.PI/4); ctx.fillRect(-width*.24,-width*.24,width*.48,width*.48); ctx.strokeRect(-width*.24,-width*.24,width*.48,width*.48); ctx.restore();
  ctx.fillStyle = '#d6ded0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${width*.32}px Georgia,serif`; ctx.fillText('Q',width*.5,height*.49);
}
const cache = new Map<string,string>();
export function cardImage(card?: Card): string {
  const key = card ? `${card.suit}:${card.rank}` : 'back'; const cached = cache.get(key); if(cached)return cached;
  const canvas = document.createElement('canvas'); canvas.width=240;canvas.height=336;const ctx=canvas.getContext('2d'); if(!ctx)throw new Error('Canvas unavailable');
  if(card)drawFront(ctx,card,240,336);else drawBack(ctx,240,336);const uri=canvas.toDataURL('image/png');cache.set(key,uri);return uri;
}
export function cardElement(card?: Card): HTMLImageElement {
  const image=document.createElement('img');image.className='playing-card';image.src=cardImage(card);image.width=120;image.height=168;image.draggable=false;image.alt=card?`${SUIT_SYMBOL[card.suit]} ${rankLabel(card.rank)}`:'待开牌';return image;
}
