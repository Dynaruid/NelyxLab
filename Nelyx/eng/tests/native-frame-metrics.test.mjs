// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  distribution,
  nativeScrollTargetState,
  analyseNativeInputWindow,
  analyseNativeFrameTrace,
  analyseNativeMotionIntervals,
  analyseNativeFrameTurns,
  analyseNativeFrameDeadlines,
  analyseNativeCatalogCoverage,
  readHermesGCStats,
  readHermesSamplingProfile,
} from './native-frame-metrics.js';
const timeout = 1_200_000,
  pack = (rows) => new Float64Array(rows.flat()).buffer;
const fixture = () => ({
  schema: 1,
  clock: 'qpc-ms',
  completion: 'surface-copy-fence-observed',
  displayed: 'unobserved',
  lostInputs: 0,
  lostSurfaces: 0,
  inputStride: 10,
  surfaceStride: 11,
  inputs: pack([
    [1, 1, 1, 4, 10, 11, 12, 0, 48, 1],
    [2, 2, 1, 4, 12, 13, 14, 0, -12, 1],
    [3, 0, 1, 4, 13, 14, 15, 0, 48, 0],
    [4, 3, 1, 0, 13.5, 14, 15, 0, 0, 1],
    [5, 4, 1, 4, 14, 15, 16, 0, -36, 1],
  ]),
  surfaces: pack([
    [1, 1, 2, 1, 10, 3, 1, 2, 974, 929, 20],
    [2, 1, 2, 1, 10, 3, 1, 2, 974, 929, 21],
    [3, 1, 2, 1, 11, 4, 2, 2, 974, 929, 30],
  ]),
});

test(
  'host deadline joins count late work and copies without turning missing or fallback observations into success',
  { timeout },
  () => {
    const timing = (observedDeadline) => ({
        tick: 10,
        dispatch: 11,
        queueDelay: 1,
        clockUncertainty: 0.1,
        timingSource: 'dwm-predicted',
        refreshInterval: 10,
        observedDeadline,
      }),
      frames = [
        { sequence: 10, end: 19, timing: timing(20) },
        { sequence: 11, end: 26, timing: timing(25) },
        { sequence: 12, end: 30, timing: timing(35) },
        {
          sequence: 13,
          end: 40,
          timing: { ...timing(45), observedDeadline: undefined, timingSource: 'timer-fallback' },
        },
      ],
      result = analyseNativeFrameDeadlines(fixture(), frames);
    assert.equal(result.eligible, 3);
    assert.equal(result.withoutPrediction, 1);
    assert.equal(result.missingCopy, 1);
    assert.equal(result.readyMisses, 1);
    assert.equal(result.surfaceMisses, 1);
    assert.equal(result.surfaceSlack.n, 2);
    assert.equal(result.surfaceSlack.max, 0, 'The first matching copy is joined once');
    assert.equal(result.displayed, 'unobserved');
    assert.equal(result.performanceAccepted, false);
    assert.throws(() => analyseNativeFrameDeadlines({ ...fixture(), lostSurfaces: 1 }, frames));
    assert.throws(() => analyseNativeFrameDeadlines(fixture(), [...frames, frames[0]]));
    assert.throws(() =>
      analyseNativeFrameDeadlines(fixture(), [{ sequence: 1, end: 3, timing: timing(10) }]),
    );
  },
);
test(
  'scroll completion follows measured extent clamps while rejecting short or invalid motion',
  { timeout },
  () => {
    const result = nativeScrollTargetState(
      [
        { offset: 600, minimum: 0, maximum: 600 },
        { offset: 500, minimum: 0, maximum: 600 },
        { offset: 0, minimum: 0, maximum: 600 },
      ],
      [1000, 1000, -10],
    );
    assert.deepEqual(
      result.map((value) => [value.effective, value.reached]),
      [
        [600, true],
        [600, false],
        [0, true],
      ],
    );
    assert.throws(
      () => nativeScrollTargetState([{ offset: NaN, minimum: 0, maximum: 600 }], [1000]),
      /extent/,
    );
    assert.throws(
      () => nativeScrollTargetState([{ offset: 0, minimum: 1, maximum: 0 }], [1000]),
      /extent/,
    );
  },
);

test(
  'surface cadence excludes stopped/recontact gaps and rejects missing samples',
  { timeout },
  () => {
    const trace = fixture();
    trace.surfaces = pack(
      [0, 16, 32, 1000, 1016, 1032].map((time, index) => [
        index + 1,
        1,
        2,
        1,
        index + 10,
        0,
        1,
        2,
        974,
        929,
        time,
      ]),
    );
    const windows = [
      { begin: 0, end: 32 },
      { begin: 1000, end: 1032 },
    ];
    const result = analyseNativeMotionIntervals(trace, windows);
    assert.equal(result.intervals.n, 4);
    assert.equal(result.intervals.max, 16);
    assert.equal(result.displayed, 'unobserved');
    assert.equal(result.performanceAccepted, false);
    assert.throws(
      () => analyseNativeMotionIntervals({ ...trace, lostSurfaces: 1 }, windows),
      /overflowed/,
    );
    assert.throws(
      () =>
        analyseNativeMotionIntervals(trace, [
          { begin: 0, end: 20 },
          { begin: 10, end: 30 },
        ]),
      /overlapping/,
    );
    new Float64Array(trace.surfaces)[11] = 3;
    assert.throws(() => analyseNativeMotionIntervals(trace, windows), /sequence/);
  },
);

test(
  'native measurement rejects unplanned keyboard, UIA actions and programmatic desktop input',
  { timeout },
  () => {
    const before = {
      foreground: true,
      focusChanges: 2,
      keyboardMessages: 3,
      semanticsActions: 4,
      lastInputTick: 50,
      cursorParked: true,
    };
    assert.equal(
      analyseNativeInputWindow(before, { ...before, lastInputTick: 60 }, { pacing: 'os' }).after
        .lastInputTick,
      60,
    );
    assert.equal(
      analyseNativeInputWindow(before, { ...before }, { pacing: 'programmatic' }).before
        .keyboardMessages,
      3,
    );
    for (const change of [
      { foreground: false },
      { focusChanges: 3 },
      { keyboardMessages: 4 },
      { semanticsActions: 5 },
      { keyboardMessages: undefined },
      { semanticsActions: NaN },
      { lastInputTick: undefined },
    ])
      assert.throws(() =>
        analyseNativeInputWindow(before, { ...before, ...change }, { pacing: 'os' }),
      );
    for (const change of [{ lastInputTick: 60 }, { cursorParked: false }])
      assert.throws(() =>
        analyseNativeInputWindow(before, { ...before, ...change }, { pacing: 'programmatic' }),
      );
    assert.throws(() => analyseNativeInputWindow(before, before, { pacing: 'unknown' }));
    assert.throws(() => analyseNativeInputWindow(null, before, { pacing: 'os' }));
  },
);
test(
  'catalog exposure requires its exact content frame on a surface and reports fast traversal misses',
  { timeout },
  () => {
    const frames = [
        { sequence: 10, ids: ['first'] },
        { sequence: 11, ids: ['second'] },
        { sequence: 12, ids: ['discarded'] },
      ],
      expectedIds = ['first', 'second', 'discarded'];
    assert.throws(
      () => analyseNativeCatalogCoverage(fixture(), frames, { expectedIds }),
      /did not reach.*discarded/,
    );
    const fast = analyseNativeCatalogCoverage(fixture(), frames, {
      expectedIds,
      requireAll: false,
    });
    assert.deepEqual(fast.builtSeenIds, expectedIds);
    assert.deepEqual(fast.seenIds, ['first', 'second']);
    assert.deepEqual(fast.skippedIds, ['discarded']);
    assert.equal(fast.matchingFrames, 2);
    assert.deepEqual(
      analyseNativeCatalogCoverage(fixture(), frames.slice(0, 2), {
        expectedIds: ['first', 'second'],
      }).seenIds,
      ['first', 'second'],
    );
    assert.throws(
      () =>
        analyseNativeCatalogCoverage(fixture(), frames.slice(0, 2), {
          expectedIds: ['first', 'second'],
          end: 25,
        }),
      /second/,
    );
    assert.throws(() =>
      analyseNativeCatalogCoverage({ ...fixture(), lostSurfaces: 1 }, frames, { expectedIds }),
    );
    assert.throws(() =>
      analyseNativeCatalogCoverage(fixture(), frames, { expectedIds: ['first', 'first'] }),
    );
    assert.throws(() =>
      analyseNativeCatalogCoverage(fixture(), [frames[0], frames[0]], { expectedIds }),
    );
  },
);
test(
  'pinned Hermes GC output keeps allocation counters and cumulative pauses distinct',
  { timeout },
  () => {
    const data = {
      type: 'hermes',
      version: 0,
      general: {
        numCollections: 3,
        totalAllocatedBytes: 8192,
        totalGCTime: 0.01,
        totalGCCPUTime: 0.02,
        maxGCPause: 0.003,
        maxGCCPUPause: 0.004,
      },
      specific: { collector: 'Hades' },
    };
    const result = readHermesGCStats('GC stats:\n' + JSON.stringify(data) + '\n');
    assert.equal(result.totalGCTimeMs, 10);
    assert.equal(result.maxGCPauseMs, 3);
    assert.equal(result.totalAllocatedBytes, 8192);
    assert.match(result.scope, /cumulative/);
    assert.throws(() => readHermesGCStats(''));
    assert.throws(() => readHermesGCStats(JSON.stringify(data)));
    assert.throws(() => readHermesGCStats('GC stats:\n' + JSON.stringify({ ...data, version: 1 })));
  },
);
test(
  'native timing percentiles match the existing floor-rank method without hiding invalid or empty observations',
  { timeout },
  () => {
    const values = [5, 1, 3, 4, 2];
    assert.deepEqual(distribution(values), { n: 5, sum: 15, p50: 3, p95: 5, p99: 5, max: 5 });
    assert.deepEqual(values, [5, 1, 3, 4, 2]);
    assert.equal(distribution([]).p95, null);
    assert.throws(() => distribution([1, NaN]), /Invalid/);
    assert.throws(() => distribution([-1]), /Invalid/);
  },
);
test(
  'Hermes sampling preserves self versus inclusive observations and refuses missing or cyclic stacks',
  { timeout },
  () => {
    const trace = {
        samples: [
          { sf: 3, weight: '2' },
          { sf: 2, weight: '1' },
        ],
        stackFrames: {
          1: { name: '[root]', category: 'root' },
          2: { name: 'caller', category: 'JavaScript', parent: 1 },
          3: { name: 'callee', category: 'JavaScript', parent: 2 },
        },
      },
      result = readHermesSamplingProfile(JSON.stringify(trace));
    assert.equal(result.observations, 3);
    assert.equal(result.self[0].name, 'callee');
    assert.equal(result.inclusive[0].name, 'caller');
    assert.equal(result.inclusive[0].inclusive, 3);
    assert.equal(result.categories.JavaScript, 3);
    for (const bad of [
      { ...trace, samples: [{ sf: 99, weight: 1 }] },
      { ...trace, samples: [{ sf: 2, weight: 'NaN' }] },
      {
        ...trace,
        stackFrames: { ...trace.stackFrames, 2: { ...trace.stackFrames[2], parent: 3 } },
      },
    ])
      assert.throws(() => readHermesSamplingProfile(JSON.stringify(bad)));
  },
);
test(
  'frame turn cost includes its checkpoint, joins every built callback and excludes idle polls',
  { timeout },
  () => {
    const trace = {
        schema: 1,
        clock: 'qpc-ms',
        turnStride: 8,
        lostTurns: 0,
        turns: pack([
          [1, 1, 0, 10, 11, 15, 20, 3],
          [2, 1, 0, 21, 22, 23, 24, 1],
        ]),
      },
      frames = [
        { begin: 12, end: 13 },
        { begin: 13, end: 14 },
      ],
      result = analyseNativeFrameTurns(trace, frames);
    assert.equal(result.wall.n, 1);
    assert.equal(result.wall.sum, 9);
    assert.equal(result.checkpoint.sum, 5);
    assert.equal(result.builtCallbacks, 2);
    assert.equal(result.idleTurns, 1);
    assert.throws(() => analyseNativeFrameTurns(trace, [{ begin: 12, end: 16 }]));
    assert.throws(() => analyseNativeFrameTurns({ ...trace, lostTurns: 1 }, frames));
    assert.throws(() => analyseNativeFrameTurns(trace, frames, { end: 19 }));
  },
);
test(
  'matching surface latency uses the original oldest input and keeps signed, absolute and rejected wheel evidence',
  { timeout },
  () => {
    const result = analyseNativeFrameTrace(fixture(), { changedCoreSequences: [1, 2, 4] });
    assert.equal(result.displayed, 'unobserved');
    assert.equal(result.performanceAccepted, false);
    assert.equal(result.receiptIntegrity, false);
    assert.equal(result.input.received, 5);
    assert.equal(result.input.rejected, 1);
    assert.equal(result.input.receivedAbsoluteWheelY, 144);
    assert.equal(result.input.acceptedAbsoluteWheelY, 96);
    assert.equal(result.input.acceptedWheelY, 0);
    assert.equal(result.surface.uniqueContentFrames, 2);
    assert.equal(result.inputToSurface.oldest.sum, 26);
    assert.equal(result.inputToSurface.latest.sum, 24);
    assert.equal(result.inputToSurface.oldest.n, 2);
    assert.equal(result.inputToSurface.pending, 0);
  },
);
test(
  'lost, reordered, clock-inconsistent, foreign or untracked receipts cannot become a successful timing sample',
  { timeout },
  () => {
    for (const change of [
      { lostInputs: 1 },
      { lostSurfaces: 1 },
      { inputs: new ArrayBuffer(8) },
      { displayed: 'true' },
    ])
      assert.throws(() => analyseNativeFrameTrace({ ...fixture(), ...change }));
    for (const [which, index, value] of [
      ['inputs', 10, 1],
      ['inputs', 5, 9],
      ['surfaces', 13, 99],
      ['surfaces', 14, 2],
      ['surfaces', 8, 0],
      ['surfaces', 5, 99],
    ]) {
      const trace = fixture(),
        words = new Float64Array(trace[which]);
      words[index] = value;
      assert.throws(() => analyseNativeFrameTrace(trace));
    }
    assert.throws(
      () => analyseNativeFrameTrace(fixture(), { changedCoreSequences: [99] }),
      /no accepted/,
    );
    const trace = fixture();
    trace.surfaces = pack([[1, 1, 2, 1, 10, 2, 1, 2, 974, 929, 20]]);
    const result = analyseNativeFrameTrace(trace);
    assert.equal(result.inputToSurface.pending, 1);
    assert.equal(result.receiptIntegrity, false);
  },
);
