import test from 'node:test';
import assert from 'node:assert/strict';
import { Timeline } from '../dist/src/game/timeline.js';

class FakeClock {
  time = 0;
  nextId = 1;
  tasks = new Map();
  now = () => this.time;
  schedule = (callback, ms) => {
    const id = this.nextId++;
    this.tasks.set(id, { callback, due: this.time + ms });
    return id;
  };
  clear = id => { this.tasks.delete(id); };
  advance(ms) {
    const target = this.time + ms;
    for (;;) {
      const next = [...this.tasks].filter(([, task]) => task.due <= target)
        .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!next) break;
      const [id, task] = next;
      this.time = task.due;
      this.tasks.delete(id);
      task.callback();
    }
    this.time = target;
  }
}

test('production timeline constructs without an injected clock and completes a real timer', async () => {
  const timeline = new Timeline();
  await timeline.wait(0);
  timeline.cancel();
});

test('wait resolves at its deadline, with independent simultaneous waits', async () => {
  const clock = new FakeClock();
  const timeline = new Timeline(clock);
  const completed = [];
  const a = timeline.wait(100).then(() => completed.push('a'));
  const b = timeline.wait(40).then(() => completed.push('b'));
  clock.advance(39);
  await Promise.resolve();
  assert.deepEqual(completed, []);
  clock.advance(1);
  await Promise.resolve();
  assert.deepEqual(completed, ['b']);
  clock.advance(59);
  await Promise.resolve();
  assert.deepEqual(completed, ['b']);
  clock.advance(1);
  await Promise.all([a, b]);
  assert.deepEqual(completed, ['b', 'a']);
  assert.equal(clock.tasks.size, 0);
});

test('zero waits remain asynchronous and invalid durations schedule nothing', async () => {
  const clock = new FakeClock();
  const timeline = new Timeline(clock);
  for (const duration of [-1, NaN, Infinity, -Infinity, '100', undefined]) {
    await assert.rejects(timeline.wait(duration), /Invalid duration/);
  }
  assert.equal(clock.tasks.size, 0);
  let done = false;
  const waiting = timeline.wait(0).then(() => { done = true; });
  assert.equal(done, false);
  clock.advance(0);
  await waiting;
  assert.equal(done, true);
});

test('background pause preserves remaining active time, including repeated pauses', async () => {
  const clock = new FakeClock();
  const timeline = new Timeline(clock);
  let done = false;
  const waiting = timeline.wait(100).then(() => { done = true; });
  clock.advance(30);
  timeline.setPaused(true);
  timeline.setPaused(true);
  clock.advance(10_000);
  await Promise.resolve();
  assert.equal(done, false);
  assert.equal(clock.tasks.size, 0);
  timeline.setPaused(false);
  timeline.setPaused(false);
  clock.advance(20);
  timeline.setPaused(true);
  clock.advance(10_000);
  timeline.setPaused(false);
  clock.advance(49);
  await Promise.resolve();
  assert.equal(done, false);
  clock.advance(1);
  await waiting;
  assert.equal(done, true);
});

test('waits created while paused receive their complete duration after resume', async () => {
  const clock = new FakeClock();
  const timeline = new Timeline(clock);
  timeline.setPaused(true);
  let done = false;
  const waiting = timeline.wait(80).then(() => { done = true; });
  assert.equal(clock.tasks.size, 0);
  clock.advance(50_000);
  timeline.setPaused(false);
  clock.advance(79);
  await Promise.resolve();
  assert.equal(done, false);
  clock.advance(1);
  await waiting;
  assert.equal(done, true);
});

test('cancel rejects all pending active/paused waits and prevents future waits', async () => {
  const clock = new FakeClock();
  const timeline = new Timeline(clock);
  const a = assert.rejects(timeline.wait(100), /Timeline stopped/);
  clock.advance(20);
  timeline.setPaused(true);
  const b = assert.rejects(timeline.wait(200), /Timeline stopped/);
  timeline.cancel();
  timeline.cancel();
  await Promise.all([a, b]);
  assert.equal(clock.tasks.size, 0);
  timeline.setPaused(false);
  await assert.rejects(timeline.wait(0), /Timeline stopped/);
  clock.advance(10_000);
  assert.equal(clock.tasks.size, 0);
});

test('cancelling after a completed wait cannot alter its completion', async () => {
  const clock = new FakeClock();
  const timeline = new Timeline(clock);
  const waiting = timeline.wait(10);
  clock.advance(10);
  timeline.cancel();
  await waiting;
  assert.equal(clock.tasks.size, 0);
});
