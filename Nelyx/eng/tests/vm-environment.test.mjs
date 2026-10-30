// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { installVmEnvironment, formatVmValue } from '../../sdk/dist/runtime/vm-environment.js';
import { nativeHermesBridge } from '../../sdk/dist/backends/native-hermes/bridge.js';
const timeout = 1_200_000;
function fixture(target = {}) {
  const timers = new Map(),
    frames = new Map(),
    microtasks = [],
    errors = [],
    logs = [],
    cancelled = [];
  let sequence = 0,
    rejection;
  const ports = {
    now: () => 125,
    setTimer(callback, delay, repeat) {
      const id = ++sequence;
      timers.set(id, { callback, delay, repeat });
      return id;
    },
    clearTimer(id) {
      cancelled.push(['timer', id]);
      timers.delete(id);
    },
    requestFrame(callback) {
      const id = ++sequence;
      frames.set(id, callback);
      return id;
    },
    cancelFrame(id) {
      cancelled.push(['frame', id]);
      frames.delete(id);
    },
    queueMicrotask: (callback) => microtasks.push(callback),
    trackRejections(callback) {
      rejection = callback;
    },
    fail: (message) => errors.push(message),
    log: (message) => logs.push(message),
  };
  const owner = installVmEnvironment(target, ports, { AbortController, AbortSignal });
  return {
    owner,
    target,
    ports,
    timers,
    frames,
    microtasks,
    errors,
    logs,
    cancelled,
    reject: (error) => rejection(error),
    tick(id) {
      const timer = timers.get(id);
      if (!timer.repeat) timers.delete(id);
      timer.callback();
    },
    checkpoint() {
      while (microtasks.length) microtasks.shift()();
    },
  };
}
test(
  'one VM installs and claims one app, with independent timers, arguments and frame timestamps',
  { timeout },
  () => {
    const f = fixture(),
      events = [];
    assert.equal(installVmEnvironment(f.target, f.ports, {}), f.owner);
    assert.throws(() => installVmEnvironment(f.target, { ...f.ports }, {}), /already/);
    f.owner.claimApplication();
    assert.throws(() => f.owner.claimApplication(), /already/);
    assert.equal(f.target.performance.now(), 125);
    const timer = f.target.setTimeout((a, b) => events.push([a, b]), -9, 'a', 3),
      interval = f.target.setInterval(() => events.push('repeat'), Infinity);
    assert.equal(f.timers.get(timer).delay, 0);
    assert.equal(f.timers.get(interval).delay, 0);
    f.tick(timer);
    f.tick(interval);
    f.tick(interval);
    assert.deepEqual(events, [['a', 3], 'repeat', 'repeat']);
    f.target.clearTimeout(interval);
    assert.equal(f.timers.size, 0);
    const frame = f.target.requestAnimationFrame((tick) => events.push(tick));
    f.frames.get(frame)(142);
    assert.equal(events.at(-1), 142);
    assert.throws(() => f.target.setTimeout('source text', 1), TypeError);
    assert.throws(() => f.target.queueMicrotask(null), TypeError);
    f.owner.dispose();
    assert.equal(f.owner.state, 'closed');
    assert.equal(f.timers.size, 0);
  },
);
test(
  'close fences queued and late app callbacks while owned GPU retirement can still finish',
  { timeout },
  async () => {
    const f = fixture(),
      events = [];
    const timer = f.target.setInterval(() => events.push('timer'), 3),
      frame = f.target.requestAnimationFrame(() => events.push('frame'));
    const lateTimer = f.timers.get(timer).callback,
      lateFrame = f.frames.get(frame);
    f.target.queueMicrotask(() => events.push('microtask'));
    f.owner.beginClose();
    lateTimer();
    lateFrame(2);
    f.checkpoint();
    assert.deepEqual(events, []);
    assert.equal(f.timers.size, 0);
    assert.equal(f.frames.size, 0);
    assert.equal(f.cancelled.length, 2);
    assert(f.target.setTimeout(() => {}, 0) < 0);
    assert(f.target.setInterval(() => {}, 0) < 0);
    assert.equal(f.timers.size, 0);
    for (const run of [
      () => f.target.requestAnimationFrame(() => {}),
      () => f.target.queueMicrotask(() => {}),
    ])
      assert.throws(run, /closed/);
    const drain = f.owner.retirement.delay(16);
    assert.throws(() => f.owner.dispose(), /pending retirement/);
    assert.equal(f.owner.state, 'closing');
    f.tick([...f.timers.keys()][0]);
    await drain;
    f.owner.dispose();
    assert.equal(f.owner.state, 'closed');
    await assert.rejects(f.owner.retirement.delay(16), /closed/);
    f.reject('late rejection');
    assert.deepEqual(f.errors, []);
    assert(f.target.setTimeout(() => {}, 0) < 0);
    assert.equal(f.timers.size, 0);
  },
);
test(
  'microtask failures and Promise rejections preserve falsey errors without a second Promise chain',
  { timeout },
  () => {
    for (const error of [0, undefined, false]) {
      const f = fixture();
      f.target.queueMicrotask(() => {
        throw error;
      });
      let late = false;
      f.target.queueMicrotask(() => {
        late = true;
      });
      assert.equal(f.errors.length, 0);
      f.checkpoint();
      assert.deepEqual(f.errors, [String(error)]);
      assert.equal(late, false);
      assert.equal(f.owner.state, 'closing');
      f.owner.dispose();
    }
    const f = fixture();
    f.reject(false);
    assert.deepEqual(f.errors, ['false']);
    assert.equal(f.owner.state, 'closing');
    f.owner.dispose();
  },
);
test('timer and frame exceptions enter the same fenced SDK shutdown path', { timeout }, () => {
  for (const kind of ['timer', 'frame']) {
    const f = fixture();
    let called = false;
    const failing =
      kind === 'timer'
        ? f.target.setTimeout(() => {
            throw 'original';
          }, 0)
        : f.target.requestAnimationFrame(() => {
            throw 'original';
          });
    const pending = f.target.setInterval(() => {
        called = true;
      }, 1),
      late = f.timers.get(pending).callback;
    if (kind === 'timer') f.tick(failing);
    else f.frames.get(failing)(140);
    late();
    assert.equal(called, false);
    assert.equal(f.owner.state, 'closing');
    assert.deepEqual(f.errors, ['original']);
    assert.equal(f.timers.size, 0);
    f.owner.dispose();
  }
});
test(
  'console reports cyclic objects, BigInt and hostile getters without failing the VM',
  { timeout },
  () => {
    const f = fixture(),
      cycle = { n: 7n };
    cycle.self = cycle;
    f.target.console.log('cycle', cycle, undefined, 7n);
    assert.equal(f.logs[0], 'cycle {"n":"7n","self":"[Circular]"} undefined 7');
    f.target.console.error({
      get value() {
        throw Error('getter');
      },
    });
    assert.equal(f.logs[1], '<unprintable>');
    f.target.console.assert(false, 'original');
    assert.equal(f.logs[2], 'Assertion failed: original');
    assert.equal(
      formatVmValue({
        toJSON() {
          throw 0;
        },
      }),
      '<unprintable>',
    );
    assert.deepEqual(f.errors, []);
    f.owner.dispose();
  },
);
test(
  'an Error with a hostile non-string stack cannot break console or replace the error-reporting path',
  { timeout },
  () => {
    const f = fixture(),
      error = new Error('original');
    Object.defineProperty(error, 'stack', {
      value: {
        toString() {
          throw 0;
        },
      },
    });
    assert.doesNotThrow(() => f.target.console.error(error));
    assert.deepEqual(f.logs, ['<unprintable>']);
    assert.doesNotThrow(() => f.owner.reportError(error));
    assert.deepEqual(f.errors, ['<unprintable>']);
    assert.equal(f.owner.state, 'closing');
    f.owner.dispose();
  },
);
test(
  'cancellation attempts every owner and a falsey failure cannot become successful VM disposal',
  { timeout },
  () => {
    const f = fixture();
    f.target.setTimeout(() => {}, 0);
    f.target.setTimeout(() => {}, 0);
    f.target.requestAnimationFrame(() => {});
    f.ports.clearTimer = (id) => {
      f.cancelled.push(['failed', id]);
      throw 0;
    };
    assert.throws(
      () => f.owner.beginClose(),
      (error) => error instanceof AggregateError && error.errors.every((value) => value === 0),
    );
    assert.equal(f.cancelled.length, 3);
    assert.equal(f.owner.state, 'closing');
    assert.throws(
      () => f.owner.dispose(),
      (error) => error instanceof AggregateError && error.errors.every((value) => value === 0),
    );
    assert.equal(f.owner.state, 'closing');
  },
);
test(
  'missing ports and rejected installation leave globals unchanged and tracker callbacks fenced',
  { timeout },
  () => {
    const target = { console: 'previous' },
      f = fixture();
    assert.throws(
      () => installVmEnvironment(target, { ...f.ports, queueMicrotask: undefined }, {}),
      /Missing VM/,
    );
    assert.deepEqual(target, { console: 'previous' });
    let rejection;
    assert.throws(
      () =>
        installVmEnvironment(
          target,
          {
            ...f.ports,
            trackRejections(callback) {
              rejection = callback;
              throw Error('tracker');
            },
          },
          {},
        ),
      /tracker/,
    );
    assert.deepEqual(target, { console: 'previous' });
    rejection('aborted install');
    assert.equal(f.errors.length, 0);
    Object.defineProperty(target, 'setTimeout', { value: 'reserved', configurable: false });
    assert.throws(() => installVmEnvironment(target, f.ports, {}), /not configurable/);
    assert.equal(target.console, 'previous');
    f.owner.dispose();
  },
);
test(
  'native bridge rejects an older ABI, missing capability and missing method before use',
  { timeout },
  () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'NelyxNativeHost');
    const methods = [
      'now',
      'metrics',
      'listen',
      'publishSemantics',
      'editor',
      'environment',
      'service',
      'requestClose',
      'pressedKeys',
      'setTimer',
      'clearTimer',
      'requestFrame',
      'cancelFrame',
      'queueMicrotask',
      'completeShutdown',
      'fail',
      'log',
    ];
    const bridge = {
      abi: 2,
      mode: 'bytecode',
      assetRoot: 'C:/owned',
      capabilities: { vm: 1, services: 1, editing: 1, semantics: 1 },
      ...Object.fromEntries(
        methods.map((name) => [
          name,
          () => {
            throw Error('Not an admission probe');
          },
        ]),
      ),
    };
    try {
      globalThis.NelyxNativeHost = { ...bridge, abi: 1 };
      assert.throws(nativeHermesBridge, /ABI 2/);
      globalThis.NelyxNativeHost = {
        ...bridge,
        capabilities: { ...bridge.capabilities, editing: 0 },
      };
      assert.throws(nativeHermesBridge, /capability: editing/);
      globalThis.NelyxNativeHost = { ...bridge, queueMicrotask: null };
      assert.throws(nativeHermesBridge, /port: queueMicrotask/);
      globalThis.NelyxNativeHost = bridge;
      assert.equal(nativeHermesBridge(), bridge);
    } finally {
      if (previous) Object.defineProperty(globalThis, 'NelyxNativeHost', previous);
      else delete globalThis.NelyxNativeHost;
    }
  },
);
