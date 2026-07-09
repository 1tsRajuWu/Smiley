#!/usr/bin/env node
const assert = require('assert');
const path = require('path');

class FakeClock {
  constructor() {
    this.now = 0;
    this.nextId = 1;
    this.timers = new Map();
  }

  setTimeout(fn, delay = 0) {
    const id = this.nextId++;
    this.timers.set(id, { id, fn, at: this.now + Math.max(0, delay) });
    return id;
  }

  clearTimeout(id) {
    this.timers.delete(id);
  }

  async advance(ms) {
    const target = this.now + ms;
    while (true) {
      let next = null;
      for (const timer of this.timers.values()) {
        if (timer.at <= target && (!next || timer.at < next.at || (timer.at === next.at && timer.id < next.id))) {
          next = timer;
        }
      }
      if (!next) break;
      this.now = next.at;
      this.timers.delete(next.id);
      next.fn();
      await flushMicrotasks();
    }
    this.now = target;
    await flushMicrotasks();
  }
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function withPatchedTimers(run) {
  const clock = new FakeClock();
  const realSetTimeout = global.setTimeout;
  const realClearTimeout = global.clearTimeout;
  const realDateNow = Date.now;
  global.setTimeout = clock.setTimeout.bind(clock);
  global.clearTimeout = clock.clearTimeout.bind(clock);
  Date.now = () => clock.now;
  return Promise.resolve()
    .then(() => run(clock))
    .finally(() => {
      global.setTimeout = realSetTimeout;
      global.clearTimeout = realClearTimeout;
      Date.now = realDateNow;
    });
}

function loadCodingSyncWithMock(serviceFactory) {
  const codingSyncPath = path.join(__dirname, '..', 'electron', 'coding-sync.js');
  const nowCodingPath = path.join(__dirname, '..', 'electron', 'now-coding.js');
  delete require.cache[codingSyncPath];
  delete require.cache[nowCodingPath];
  require.cache[nowCodingPath] = {
    id: nowCodingPath,
    filename: nowCodingPath,
    loaded: true,
    exports: serviceFactory,
  };
  const mod = require(codingSyncPath);
  delete require.cache[codingSyncPath];
  delete require.cache[nowCodingPath];
  return mod;
}

async function testLatestQueuedSessionWins() {
  let emitForeground = null;
  const applied = [];
  const { createCodingSync } = loadCodingSyncWithMock({
    codingSig(session) {
      return session ? [session.appName, session.liveLine || ''].join('\0') : '';
    },
    createNowCodingService({ onUpdate }) {
      emitForeground = onUpdate;
      return {
        async start() {},
        async stop() {},
      };
    },
  });

  await withPatchedTimers(async (clock) => {
    const sync = createCodingSync({
      getConfig: () => ({ codingNowPlaying: true }),
      applyCodingPresence: async (activity) => {
        applied.push(activity);
      },
      sendToRenderer: () => {},
      isPaused: () => false,
    });

    sync.start({ id: 'coding', details: 'Coding', state: 'Building something cool' });
    await flushMicrotasks();
    assert.equal(applied.length, 1, 'initial coding fallback should apply once');

    emitForeground({ appName: 'Cursor', liveLine: 'Editing alpha.js' });
    emitForeground({ appName: 'Cursor', liveLine: 'Editing beta.js' });
    await flushMicrotasks();
    assert.equal(applied.length, 1, 'live update should be delayed during cooldown');

    await clock.advance(4000);
    assert.equal(applied.length, 2, 'only one queued live update should apply');
    assert.equal(applied[1].codingSession.liveLine, 'Editing beta.js', 'latest queued session should win');
  });
}

async function testStopCancelsPendingPresence() {
  let emitForeground = null;
  const applied = [];
  const { createCodingSync } = loadCodingSyncWithMock({
    codingSig(session) {
      return session ? [session.appName, session.liveLine || ''].join('\0') : '';
    },
    createNowCodingService({ onUpdate }) {
      emitForeground = onUpdate;
      return {
        async start() {},
        async stop() {},
      };
    },
  });

  await withPatchedTimers(async (clock) => {
    const sync = createCodingSync({
      getConfig: () => ({ codingNowPlaying: true }),
      applyCodingPresence: async (activity) => {
        applied.push(activity);
      },
      sendToRenderer: () => {},
      isPaused: () => false,
    });

    sync.start({ id: 'coding', details: 'Coding', state: 'Building something cool' });
    await flushMicrotasks();
    assert.equal(applied.length, 1, 'initial coding fallback should apply once');

    emitForeground({ appName: 'Cursor', liveLine: 'Editing gamma.js' });
    await flushMicrotasks();
    sync.stop();

    await clock.advance(5000);
    assert.equal(applied.length, 1, 'stop should cancel pending presence writes');
  });
}

async function main() {
  console.log('=== Smiley Coding Sync Self-Check ===\n');
  const tests = [
    ['Latest queued coding session wins', testLatestQueuedSessionWins],
    ['Stop cancels pending coding update', testStopCancelsPendingPresence],
  ];
  let passed = 0;
  for (const [label, fn] of tests) {
    try {
      await fn();
      passed += 1;
      console.log(`  PASS: ${label}`);
    } catch (err) {
      console.log(`  FAIL: ${label}`);
      console.error(`    ${err.stack || err.message}`);
    }
  }
  console.log(`\nResult: ${passed}/${tests.length} checks passed`);
  if (passed !== tests.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
