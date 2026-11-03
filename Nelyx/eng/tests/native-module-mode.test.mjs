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
import { withGalleryRangeFixture } from './gallery-range-fixture.mjs';
const timeout = 1_200_000;
const engineWork = {
  selected: ['frame', 'layout', 'text'],
  flexPlans: 2,
  flexChildren: 6,
  flexPlacements: 2,
  textTransactions: 3,
  textOperations: 9,
  textBytes: 30,
  frameSeals: 4,
  frameAdmissions: 4,
  frameBytes: 400,
  tsFallbacks: 0,
  fallbackReasons: {},
  closed: true,
};
const engineTotals = [2, 6, 2, 3, 9, 30, 4, 4, 4, 400];
const extraObservations = (overrides) => [
  ...(overrides.engineNative === false
    ? []
    : [
        'NELYX_NATIVE_ENGINE_USAGE ' +
          JSON.stringify({
            schema: 1,
            mode: 'all',
            ownerGeneration: 7,
            beganQpcMs: 1000,
            endedQpcMs: 2000,
            timing: 'counters-only',
            overflow: false,
            closed: true,
            binCount: 0,
            totals: overrides.engineTotals ?? engineTotals,
            memory: [0, 0, 2, 4096],
          }),
      ]),
  ...(overrides.backing === false
    ? []
    : [
        'NELYX_INPUT_GEOMETRY_STATUS ' +
          JSON.stringify({
            schema: 1,
            kind: 'backing-selection',
            mode: 'backing',
            ownerGeneration: 7,
          }),
        'NELYX_INPUT_GEOMETRY_STATUS ' +
          JSON.stringify({
            schema: 1,
            kind: 'backing-sdk',
            mode: 'backing',
            ownerGeneration: 7,
            created: 1,
            reused: overrides.backingReused ?? 2,
            invalid: 0,
            tsFallbacks: 0,
            closed: true,
          }),
        'NELYX_WIN32_BACKING_USAGE ' +
          JSON.stringify({
            schema: 1,
            mode: 'backing',
            ownerGeneration: 7,
            beganQpcMs: 1000,
            endedQpcMs: 2000,
            created: 1,
            reused: overrides.backingReused ?? 2,
            destroyed: 1,
            initialObjects: 0,
            initialBytes: 0,
            liveObjects: 0,
            liveBytes: 0,
            peakObjects: 1,
            peakBytes: 4096,
            overflow: false,
            closed: true,
            binCount: 1,
          }),
        'NELYX_WIN32_BACKING_BINS ' +
          JSON.stringify({ schema: 1, index: 0, rows: [[1, 1, overrides.backingReused ?? 2, 1]] }),
      ]),
];
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
    engine: engineWork,
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
    ...extraObservations(overrides),
  ];

test(
  'interactive mode rejects stale/mismatched native evidence and distinguishes work from no demand',
  { timeout },
  () => {
    assert.equal(nativeModuleOption([]), 'all');
    assert.equal(nativeModuleOption(['--module=retained']), 'retained');
    assert.equal(nativeModuleOption(['--module=backing', '--full-range']), 'backing');
    for (const mode of ['layout', 'text', 'frame'])
      assert.equal(nativeModuleOption(['--module=' + mode]), mode);
    assert.throws(() => nativeModuleOption(['--module=typo']), /Unknown/);
    assert.throws(() => nativeModuleOption(['--trials=3']), /Use/);
    const result = verifyNativeModuleMode(observations(), { mode: 'all' });
    assert.equal(result.inputGeometry.editorQueries, 24);
    assert.equal(result.fallback.semantics, 1);
    assert(Object.values(result.modules).every((x) => x === 'observed'));
    assert.deepEqual(
      Object.keys(result.modules).sort(),
      [
        'inputGeometry',
        'path',
        'paint',
        'clip',
        'composition',
        'semantics',
        'layout',
        'text',
        'frame',
        'backing',
      ].sort(),
    );
    assert.throws(
      () => verifyNativeModuleMode(observations({ engineNative: false }), { mode: 'all' }),
      /engine audit/,
    );
    assert.throws(
      () => verifyNativeModuleMode(observations({ backing: false }), { mode: 'all' }),
      /backing audit/,
    );
    assert.throws(
      () =>
        verifyNativeModuleMode(
          observations({ sdk: { ...sdk, engine: { ...engineWork, textTransactions: 0 } } }),
          { mode: 'all' },
        ),
      /SDK\/native counts disagree/,
    );
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
        engine: {
          ...engineWork,
          ...Object.fromEntries(
            Object.keys(engineWork)
              .filter((name) => typeof engineWork[name] === 'number')
              .map((name) => [name, 0]),
          ),
        },
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
      engineTotals: Array(10).fill(0),
      backingReused: 0,
    });
    assert(
      Object.values(verifyNativeModuleMode(empty, { mode: 'all' }).modules).every(
        (x) => x === 'notObserved',
      ),
    );
  },
);

test(
  'new manual candidates select the matching bounded fixture and restore App after failure',
  { timeout },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      runner = fs.mkdtempSync(path.join(parent, 'nelyx-engine-manual-')),
      app = path.join(runner, 'App.tsx'),
      original = fs.readFileSync(
        path.resolve(
          import.meta.dirname,
          '../../../sample/nelyx-testbed-app-2/windows/runner/App.tsx',
        ),
      );
    try {
      fs.writeFileSync(app, original);
      for (const mode of ['all', 'layout', 'text', 'frame']) {
        await assert.rejects(
          () =>
            withGalleryRangeFixture(
              runner,
              async () => {
                const source = fs.readFileSync(app, 'utf8');
                assert(source.includes('nativeModuleMode: ' + JSON.stringify(mode)));
                assert(source.includes('manual: true, expectedMode: ' + JSON.stringify(mode)));
                assert(source.includes('installGalleryRange(application, galleryRange'));
                if (mode === 'all') {
                  assert(source.includes('backingAudit: true'));
                  assert(source.includes('nativeInputGeometry="retained"'));
                }
                throw Error('intentional candidate failure');
              },
              { manualMode: mode },
            ),
          /intentional candidate failure/,
        );
        assert(fs.readFileSync(app).equals(original));
        assert.deepEqual(fs.readdirSync(runner), ['App.tsx']);
      }
    } finally {
      assert.equal(path.dirname(fs.realpathSync(runner)), parent);
      assert(!fs.lstatSync(runner).isSymbolicLink());
      fs.rmSync(runner, { recursive: true, force: true });
    }
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
