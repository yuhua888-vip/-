export const EASE = 'cubic-bezier(.18,.75,.22,1)';
export const TIMING = { chip: 460, card: 680, flip: 440, fast: 160, normal: 350, slow: 750, cinematic: 1100 };
export class Motion {
  private controller = new AbortController();
  private animations = new Set<Animation>();
  reduced = false;
  quick = false;
  get signal(): AbortSignal { return this.controller.signal; }
  get scale(): number { return this.reduced ? 0.06 : this.quick ? 0.62 : 1; }
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
    if (this.signal.aborted) throw new DOMException('Motion cancelled', 'AbortError');
    const animation = element.animate(keyframes, { duration: Math.max(1, milliseconds * this.scale), easing: EASE, fill: 'none', ...options });
    this.animations.add(animation);
    const abort = () => animation.cancel(); this.signal.addEventListener('abort', abort, { once: true });
    try { await animation.finished; }
    finally { this.animations.delete(animation); this.signal.removeEventListener('abort', abort); }
  }
}
