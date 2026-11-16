import assert from 'node:assert/strict';
import { motionMetrics, displayedMotion } from './windows-jank-metrics.ts';
const watchdog = setTimeout(() => {
  throw Error('Motion accounting exceeded 20 minutes');
}, 1_200_000);
try {
  const frame = (id, input, at, pixels, moving = true) => ({
    frame: id,
    input,
    at,
    end: at + 1,
    pixels,
    moving,
  });
  const surface = (id, at, owner = 1) => [id, owner, 1, 1, id, id, id, 1, 100, 100, at];
  const options = {
    events: [
      { id: 1, stamp: 100 },
      { id: 2, stamp: 200 },
    ],
    frames: [frame(1, 1, 110, 10), frame(2, 2, 210, 20, false), frame(3, 2, 500, 20, false)],
    surfaces: [...surface(1, 120), ...surface(2, 240), ...surface(2, 241), ...surface(3, 600)],
    startPixels: 0,
    endPixels: 20,
  };
  const result = motionMetrics(options);
  assert.equal(result.durationMs, 140, 'Final fence wait was omitted or quiet polling included');
  assert.equal(result.completedFrames, 2, 'Duplicate completions/idle frames inflated FPS');
  assert.equal(result.averageFps, 14.286);
  assert.equal(result.framesAtLeast100ms.count, 1);
  assert.equal(result.progressAtLeast100ms.totalMs, 120);
  assert.equal(result.progressAtLeast100ms.maxMs, 120);
  assert.equal(result.frameIntervals.p99, 120);
  assert.equal(result.displayedFps, 'notVerified');
  assert.throws(() => motionMetrics({ ...options, surfaces: surface(1, 120) }), /did not complete/);
  assert.throws(() => motionMetrics({ ...options, frames: [] }), /Incomplete/);
  assert.throws(() => motionMetrics({ ...options, endPixels: 99 }), /not observed/);
  const screen = {
    Started: 90,
    Ended: 650,
    Invalid: 0,
    MaximumIntervalMs: 5,
    MaximumCaptureMs: 2,
    Changes: [
      [95, 99],
      [130, 1],
      [250, 3],
    ],
  };
  const displayed = displayedMotion(result, screen);
  assert.equal(displayed.observedFrames, 2);
  assert.equal(
    displayed.durationMs,
    150,
    'Display window ended at the copy fence instead of the observed final pixels',
  );
  assert.equal(displayed.averageFpsLowerBound, 13.333);
  assert.equal(displayed.progressAtLeast100ms.maxMs, 120);
  assert.throws(() => displayedMotion(result, { ...screen, Invalid: 1 }), /integrity/);
  assert.throws(() => displayedMotion(result, { ...screen, Started: 101 }), /coverage/);
  assert.throws(() => displayedMotion(result, { ...screen, Changes: [[130, 1]] }), /not observed/);
  console.log(
    'JANK_METRICS PASS: unique frames, full active denominator, final fence, idle exclusion, missing evidence',
  );
} finally {
  clearTimeout(watchdog);
}
