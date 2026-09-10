const defaultClock = {
    now: () => performance.now(),
    schedule: (callback, ms) => setTimeout(callback, ms),
    clear: id => clearTimeout(id)
};
/** One owner for all phase/presentation waits. Hidden tabs pause active time. */
export class Timeline {
    clock;
    pending = new Set();
    paused = false;
    stopped = false;
    constructor(clock = defaultClock) {
        this.clock = clock;
    }
    wait(ms) {
        if (this.stopped)
            return Promise.reject(new Error('Timeline stopped'));
        if (!Number.isFinite(ms) || ms < 0)
            return Promise.reject(new Error('Invalid duration'));
        return new Promise((resolve, reject) => {
            const task = { remaining: ms, started: 0, id: null, resolve, reject };
            this.pending.add(task);
            if (!this.paused)
                this.arm(task);
        });
    }
    arm(task) {
        task.started = this.clock.now();
        task.id = this.clock.schedule(() => {
            this.pending.delete(task);
            task.resolve();
        }, task.remaining);
    }
    setPaused(paused) {
        if (this.paused === paused || this.stopped)
            return;
        this.paused = paused;
        for (const task of this.pending) {
            if (paused && task.id !== null) {
                this.clock.clear(task.id);
                task.id = null;
                task.remaining = Math.max(0, task.remaining - (this.clock.now() - task.started));
            }
            else if (!paused)
                this.arm(task);
        }
    }
    cancel() {
        if (this.stopped)
            return;
        this.stopped = true;
        for (const task of this.pending) {
            if (task.id !== null)
                this.clock.clear(task.id);
            task.reject(new Error('Timeline stopped'));
        }
        this.pending.clear();
    }
}
