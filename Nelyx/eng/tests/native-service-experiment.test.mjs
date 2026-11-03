// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { execute } from '../../sdk/tooling/cli/src/commands.mjs';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {
  verifyNativeServiceExperiment,
  verifyNativeModuleMode,
} from './native-service-experiment.js';
import {
  verifyGeometryActivation,
  geometryActivationCollector,
} from './native-service-activation.js';
const timeout = 1_200_000;
const request = {
    schema: 1,
    kind: 'request',
    ownerGeneration: 7,
    inputGeometry: 'ts',
    sceneComposition: false,
    semanticsGeometry: false,
    sceneBatch: 'none',
  },
  sdk = {
    schema: 1,
    kind: 'experiment',
    mode: 'snapshot',
    ownerGeneration: 7,
    snapshotCalls: 1,
    snapshotEditors: 12,
    inputFallbacks: 1,
    inputFallbackReasons: { cold: 1 },
    composePrepares: 0,
    composeCommits: 0,
    composeFallbacks: 0,
    semanticsCalls: 0,
    semanticsQueries: 0,
    semanticsFallbacks: 0,
    closed: true,
  },
  totals = [1, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  native = {
    schema: 1,
    mode: 'snapshot',
    ownerGeneration: 7,
    beganQpcMs: 100000,
    endedQpcMs: 111000,
    overflow: false,
    binCount: 1,
    totals,
    sessions: [
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  prefix = (p, value) => p + ' ' + JSON.stringify(value),
  evidence = (header = native, report = sdk, second = 105) => [
    prefix('NELYX_INPUT_GEOMETRY_STATUS', request),
    prefix('NELYX_INPUT_GEOMETRY_STATUS', report),
    prefix('NELYX_NATIVE_SERVICE_USAGE', header),
    prefix('NELYX_NATIVE_SERVICE_BINS', {
      schema: 1,
      index: 0,
      rows: [[second, ...header.totals]],
    }),
  ];
test(
  'native experiment rejects startup-only work, wrong mode, missing buckets, unretired state and SDK disagreement',
  { timeout },
  () => {
    const options = { mode: 'snapshot', checks: [{ nativeBeginMs: 104500, nativeEndMs: 110500 }] };
    assert.equal(verifyNativeServiceExperiment(evidence(), options).timed[0].nativeWork, true);
    assert.throws(
      () => verifyNativeServiceExperiment(evidence(native, sdk, 100), options),
      /during timed input/,
    );
    assert.throws(
      () => verifyNativeServiceExperiment(evidence(native, sdk, 104), options),
      /during timed input/,
    );
    assert.equal(
      verifyNativeServiceExperiment(evidence(native, sdk, 100), {
        ...options,
        requireTimedWork: false,
      }).nativeDuringEveryLeg,
      false,
    );
    assert.equal(
      verifyNativeServiceExperiment(evidence(native, sdk, 100), {
        mode: 'snapshot',
        checks: [{ ...options.checks[0], scene: 'gallery' }],
      }).nativeDuringEveryLeg,
      null,
    );
    const noWork = evidence(
      { ...native, totals: Array(11).fill(0) },
      {
        ...sdk,
        snapshotCalls: 0,
        snapshotEditors: 0,
      },
    );
    assert.throws(
      () => verifyNativeServiceExperiment(noWork, { mode: 'snapshot' }),
      /no real work/,
    );
    assert.equal(
      verifyNativeServiceExperiment(noWork, {
        ...options,
        requireTimedWork: false,
        requireNativeWork: false,
      }).nativeDuringEveryLeg,
      false,
    );
    assert.throws(
      () => verifyNativeServiceExperiment(evidence().slice(0, -1), options),
      /do not cover/,
    );
    assert.throws(
      () =>
        verifyNativeServiceExperiment(
          evidence({
            ...native,
            sessions: [
              [1, 0, 1, 0],
              [0, 0, 0, 0],
              [0, 0, 0, 0],
            ],
          }),
          options,
        ),
      /unretired/,
    );
    assert.throws(
      () =>
        verifyNativeServiceExperiment(evidence(native, { ...sdk, snapshotEditors: 11 }), options),
      /disagree/,
    );
    assert.throws(() => verifyNativeServiceExperiment(evidence(), { mode: 'ts' }), /Malformed/);
    assert.throws(
      () => verifyNativeServiceExperiment(evidence({ ...native, overflow: true }), options),
      /unretired/,
    );
    assert.throws(() => verifyGeometryActivation(evidence(), { mode: 'ts' }), /dedicated/);
    const collector = geometryActivationCollector();
    collector.observe(evidence().join('\n') + '\n');
    assert.equal(
      verifyNativeServiceExperiment(collector.finish(), options).native.snapshotEditors,
      12,
    );
  },
);
test(
  'actual C++ audit ignores inactive work, emits OS-clock bins and requires explicit session close',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'nelyx-native-service-audit-')),
      executable = path.join(directory, 'audit.exe'),
      source = path.join(directory, 'audit.cpp'),
      env = {
        ...windowsCompilerEnvironment(),
        NELYX_NATIVE_SERVICE_EXPERIMENT: 'snapshot',
        NELYX_NATIVE_SERVICE_MANUAL: '',
      };
    try {
      fs.writeFileSync(
        source,
        '#include "JsiNativeServiceAudit.h"\nint main(){using A=RNSkia::NativeServiceAudit;A::record({{0,99}});A::begin(7);A::Session session(0);A::record({{0,1},{1,12}});session.close();session.close();A::end();}\n',
      );
      await execute(
        'cl.exe',
        [
          '/nologo',
          '/std:c++20',
          '/EHsc',
          '/MD',
          '/O2',
          '/I' + path.resolve(import.meta.dirname, '../../skia/native/adapters/jsi/cpp/api'),
          source,
          '/Fe' + executable,
          'kernel32.lib',
        ],
        { cwd: directory, env, timeout },
      );
      const result = spawnSync(executable, [], { cwd: directory, env, encoding: 'utf8', timeout });
      assert.equal(result.status, 0, result.stderr);
      const lines = [
        prefix('NELYX_INPUT_GEOMETRY_STATUS', request),
        prefix('NELYX_INPUT_GEOMETRY_STATUS', sdk),
        ...result.stderr.trim().split(/\r?\n/),
      ];
      const proof = verifyNativeServiceExperiment(lines, { mode: 'snapshot' });
      assert.equal(proof.native.snapshotCalls, 1);
      assert.equal(proof.native.snapshotEditors, 12);
      const manualResult = spawnSync(executable, [], {
        cwd: directory,
        env: { ...env, NELYX_NATIVE_SERVICE_MANUAL: '1' },
        encoding: 'utf8',
        timeout,
      });
      assert.equal(manualResult.status, 0, manualResult.stderr);
      const manualProof = verifyNativeModuleMode(
        [
          prefix('NELYX_INPUT_GEOMETRY_STATUS', request),
          prefix('NELYX_INPUT_GEOMETRY_STATUS', {
            schema: 1,
            kind: 'manual-selection',
            mode: 'snapshot',
            ownerGeneration: 7,
          }),
          prefix('NELYX_INPUT_GEOMETRY_STATUS', { ...sdk, kind: 'manual' }),
          ...manualResult.stderr.trim().split(/\r?\n/),
        ],
        { mode: 'snapshot' },
      );
      assert.equal(manualProof.modules.inputGeometry, 'observed');
      assert.equal(manualProof.native.snapshotEditors, 12);
    } finally {
      assert.equal(path.dirname(fs.realpathSync(directory)), parent);
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);
