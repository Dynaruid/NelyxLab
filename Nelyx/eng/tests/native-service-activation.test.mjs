// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyGeometryActivation,
  geometryActivationCollector,
} from './native-service-activation.js';
const timeout = 1_200_000,
  native = {
    schema: 1,
    session: 1,
    ownerGeneration: 1,
    prepares: 100,
    commits: 100,
    editorQueries: 1200,
    closed: true,
    retainedBytes: 0,
  },
  report = {
    schema: 1,
    kind: 'execution',
    mode: 'retained',
    ownerGeneration: 1,
    sessionsCreated: 1,
    committedFrames: 100,
    fallbackFrames: 1,
    fallbackReasons: { 'cold-provider': 1 },
    closed: true,
  },
  request = {
    schema: 1,
    kind: 'request',
    ownerGeneration: 1,
    inputGeometry: 'retained',
    sceneComposition: false,
    semanticsGeometry: false,
    sceneBatch: 'none',
  },
  requestedLine = (value) => 'NELYX_INPUT_GEOMETRY_STATUS ' + JSON.stringify(value),
  lines = (n = native, r = report) => [
    requestedLine(request),
    ...(n ? ['NELYX_RETAINED_GEOMETRY_NATIVE ' + JSON.stringify(n)] : []),
    'NATIVE_LOG 1 NELYX_INPUT_GEOMETRY_STATUS ' + JSON.stringify(r),
  ];
test(
  'activation evidence survives chunk boundaries and bounded diagnostic tail eviction',
  { timeout },
  () => {
    const collector = geometryActivationCollector(),
      text = lines().join('\n') + '\n';
    collector.observe(text.slice(0, 17), 'stdout');
    collector.observe('diagnostic stderr\n', 'stderr');
    collector.observe(text.slice(17), 'stdout');
    collector.observe('ordinary trace\n'.repeat(6000), 'stdout');
    assert.equal(
      verifyGeometryActivation(collector.finish(), { mode: 'retained', requireEditors: true })
        .nativeCommits,
      100,
    );
    const overflowing = geometryActivationCollector();
    overflowing.observe((requestedLine(request) + '\n').repeat(129));
    assert.throws(() => overflowing.finish(), /overflowed/);
  },
);
test(
  'requested C++ benchmarks reject capability-only, all-fallback, missing, mismatched and unretired execution',
  { timeout },
  () => {
    const options = { mode: 'retained', requireEditors: true };
    assert.equal(verifyGeometryActivation(lines(), options).nativeCommits, 100);
    assert.throws(() => verifyGeometryActivation([], options), /no unique/);
    assert.throws(
      () => verifyGeometryActivation([requestedLine(request)], options),
      /execution\/fallback/,
    );
    assert.throws(
      () =>
        verifyGeometryActivation(
          lines(null, {
            ...report,
            sessionsCreated: 0,
            committedFrames: 0,
            fallbackFrames: 100,
            fallbackReasons: { 'render-hook:childTransform': 100 },
          }),
          options,
        ),
      /did not execute/,
    );
    assert.throws(
      () => verifyGeometryActivation(lines({ ...native, editorQueries: 0 }), options),
      /real editor work/,
    );
    assert.throws(
      () => verifyGeometryActivation(lines({ ...native, commits: 99 }), options),
      /disagree/,
    );
    assert.throws(
      () => verifyGeometryActivation(lines({ ...native, retainedBytes: 64 }), options),
      /retirement/,
    );
    assert.throws(
      () =>
        verifyGeometryActivation(
          lines(native, {
            ...report,
            fallbackFrames: 100,
            fallbackReasons: { 'guarded-input': 100 },
          }),
          options,
        ),
      /sufficient/,
    );
    assert.throws(
      () => verifyGeometryActivation(lines(native, { ...report, fallbackReasons: {} }), options),
      /Malformed/,
    );
    assert.throws(() => verifyGeometryActivation(lines(), { mode: 'ts' }), /unexpectedly enabled/);
    assert.throws(() => verifyGeometryActivation([], { mode: 'ts' }), /no unique/);
    assert.equal(
      verifyGeometryActivation([requestedLine({ ...request, inputGeometry: 'ts' })], { mode: 'ts' })
        .executed,
      false,
    );
    assert.throws(
      () =>
        verifyGeometryActivation([requestedLine({ ...request, inputGeometry: 'snapshot' })], {
          mode: 'ts',
        }),
      /unexpectedly enabled/,
    );
    assert.throws(
      () =>
        verifyGeometryActivation(
          [requestedLine({ ...request, inputGeometry: 'ts', sceneComposition: true })],
          { mode: 'ts' },
        ),
      /unexpectedly enabled/,
    );
    assert.throws(
      () =>
        verifyGeometryActivation(
          [requestedLine({ ...request, inputGeometry: 'ts', unknownCandidate: true })],
          { mode: 'ts' },
        ),
      /unexpectedly enabled/,
    );
    assert.equal(
      verifyGeometryActivation(
        lines(null, {
          ...report,
          sessionsCreated: 0,
          committedFrames: 0,
          fallbackFrames: 0,
          fallbackReasons: {},
        }),
        { mode: 'retained' },
      ).coverage,
      null,
    );
  },
);
