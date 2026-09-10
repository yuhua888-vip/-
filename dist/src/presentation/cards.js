import { MOTION } from '../game/controller.js';
export class CardPresenter {
    timeline;
    overlay;
    shoe;
    animations = new Set();
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    paused = document.hidden;
    constructor(timeline, overlay, shoe) {
        this.timeline = timeline;
        this.overlay = overlay;
        this.shoe = shoe;
    }
    setPaused(paused) {
        this.paused = paused;
        for (const animation of this.animations)
            paused ? animation.pause() : animation.play();
    }
    async animate(node, frames, duration) {
        const time = this.reducedMotion.matches ? Math.min(60, duration) : duration;
        const animation = node.animate(frames, { duration: time, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
        this.animations.add(animation);
        if (this.paused)
            animation.pause();
        try {
            // The shared clock remains authoritative even if a browser drops a finish event.
            await this.timeline.wait(time);
        }
        finally {
            animation.cancel();
            this.animations.delete(animation);
        }
    }
    create(card) {
        const node = document.createElement('div');
        node.className = 'card-3d';
        node.setAttribute('aria-label', '未开牌');
        node.dataset.faceLabel = `${card.value}${card.suit}`;
        // Card values and suits are validated by the pure engine; no user HTML enters this template.
        node.innerHTML = `<div class="card-3d-flipper">
      <div class="card-side card-back flex items-center justify-center"><span class="card-monogram">Q</span></div>
      <div class="card-side card-front p-1 flex flex-col justify-between ${card.isRed ? 'text-rose-600' : 'text-zinc-900'}" aria-hidden="true">
        <div class="card-index">${card.value}<br>${card.suit}</div>
        <div class="card-pip self-center">${card.suit}</div>
        <div class="card-index self-end rotate-180">${card.value}<br>${card.suit}</div>
      </div></div>`;
        return node;
    }
    async deal(slot, card) {
        const node = this.create(card);
        slot.replaceChildren(node);
        node.style.visibility = 'hidden';
        const start = this.shoe.getBoundingClientRect();
        const target = slot.getBoundingClientRect();
        const flight = document.createElement('div');
        flight.className = 'flight-card-node card-back';
        flight.style.cssText = `width:${target.width}px;height:${target.height}px;left:${target.left}px;top:${target.top}px;`;
        flight.innerHTML = '<span class="card-monogram">Q</span>';
        this.overlay.appendChild(flight);
        const dx = start.left + start.width / 2 - target.left - target.width / 2;
        const dy = start.bottom - target.top - target.height / 2;
        try {
            await this.animate(flight, [
                { transform: `translate(${dx}px,${dy}px) rotate(-8deg) scale(.9)` },
                { offset: .2, transform: `translate(${dx * .92}px,${dy * .8}px) rotate(-5deg)` },
                { transform: 'translate(0,0) rotate(0deg)' }
            ], MOTION.normal);
            node.style.visibility = 'visible';
            await this.animate(node, [{ transform: 'translateY(-2px)' }, { transform: 'translateY(0)' }], 90);
        }
        finally {
            flight.remove();
        }
    }
    async reveal(slot) {
        const node = slot.querySelector('.card-3d');
        const flipper = slot.querySelector('.card-3d-flipper');
        if (!flipper || !node)
            throw new Error('Cannot reveal a missing card');
        await this.animate(flipper, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }], MOTION.normal);
        flipper.classList.add('flipped');
        node.setAttribute('aria-label', node.dataset.faceLabel ?? '已开牌');
        node.querySelector('.card-front')?.removeAttribute('aria-hidden');
    }
    dispose() {
        for (const animation of this.animations)
            animation.cancel();
        this.animations.clear();
        this.overlay.replaceChildren();
    }
}
