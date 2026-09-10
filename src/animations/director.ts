import type { Motion } from './motion.js';
import type { Deal, Card, Side } from '../game/engine.js';
import { score } from '../game/engine.js';

export const DEFAULT_TUNING = Object.freeze({
  dealSpeed: 1, flight: 660, landing: 340, gap: 360, revealSpeed: 1,
  resistance: 1.2, threshold: .62, spring: 170, camera: .025,
  audio: .45, chip: 660, dealerSpeed: 1, playbackRate: 1,
});
export type TuningKey = keyof typeof DEFAULT_TUNING;
export const tuning: Record<TuningKey, number> = { ...DEFAULT_TUNING };
export type DealStage = 'prepare' | 'extract' | 'travel' | 'contact' | 'settle' | 'pause';
export interface Cue { name: string; duration: number; run?: (duration: number) => Promise<void>; enter?: () => void }
export interface TimelineEvent { timeline: string; cue: string; edge: 'start' | 'end' | 'cancel'; time: number; duration: number }
export const timelineObservers = new Set<(event: TimelineEvent) => void>();

/** A single abortable clock. The director never draws cards or changes payouts. */
export class AnimationDirector {
  constructor(readonly motion: Motion) {}
  async play(name: string, cues: readonly Cue[]): Promise<void> {
    for (const cue of cues) {
      this.motion.signal.throwIfAborted();
      const emit = (edge: TimelineEvent['edge']) => {
        const event = { timeline: name, cue: cue.name, edge, time: performance.now(), duration: cue.duration * this.motion.scale };
        for (const observer of timelineObservers) observer(event);
      };
      emit('start');
      try { cue.enter?.(); await (cue.run ? cue.run(cue.duration) : this.motion.wait(cue.duration)); this.motion.signal.throwIfAborted(); emit('end'); }
      catch (error) { emit('cancel'); throw error; }
    }
  }
}

/** Deliberately asymmetric phrasing: formal opening, flowing middle, held fourth card. */
export function dealTiming(deal: Pick<Deal, 'side' | 'index'>): Record<DealStage, number> {
  const ordinal = deal.index * 2 + (deal.side === 'banker' ? 1 : 0);
  const phrasing = [1.08, 1, .94, 1.03, 1.10, 1.13][ordinal] ?? 1;
  const rate = tuning.dealSpeed * tuning.dealerSpeed;
  return { prepare: (ordinal === 0 ? 440 : ordinal >= 4 ? 450 : 330) / rate,
    extract: 360 * phrasing / rate, travel: tuning.flight * phrasing / rate,
    contact: tuning.landing * phrasing / rate, settle: (ordinal === 3 ? 290 : 210) / rate,
    pause: (tuning.gap + (ordinal === 3 ? 170 : 0)) / rate };
}

export interface RevealTiming { pause: number; lift: number; turn: number; land: number; score: number; focus: boolean; reason: string }
/** Suspense uses only cards already visible. Hidden outcomes never leak through timing. */
export function revealTiming(deal: Pick<Deal, 'side' | 'index'>, visible: Record<Side, readonly Card[]>): RevealTiming {
  const own = visible[deal.side], other = visible[deal.side === 'player' ? 'banker' : 'player'];
  const third = deal.index === 2;
  const close = own.length > 0 && other.length > 0 && Math.abs(score(own) - score(other)) <= 1;
  const naturalVisible = other.length === 2 && score(other) >= 8;
  const factor = third ? 1.18 : close || naturalVisible ? 1.09 : 1;
  return { pause: (third ? 680 : close ? 470 : 310) / tuning.revealSpeed,
    lift: 210 * factor / tuning.revealSpeed, turn: 490 * factor / tuning.revealSpeed,
    land: 240 * factor / tuning.revealSpeed, score: 210 / tuning.revealSpeed,
    focus: third, reason: third ? 'third-card' : naturalVisible ? 'visible-natural' : close ? 'close-visible-score' : 'normal' };
}
