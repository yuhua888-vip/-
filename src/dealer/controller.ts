import { PHASE_LABELS, type Phase } from '../game/state.js';
import type { Motion } from '../animations/motion.js';
import { tuning, type DealStage } from '../animations/director.js';
export interface DealerBrain { onPhase(phase: Phase): string | null }
export class ScriptedDealerBrain implements DealerBrain { onPhase(phase: Phase): string { return PHASE_LABELS[phase]; } }
export class DealerController {
  private pose = 0;
  private transition: Animation | null = null;
  private previousArt: HTMLElement | null = null;
  constructor(private element: HTMLElement, private caption: HTMLElement, private brain: DealerBrain = new ScriptedDealerBrain()) {}
  async cue(stage: DealStage, side: 'player' | 'banker', duration: number, motion: Motion): Promise<void> {
    this.element.dataset.gesture = stage;
    const direction = side === 'player' ? -1 : 1;
    const positions: Record<DealStage, string> = {
      prepare: 'translate(0,0) rotate(0deg)', extract: 'translate(3px,2px) rotate(.35deg)',
      travel: `translate(${direction * 4}px,4px) rotate(${direction * .6}deg)`,
      contact: `translate(${direction * 3}px,3px) rotate(${direction * .3}deg)`,
      settle: 'translate(0,0) rotate(0deg)', pause: 'translate(0,0) rotate(0deg)',
    };
    // Shared cue duration binds dealer speed to the card and audio clock.
    const from = this.element.style.transform || 'translate(0,0) rotate(0deg)';
    await motion.animate(this.element, [{ transform: from }, { transform: positions[stage] }], duration);
  }
  rest(): void { delete this.element.dataset.gesture; this.element.style.removeProperty('transform'); }
  set(phase: Phase): void {
    let pose = 0;
    if (phase === 'BETTING_CLOSED' || phase === 'BETTING_WARNING') pose = 1;
    if (['PREPARE_DEAL','DEAL_PLAYER','DEAL_BANKER','PLAYER_DRAW','BANKER_DRAW','PLAYER_PEEK','BANKER_PEEK'].includes(phase)) pose = 2;
    if (['RESULT','COLLECT_CHIPS','PAYOUT'].includes(phase)) pose = 3;
    if (pose !== this.pose) {
      this.transition?.cancel(); this.previousArt?.remove();
      const art = this.element.querySelector<HTMLElement>('.queen-art');
      if (art && !document.body.classList.contains('reduced')) {
        const previous = art.cloneNode() as HTMLElement;
        const positions = ['0 0', '100% 0', '0 100%', '100% 100%'];
        previous.style.backgroundPosition = positions[this.pose]!;
        previous.style.animation = 'none';
        this.element.append(previous); this.previousArt = previous;
        const animation = previous.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260 / tuning.playbackRate, easing: 'ease-out' });
        this.transition = animation;
        void animation.finished.catch(() => {}).finally(() => {
          previous.remove(); if (this.previousArt === previous) this.previousArt = null;
        });
      }
    }
    this.pose = pose;
    this.element.dataset.pose = String(pose); this.element.dataset.phase = phase;
    this.caption.textContent = this.brain.onPhase(phase) ?? '';
  }
}
