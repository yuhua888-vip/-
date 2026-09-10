export interface Clock {
  now(): number;
  schedule(callback: () => void, ms: number): number;
  clear(id: number): void;
}

interface Pending {
  remaining: number;
  started: number;
  id: number | null;
  resolve(): void;
  reject(error: Error): void;
}

const defaultClock: Clock = {
  now: () => performance.now(),
  schedule: (callback, ms) => setTimeout(callback, ms),
  clear: id => clearTimeout(id)
};

/** One owner for all phase/presentation waits. Hidden tabs pause active time. */
export class Timeline {
  private readonly pending = new Set<Pending>();
  private paused = false;
  private stopped = false;
  constructor(private readonly clock: Clock = defaultClock) {}

  wait(ms: number): Promise<void> {
    if (this.stopped) return Promise.reject(new Error('Timeline stopped'));
    if (!Number.isFinite(ms) || ms < 0) return Promise.reject(new Error('Invalid duration'));
    return new Promise((resolve, reject) => {
      const task: Pending = { remaining: ms, started: 0, id: null, resolve, reject };
      this.pending.add(task);
      if (!this.paused) this.arm(task);
    });
  }

  private arm(task: Pending): void {
    task.started = this.clock.now();
    task.id = this.clock.schedule(() => {
      this.pending.delete(task);
      task.resolve();
    }, task.remaining);
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused || this.stopped) return;
    this.paused = paused;
    for (const task of this.pending) {
      if (paused && task.id !== null) {
        this.clock.clear(task.id);
        task.id = null;
        task.remaining = Math.max(0, task.remaining - (this.clock.now() - task.started));
      } else if (!paused) this.arm(task);
    }
  }

  cancel(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const task of this.pending) {
      if (task.id !== null) this.clock.clear(task.id);
      task.reject(new Error('Timeline stopped'));
    }
    this.pending.clear();
  }
}
