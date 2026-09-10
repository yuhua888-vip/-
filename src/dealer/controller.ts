import { PHASE_LABELS, type Phase } from '../game/state.js';
export interface DealerBrain { onPhase(phase: Phase): string | null }
export class ScriptedDealerBrain implements DealerBrain { onPhase(phase: Phase): string { return PHASE_LABELS[phase]; } }
export class DealerController {
  private pose = 0;
  private transition: Animation | null = null;
  private previousArt: HTMLElement | null = null;
  constructor(private element: HTMLElement, private caption: HTMLElement, private brain: DealerBrain = new ScriptedDealerBrain()) {}
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
        const animation = previous.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out' });
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
