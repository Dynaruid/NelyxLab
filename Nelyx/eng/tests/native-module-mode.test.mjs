// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nativeModuleOption } from '../run-native-modules.mjs';
import {
  verifyNativeModuleMode,
  verifyNativeServiceExperiment,
} from './native-service-experiment.js';
import { verifyGeometryActivation } from './native-service-activation.js';
import { withNativeServiceExperimentFixture } from './native-service-experiment-fixture.mjs';
const timeout = 1_200_000;
const request = {
    schema: 1,
    kind: 'request',
    ownerGeneration: 7,
    inputGeometry: 'retained',
    sceneComposition: false,
    semanticsGeometry: false,
    sceneBatch: 'none',
  },
  sdk = {
    schema: 1,
    kind: 'manual',
    ownerGeneration: 7,
    mode: 'all',
    snapshotCalls: 0,
    snapshotEditors: 0,
    inputFallbacks: 0,
    inputFallbackReasons: {},
    composePrepares: 2,
    composeCommits: 2,
    composeFallbacks: 0,
    semanticsCalls: 5,
    semanticsQueries: 12,
    semanticsFallbacks: 1,
    closed: true,
  },
  header = {
    schema: 1,
    ownerGeneration: 7,
    mode: 'all',
    beganQpcMs: 1000,
    endedQpcMs: 2000,
    timing: 'counters-only',
    overflow: false,
    binCount: 0,
    totals: [0, 0, 2, 2, 18, 5, 12, 40, 8, 9, 10],
    sessions: [
      [0, 0, 0, 0],
      [1, 1, 0, 0],
      [1, 1, 0, 0],
    ],
  },
  execution = {
    schema: 1,
    kind: 'execution',
    mode: 'retained',
    ownerGeneration: 7,
    sessionsCreated: 1,
    committedFrames: 2,
    fallbackFrames: 1,
    fallbackReasons: { 'cold-provider': 1 },
    closed: true,
  },
  retained = {
    schema: 1,
    session: 3,
    ownerGeneration: 7,
    prepares: 2,
    commits: 2,
    editorQueries: 24,
    retainedBytes: 0,
    closed: true,
  },
  selection = { schema: 1, kind: 'manual-selection', mode: 'all', ownerGeneration: 7 },
  line = (name, value) => name + ' ' + JSON.stringify(value),
  observations = (overrides = {}) => [
    line('NELYX_INPUT_GEOMETRY_STATUS', overrides.request ?? request),
    line('NELYX_INPUT_GEOMETRY_STATUS', selection),
    line('NELYX_INPUT_GEOMETRY_STATUS', overrides.sdk ?? sdk),
    line('NELYX_NATIVE_SERVICE_USAGE', overrides.header ?? header),
    line('NELYX_INPUT_GEOMETRY_STATUS', overrides.execution ?? execution),
    ...(overrides.retained === false
      ? []
      : [line('NELYX_RETAINED_GEOMETRY_NATIVE', overrides.retained ?? retained)]),
  ];

test(
  'interactive mode rejects stale/mismatched native evidence and distinguishes work from no demand',
  { timeout },
  () => {
    assert.equal(nativeModuleOption([]), 'all');
    assert.equal(nativeModuleOption(['--module=retained']), 'retained');
    assert.throws(() => nativeModuleOption(['--module=typo']), /Unknown/);
    assert.throws(() => nativeModuleOption(['--trials=3']), /Use/);
    const result = verifyNativeModuleMode(observations(), { mode: 'all' });
    assert.equal(result.inputGeometry.editorQueries, 24);
    assert.equal(result.fallback.semantics, 1);
    assert(Object.values(result.modules).every((x) => x === 'observed'));
    assert.throws(
      () =>
        verifyNativeModuleMode(observations({ sdk: { ...sdk, composePrepares: 1 } }), {
          mode: 'all',
        }),
      /disagree/,
    );
    assert.throws(
      () =>
        verifyNativeModuleMode(observations({ retained: { ...retained, retainedBytes: 8 } }), {
          mode: 'all',
        }),
      /retirement/,
    );
    assert.throws(
      () =>
        verifyNativeModuleMode(observations({ header: { ...header, timing: 'qpc-buckets' } }), {
          mode: 'all',
        }),
      /Malformed/,
    );
    assert.throws(
      () =>
        verifyNativeModuleMode(observations({ request: { ...request, sceneComposition: true } }), {
          mode: 'all',
        }),
      /unexpectedly/,
    );
    assert.throws(() => verifyNativeModuleMode(observations(), { mode: 'snapshot' }), /Missing/);
    assert.throws(() => verifyNativeServiceExperiment(observations(), { mode: 'all' }), /Invalid/);
    assert.throws(
      () => verifyGeometryActivation(observations(), { mode: 'retained' }),
      /dedicated/,
    );
    const empty = observations({
      sdk: {
        ...sdk,
        composePrepares: 0,
        composeCommits: 0,
        semanticsCalls: 0,
        semanticsQueries: 0,
        semanticsFallbacks: 0,
      },
      header: { ...header, totals: Array(11).fill(0) },
      execution: {
        ...execution,
        sessionsCreated: 0,
        committedFrames: 0,
        fallbackFrames: 0,
        fallbackReasons: {},
      },
      retained: false,
    });
    assert(
      Object.values(verifyNativeModuleMode(empty, { mode: 'all' }).modules).every(
        (x) => x === 'notObserved',
      ),
    );
  },
);

test(
  'interactive build supplies retained geometry and a mode label, and restores App after build failure',
  { timeout },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      runner = fs.mkdtempSync(path.join(parent, 'nelyx-manual-mode-')),
      app = path.join(runner, 'App.tsx'),
      original = fs.readFileSync(
        path.resolve(
          import.meta.dirname,
          '../../../sample/nelyx-testbed-app-2/windows/runner/App.tsx',
        ),
      );
    try {
      fs.writeFileSync(app, original);
      await assert.rejects(
        () =>
          withNativeServiceExperimentFixture(
            runner,
            async () => {
              const source = fs.readFileSync(app, 'utf8');
              assert(source.includes('nativeInputGeometry="retained"'));
              assert(source.includes('nativeModuleMode: "all"'));
              assert(source.includes('manual: true, expectedMode: "all"'));
              throw Error('intentional build failure');
            },
            { manualMode: 'all' },
          ),
        /intentional/,
      );
      assert(fs.readFileSync(app).equals(original));
      assert.deepEqual(fs.readdirSync(runner), ['App.tsx']);
    } finally {
      assert.equal(path.dirname(fs.realpathSync(runner)), parent);
      fs.rmSync(runner, { recursive: true, force: true });
    }
  },
);
