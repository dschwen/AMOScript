'use strict';

function createFakeTimers() {
  let now = 0;
  let idSeq = 1;
  const tasks = new Map();

  function schedule(fn, delay = 0) {
    const id = idSeq++;
    const time = now + Math.max(0, Number(delay) || 0);
    tasks.set(id, { id, time, fn });
    return id;
  }

  function clear(id) {
    tasks.delete(id);
  }

  function nextTask() {
    let min = Infinity, chosen = null;
    for (const t of tasks.values()) {
      if (t.time < min) { min = t.time; chosen = t; }
    }
    return chosen;
  }

  function tick(ms = Infinity) {
    const until = now + (ms === Infinity ? Number.MAX_SAFE_INTEGER : Math.max(0, ms));
    while (true) {
      const t = nextTask();
      if (!t || t.time > until) break;
      tasks.delete(t.id);
      now = t.time;
      t.fn();
    }
    if (ms !== Infinity) now = until;
  }

  function runAll() {
    tick(Infinity);
  }

  return {
    setTimeout: schedule,
    clearTimeout: clear,
    tick,
    runAll,
    now: () => now,
    pending: () => tasks.size,
  };
}

module.exports = { createFakeTimers };

