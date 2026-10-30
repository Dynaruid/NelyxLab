// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSurfaceFrameClock } from '../../sdk/dist/runtime/frame-clock.js';
import { freezeFrame, disposeFrame } from '@nelyx/core/ui/frame';
import {
  createWindowsFrameScheduler,
  windowsMonotonicTimestamp,
  captureWindowsFrameTiming,
} from '../../sdk/dist/platforms/windows/frame-clock.js';
const timeout = 1_200_000;
test(
  'native prediction, timer fallback and late dispatch keep distinct work limits',
  { timeout },
  () => {
    const receipt = {
      nativeTick: 100,
      nativeDispatch: 102,
      nativeFrameStart: 100,
      nativeFrameTarget: 110,
      refreshInterval: 10,
      nativeUncertainty: 0.2,
      timingRevision: 1,
      timingSource: 'dwm-predicted',
    };
    const timing = captureWindowsFrameTiming(receipt, { offset: 1000, uncertainty: 0.1 });
    assert.equal(timing.tick, 1100);
    assert.equal(timing.frameStart, 1100);
    assert.equal(timing.observedDeadline, 1110);
    assert.equal(timing.refreshInterval, 10);
    assert.equal(timing.queueDelay, 2);
    assert(Math.abs(timing.clockUncertainty - 0.3) < 0.00001);
    const frame = freezeFrame(
      {
        owner: { id: 'clock', generation: 1 },
        sequence: 1,
        timing,
        metrics: {
          logicalWidth: 1,
          logicalHeight: 1,
          physicalWidth: 1,
          physicalHeight: 1,
          scale: 1,
          viewportGeneration: 1,
          rendererGeneration: 1,
          nativeContextGeneration: null,
          nativeSurfaceGeneration: null,
        },
      },
      [],
    );
    assert.deepEqual(
      frame.token.timing,
      timing,
      'Frame capture preserves the predicted clock domain',
    );
    disposeFrame(frame);
    for (const change of [
      { timingSource: 'timer-fallback' },
      { nativeDispatch: 110 },
      { nativeUncertainty: 3 },
    ])
      assert.equal(
        captureWindowsFrameTiming({ ...receipt, ...change }).observedDeadline,
        undefined,
      );
    for (const change of [
      { nativeFrameTarget: NaN },
      { refreshInterval: 16 },
      { timingRevision: 0 },
      { timingSource: 'displayed' },
      { nativeUncertainty: -1 },
    ])
      assert.throws(() => captureWindowsFrameTiming({ ...receipt, ...change }), /prediction/);
  },
);
test(
  'a native cadence revision recalibrates its JS epoch and rejects the old wire',
  { timeout },
  () => {
    const n = native();
    let offset = 10000,
      samples = 0;
    n.api.getMonotonicTime = () => {
      samples++;
      return performance.now() + offset;
    };
    const scheduler = createWindowsFrameScheduler(() => n.api);
    const deliver = (id, revision) => {
      const tick = performance.now() + offset;
      n.pending.get(id)(undefined, {
        nativeTick: tick,
        nativeDispatch: tick + 1,
        nativeFrameStart: tick,
        nativeFrameTarget: tick + 10,
        refreshInterval: 10,
        nativeUncertainty: 0.1,
        timingSource: 'dwm-predicted',
        timingRevision: revision,
      });
    };
    let first, second;
    scheduler.request((value) => {
      first = value;
    });
    deliver(1, 1);
    assert.equal(samples, 1);
    offset += 1000;
    scheduler.request((value) => {
      second = value;
    });
    deliver(2, 2);
    assert.equal(samples, 2);
    assert(Math.abs(second.tick - first.tick) < 50, 'Cadence changes resample the native domain');
    assert.throws(
      () => createWindowsFrameScheduler(() => ({ ...n.api, frameClockVersion: 1 })),
      /clock2/,
    );
  },
);
test(
  'surface close fences every callback before cancellation and reports all failed handles',
  { timeout },
  () => {
    let next = 0,
      frames = 0;
    const callbacks = new Map(),
      canceled = [],
      scheduler = {
        request(callback) {
          callbacks.set(++next, callback);
          return next;
        },
        cancel(id) {
          canceled.push(id);
          if (id === 2 || id === 4) throw Error('cancel-' + id);
        },
      };
    const clock = createSurfaceFrameClock(
      {
        pending: () => true,
        poll() {
          assert.fail('Closed polling ran');
        },
        onError() {
          assert.fail('Closed error delivery ran');
        },
      },
      scheduler,
    );
    clock.request(() => frames++);
    callbacks.get(1)();
    clock.request(() => frames++);
    clock.request(() => frames++);
    let failure;
    try {
      clock.dispose();
    } catch (error) {
      failure = error;
    }
    assert(failure instanceof AggregateError);
    assert.deepEqual(
      failure.errors.map((x) => x.message),
      ['cancel-2', 'cancel-4'],
    );
    assert.deepEqual(canceled, [2, 3, 4]);
    for (const callback of callbacks.values()) callback();
    assert.equal(frames, 1);
    assert.throws(() => clock.request(() => {}), /closed/);
    assert.doesNotThrow(() => clock.dispose());
  },
);
test(
  'a callback failure remains observable when retirement admission fails too',
  { timeout },
  () => {
    let callback;
    const clock = createSurfaceFrameClock(
      {
        pending() {
          throw undefined;
        },
        poll() {},
        onError() {},
      },
      {
        request(value) {
          callback = value;
          return 1;
        },
        cancel() {},
      },
    );
    clock.request(() => {
      throw 0;
    });
    let failure;
    try {
      callback();
    } catch (error) {
      failure = error;
    }
    assert(failure instanceof AggregateError);
    assert.deepEqual(failure.errors, [0, undefined]);
    clock.dispose();
  },
);
test(
  'native tick and JS dispatch retain their queue delay in one calibrated monotonic domain',
  { timeout },
  () => {
    const n = native();
    n.api.getMonotonicTime = () => performance.now() + 10000;
    const scheduler = createWindowsFrameScheduler(() => n.api);
    let observed;
    scheduler.request((timing) => (observed = timing));
    const tick = performance.now() + 10000 - 18;
    n.pending.get(1)(undefined, { nativeTick: tick, nativeDispatch: tick + 12 });
    assert.equal(observed.queueDelay, 12);
    assert.equal(observed.dispatch - observed.tick, 12);
    assert(observed.clockUncertainty >= 0);
    assert(Object.isFrozen(observed));
    assert(Math.abs(windowsMonotonicTimestamp(tick, () => n.api) - observed.tick) < 0.01);
    assert.equal(observed.deadline, undefined, 'An unobserved deadline must not be manufactured');
    assert.equal(
      observed.observedDeadline,
      undefined,
      'Current compositor receipts do not advertise an optional-work deadline',
    );
    let error;
    scheduler.request(
      () => assert.fail('Malformed native timing must not build'),
      (value) => (error = value),
    );
    n.pending.get(2)(undefined, { nativeTick: 7, nativeDispatch: 6 });
    assert.match(error.message, /clock receipt/);
  },
);
function native() {
  let next = 0;
  const pending = new Map(),
    canceled = [];
  const api = {
    frameClockVersion: 2,
    requestFrame(callback) {
      pending.set(++next, callback);
      return next;
    },
    cancelFrame(id) {
      canceled.push(id);
      pending.delete(id);
    },
  };
  return { api, pending, canceled };
}
test(
  'Windows requires its compositor protocol and rejects a replaced native clock owner',
  { timeout },
  () => {
    assert.throws(() => createWindowsFrameScheduler(() => ({})), /matching rebuilt native inputs/);
    const n = native();
    let current = n.api;
    const scheduler = createWindowsFrameScheduler(() => current),
      id = scheduler.request(() => {});
    assert.equal(n.pending.size, 1);
    current = { ...n.api };
    assert.throws(() => scheduler.request(() => {}), /owner changed/);
    assert.throws(() => scheduler.cancel(id), /owner changed/);
  },
);
test(
  'late compositor callbacks and failures cannot rebuild a disposed surface',
  { timeout },
  () => {
    const n = native(),
      errors = [];
    let frames = 0;
    const clock = createSurfaceFrameClock(
      { pending: () => false, poll() {}, onError: (error) => errors.push(error) },
      createWindowsFrameScheduler(() => n.api),
    );
    const canceled = clock.request(() => frames++),
      late = n.pending.get(1);
    canceled.dispose();
    late();
    assert.equal(frames, 0);
    clock.request(() => frames++);
    const retired = n.pending.get(2);
    clock.dispose();
    retired();
    retired('late error');
    assert.equal(frames, 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(n.canceled, [1, 2]);
  },
);
test(
  'a native frame failure reports to the owning surface and releases its request',
  { timeout },
  () => {
    const n = native(),
      errors = [];
    let frames = 0;
    const clock = createSurfaceFrameClock(
      { pending: () => false, poll() {}, onError: (error) => errors.push(error) },
      createWindowsFrameScheduler(() => n.api),
    );
    clock.request(() => frames++);
    n.pending.get(1)('compositor unavailable');
    assert.equal(frames, 0);
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /compositor unavailable/);
    clock.dispose();
    assert.deepEqual(n.canceled, []);
  },
);
test(
  'a rejected native admission leaves no invalid cancellation handle in surface cleanup',
  { timeout },
  () => {
    const n = native();
    n.api.requestFrame = () => {
      throw Error('native admission closed');
    };
    const clock = createSurfaceFrameClock(
      { pending: () => false, poll() {}, onError() {} },
      createWindowsFrameScheduler(() => n.api),
    );
    assert.throws(() => clock.request(() => {}), /native admission closed/);
    assert.doesNotThrow(() => clock.dispose());
    assert.deepEqual(n.canceled, []);
  },
);
test(
  'retirement polling shares the owned scheduler, stops on failure and cancels its pending callback',
  { timeout },
  () => {
    const n = native(),
      errors = [];
    let pending = true,
      polls = 0;
    const clock = createSurfaceFrameClock(
      {
        pending: () => pending,
        poll() {
          polls++;
        },
        onError: (error) => errors.push(error),
      },
      createWindowsFrameScheduler(() => n.api),
    );
    clock.request(() => {});
    n.pending.get(1)();
    assert(n.pending.has(2));
    n.pending.get(2)();
    assert.equal(polls, 1);
    assert(n.pending.has(3));
    n.pending.get(3)('retirement clock failed');
    assert.equal(errors.length, 1);
    assert.equal(polls, 1);
    clock.request(() => {});
    n.pending.get(4)();
    assert(!n.pending.has(5), 'A failed notification loop must not spin');
    pending = false;
    clock.dispose();
  },
);
