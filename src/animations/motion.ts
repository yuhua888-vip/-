import { tuning } from './director.js';
export const EASE = 'cubic-bezier(.22,.68,.25,1)';
export class Motion {
  private controller = new AbortController();
  private animations = new Set<Animation>();
  reduced = false;
  quick = false;
  get signal(): AbortSignal { return this.controller.signal; }
  get scale(): number { return (this.quick ? .88 : 1) / tuning.playbackRate; }
  reset(): void { this.cancel(); this.controller = new AbortController(); }
  cancel(): void { this.controller.abort(); for (const animation of this.animations) animation.cancel(); this.animations.clear(); }
  finishAnimations(): void { for (const animation of this.animations) { try { animation.finish(); } catch { animation.cancel(); } } }
  wait(milliseconds: number, realTime = false): Promise<void> {
    const signal = this.signal;
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException('Motion cancelled', 'AbortError')); return; }
      const abort = () => { clearTimeout(timer); reject(new DOMException('Motion cancelled', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, realTime ? milliseconds : milliseconds * this.scale);
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  tween(from: number, to: number, milliseconds: number, update: (value: number) => void): Promise<void> {
    const signal = this.signal;
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(new DOMException('Motion cancelled', 'AbortError')); return; }
      let frame = 0; const start = performance.now(), duration = Math.max(1, milliseconds * this.scale);
      const abort = () => { cancelAnimationFrame(frame); reject(new DOMException('Motion cancelled', 'AbortError')); };
      signal.addEventListener('abort', abort, { once: true });
      const tick = (time: number) => {
        const progress = Math.min(1, (time - start) / duration);
        update(from + (to - from) * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) frame = requestAnimationFrame(tick);
        else { signal.removeEventListener('abort', abort); resolve(); }
      };
      frame = requestAnimationFrame(tick);
    });
  }
  async animate(element: Element, keyframes: Keyframe[], milliseconds: number, options: KeyframeAnimationOptions = {}): Promise<void> {
    const signal = this.signal;
    if (signal.aborted) throw new DOMException('Motion cancelled', 'AbortError');
    // Accessibility removes spatial motion without accelerating the game clock.
    if (this.reduced && 'style' in element) {
      const style = (element as HTMLElement).style;
      if (keyframes.some(frame => frame.transform !== undefined)) style.transform = 'none';
      if (keyframes.some(frame => frame.clipPath !== undefined)) style.clipPath = 'none';
    }
    const frames = this.reduced ? keyframes.map(({ transform: _transform, filter: _filter, clipPath: _clip, ...frame }) => frame) : keyframes;
    const animation = element.animate(frames, { duration: Math.max(1, milliseconds * this.scale), easing: EASE, fill: 'both', ...options });
    this.animations.add(animation);
    const abort = () => animation.cancel(); signal.addEventListener('abort', abort, { once: true });
    try { await animation.finished; }
    finally { if (animation.playState === 'finished') { try { animation.commitStyles(); } catch { /* detached node */ } } animation.cancel(); this.animations.delete(animation); signal.removeEventListener('abort', abort); }
  }
}
