import { tuning } from './director.js';
export const EASE = 'cubic-bezier(.22,.68,.25,1)';
export class Motion {
    controller = new AbortController();
    animations = new Set();
    reduced = false;
    quick = false;
    get signal() { return this.controller.signal; }
    get scale() { return (this.quick ? .88 : 1) / tuning.playbackRate; }
    reset() { this.cancel(); this.controller = new AbortController(); }
    cancel() { this.controller.abort(); for (const animation of this.animations)
        animation.cancel(); this.animations.clear(); }
    finishAnimations() { for (const animation of this.animations) {
        try {
            animation.finish();
        }
        catch {
            animation.cancel();
        }
    } }
    wait(milliseconds, realTime = false) {
        const signal = this.signal;
        return new Promise((resolve, reject) => {
            if (signal.aborted) {
                reject(new DOMException('Motion cancelled', 'AbortError'));
                return;
            }
            const abort = () => { clearTimeout(timer); reject(new DOMException('Motion cancelled', 'AbortError')); };
            const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, realTime ? milliseconds : milliseconds * this.scale);
            signal.addEventListener('abort', abort, { once: true });
        });
    }
    tween(from, to, milliseconds, update) {
        const signal = this.signal;
        return new Promise((resolve, reject) => {
            if (signal.aborted) {
                reject(new DOMException('Motion cancelled', 'AbortError'));
                return;
            }
            let frame = 0;
            const start = performance.now(), duration = Math.max(1, milliseconds * this.scale);
            const abort = () => { cancelAnimationFrame(frame); reject(new DOMException('Motion cancelled', 'AbortError')); };
            signal.addEventListener('abort', abort, { once: true });
            const tick = (time) => {
                const progress = Math.min(1, (time - start) / duration);
                update(from + (to - from) * (1 - Math.pow(1 - progress, 3)));
                if (progress < 1)
                    frame = requestAnimationFrame(tick);
                else {
                    signal.removeEventListener('abort', abort);
                    resolve();
                }
            };
            frame = requestAnimationFrame(tick);
        });
    }
    async animate(element, keyframes, milliseconds, options = {}) {
        const signal = this.signal;
        if (signal.aborted)
            throw new DOMException('Motion cancelled', 'AbortError');
        // Accessibility removes spatial motion without accelerating the game clock.
        if (this.reduced && 'style' in element) {
            const style = element.style;
            if (keyframes.some(frame => frame.transform !== undefined))
                style.transform = 'none';
            if (keyframes.some(frame => frame.clipPath !== undefined))
                style.clipPath = 'none';
        }
        const frames = this.reduced ? keyframes.map(({ transform: _transform, filter: _filter, clipPath: _clip, ...frame }) => frame) : keyframes;
        const animation = element.animate(frames, { duration: Math.max(1, milliseconds * this.scale), easing: EASE, fill: 'both', ...options });
        this.animations.add(animation);
        const abort = () => animation.cancel();
        signal.addEventListener('abort', abort, { once: true });
        try {
            await animation.finished;
        }
        finally {
            if (animation.playState === 'finished') {
                try {
                    animation.commitStyles();
                }
                catch { /* detached node */ }
            }
            animation.cancel();
            this.animations.delete(animation);
            signal.removeEventListener('abort', abort);
        }
    }
}
