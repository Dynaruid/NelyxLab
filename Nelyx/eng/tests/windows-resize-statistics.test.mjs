// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resizeStatistics,
  resizeDistribution,
  resizeCpuStatistics,
} from './windows-resize-statistics.ts';
const timeout = 1_200_000;
test(
  'resize counts consecutive rect changes including A-B-A and excludes repeated notifications',
  { timeout },
  () => {
    const row = (t, w, id = 0) => [t, 0, 0, w, 100, id],
      rows = [row(10, 100), row(20, 100), row(30, 120), row(40, 100)];
    const result = resizeStatistics(
      { began: 0, ended: 100, injected: [], processed: [], geometry: rows, captureEnabled: false },
      [],
    );
    assert.equal(result.geometry.changes, 3);
    assert.equal(result.geometry.fps, 30);
    assert.equal(result.geometry.intervalMs.max, 60);
    assert.equal(result.displayed, null);
  },
);
test(
  'input latency requires both native input identity and matching proposed/actual rect',
  { timeout },
  () => {
    const row = (t, w, id) => [t, 0, 0, w, 100, id];
    const result = resizeStatistics(
      {
        began: 0,
        ended: 100,
        injected: [row(5, 100, 1), row(25, 120, 2)],
        processed: [row(10, 100, 1), row(30, 120, 1)],
        geometry: [row(20, 100, 0), row(40, 120, 0)],
        captureEnabled: false,
      },
      [],
    );
    assert.deepEqual(result.inputToGeometryMs, { n: 1, p50: 15, p95: 15, max: 15 });
  },
);
test(
  'vertical resize and movement count while the resting seed and duplicate rects do not',
  { timeout },
  () => {
    const rows = [
      [0, 0, 0, 100, 100, 0],
      [20, 0, 0, 100, 110, 0],
      [30, 0, 0, 100, 110, 0],
      [50, 0, -5, 100, 110, 0],
      [80, 0, 0, 100, 100, 0],
    ];
    const result = resizeStatistics(
      {
        began: 0,
        ended: 100,
        injected: [],
        processed: [],
        geometry: rows,
        displayed: rows,
        captureEnabled: true,
      },
      [],
    );
    assert.equal(result.geometry.changes, 3);
    assert.equal(result.geometry.fps, 30);
    assert.equal(result.geometry.intervalMs.max, 30);
    assert.deepEqual(result.displayed, result.geometry);
  },
);
test(
  'native timing pairs do not combine different views or transaction generations',
  { timeout },
  () => {
    const e = (stage, surfaceGeneration, view, nativeTimestamp) => ({
      stage,
      surfaceGeneration,
      view,
      nativeTimestamp,
    });
    const result = resizeStatistics(
      { began: 0, ended: 100, injected: [], processed: [], geometry: [] },
      [e(14, 1, 0, 10), e(15, 2, 0, 11), e(15, 1, 3, 12), e(15, 1, 0, 15)],
    );
    assert.deepEqual(result.stagesMs.arrange, { n: 1, p50: 5, p95: 5, max: 5 });
    assert.deepEqual(resizeDistribution([]), { n: 0, p50: null, p95: null, max: null });
  },
);

test(
  'native-clock CPU spans connect ingress and scheduling to the exact submitted frame without summing nested work',
  { timeout },
  () => {
    const event = (stage, nativeTimestamp, extra = {}) => ({
      stage,
      nativeTimestamp,
      view: 8,
      surfaceGeneration: 4,
      viewportGeneration: 11,
      ownerGeneration: 3,
      contextGeneration: 7,
      frameSequence: 9,
      ...extra,
    });
    const metrics = (stage, time) => event(stage, time, { frameSequence: 0 });
    const cpu = resizeCpuStatistics(
      [
        event(6, 10),
        event(0, 41, { viewportGeneration: 12 }),
        event(0, 41, { ownerGeneration: 4 }),
        event(0, 41, { contextGeneration: 8 }),
        event(0, 42),
        event(12, 50),
        event(0, 161, { frameSequence: 10 }),
      ],
      [
        metrics(20, 12),
        metrics(22, 13),
        metrics(21, 14),
        event(25, 17),
        event(27, 18),
        event(27, 19),
        event(28, 20),
        event(28, 21),
        event(29, 22),
        event(30, 24),
        event(35, 35),
        event(36, 37),
        event(26, 40),
        event(25, 60, { frameSequence: 10 }),
        event(26, 160, { frameSequence: 10 }),
      ],
    );
    assert.deepEqual(cpu.requestToCoreMetrics, { n: 1, p50: 2, p95: 2, max: 2 });
    assert.equal(cpu.metricsToBuild.p95, 5);
    assert.equal(cpu.frameRequestToBuild.p95, 4);
    assert.equal(cpu.metricsToCopyRetired.p95, 38);
    assert.equal(cpu.buildEndToNativeSubmit.p95, 2);
    assert.equal(cpu.build.p95, 100);
    assert.deepEqual(cpu.layout, { n: 2, p50: 1, p95: 3, max: 3 });
    assert.equal(cpu.recordPaint.p95, 2);
    assert.equal(cpu.capture.p95, 2);
    assert.equal(cpu.invalidEvents, 0);
    assert.equal(cpu.resizeFrames.n, 1);
    assert.equal(cpu.resizeFrames.build.p95, 23);
    assert.equal(cpu.resizeFrames.buildEndToNativeSubmit.p95, 2);
  },
);

test(
  'CPU timeline excludes another View, A-B-A epochs, unmatched frames and invalid native samples',
  { timeout },
  () => {
    const event = (stage, nativeTimestamp, extra = {}) => ({
      stage,
      nativeTimestamp,
      view: 8,
      surfaceGeneration: 4,
      viewportGeneration: 11,
      ownerGeneration: 3,
      contextGeneration: 7,
      frameSequence: 9,
      ...extra,
    });
    const result = resizeCpuStatistics(
      [
        event(6, 1, { view: 9 }),
        event(6, 2, { surfaceGeneration: 3 }),
        event(0, 20, { frameSequence: 10 }),
      ],
      [
        event(20, 5, { frameSequence: 0 }),
        event(23, 6, { frameSequence: 0 }),
        event(25, 10),
        event(26, 15, { frameSequence: 10 }),
        event(29, 30),
        event(30, 29),
        event(25, NaN),
      ],
    );
    assert.equal(result.requestToCoreMetrics.n, 0);
    assert.equal(result.buildEndToNativeSubmit.n, 0);
    assert.equal(result.build.n, 0);
    assert.equal(result.recordPaint.n, 0);
    assert.equal(result.invalidEvents, 1);
    assert.equal(resizeStatistics({ began: 0, ended: 10 }, []).cpu, null);
    assert.equal(result.coverage.metricsWithPendingFrame, 1);
    assert.equal(result.coverage.newFrameRequests, 0);
    assert.equal(result.frameRequestToBuild.n, 0);
    assert.equal(result.metricsToBuild.p95, 5);
  },
);
