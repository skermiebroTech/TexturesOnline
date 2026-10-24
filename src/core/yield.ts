// Breaking work into tasks so taps and key presses get a quick next paint (Interaction to Next Paint):
// a handler shows its visual feedback, then yields before the heavy part, and long background jobs
// give the event loop a turn between their pieces.

type Scheduler = { yield?: () => Promise<void> };

/** A new task (MessageChannel: not clamped like nested timers, and runs while the tab is hidden). */
export function nextTask(): Promise<void> {
  if (typeof MessageChannel === 'undefined') return new Promise((r) => setTimeout(r, 0));
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      resolve();
    };
    ch.port2.postMessage(null);
  });
}

/**
 * Lets pending input and rendering run, then continues: `scheduler.yield()` where the browser has it
 * (the continuation goes ahead of other queued tasks), else a new task.
 */
export function yieldToMain(): Promise<void> {
  const sched = (globalThis as { scheduler?: Scheduler }).scheduler;
  if (typeof sched?.yield === 'function') return sched.yield();
  return nextTask();
}

/**
 * Resolves after the next frame has been painted: for work that should come after the visual
 * response to an interaction. A hidden tab (no frames) moves on after a short timeout.
 */
export function afterNextPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function' || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return nextTask();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    // rAF runs before the paint; the task it queues runs after it
    requestAnimationFrame(() => void nextTask().then(finish));
    const timer = setTimeout(finish, 100);
  });
}
