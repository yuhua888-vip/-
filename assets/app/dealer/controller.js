import { PHASE_LABELS } from '../game/state.js';
export class ScriptedDealerBrain {
    onPhase(phase) { return PHASE_LABELS[phase]; }
}
export class DealerController {
    element;
    caption;
    brain;
    pose = 0;
    transition = null;
    previousArt = null;
    constructor(element, caption, brain = new ScriptedDealerBrain()) {
        this.element = element;
        this.caption = caption;
        this.brain = brain;
    }
    set(phase) {
        let pose = 0;
        if (phase === 'BETTING_CLOSED' || phase === 'BETTING_WARNING')
            pose = 1;
        if (['PREPARE_DEAL', 'DEAL_PLAYER', 'DEAL_BANKER', 'PLAYER_DRAW', 'BANKER_DRAW', 'PLAYER_PEEK', 'BANKER_PEEK'].includes(phase))
            pose = 2;
        if (['RESULT', 'COLLECT_CHIPS', 'PAYOUT'].includes(phase))
            pose = 3;
        if (pose !== this.pose) {
            this.transition?.cancel();
            this.previousArt?.remove();
            const art = this.element.querySelector('.queen-art');
            if (art && !document.body.classList.contains('reduced')) {
                const previous = art.cloneNode();
                const positions = ['0 0', '100% 0', '0 100%', '100% 100%'];
                previous.style.backgroundPosition = positions[this.pose];
                previous.style.animation = 'none';
                this.element.append(previous);
                this.previousArt = previous;
                const animation = previous.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out' });
                this.transition = animation;
                void animation.finished.catch(() => { }).finally(() => {
                    previous.remove();
                    if (this.previousArt === previous)
                        this.previousArt = null;
                });
            }
        }
        this.pose = pose;
        this.element.dataset.pose = String(pose);
        this.element.dataset.phase = phase;
        this.caption.textContent = this.brain.onPhase(phase) ?? '';
    }
}
