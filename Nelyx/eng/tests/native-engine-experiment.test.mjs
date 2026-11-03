// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { execute } from '../../sdk/tooling/cli/src/commands.mjs';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { verifyNativeEngineExperiment } from './native-engine-experiment.js';
import { NativeTextLayoutService } from '@nelyx/skia-native/text';
import { GraphiteRenderer } from '@nelyx/skia-native/renderer';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
const timeout = 1_200_000;
test(
  'explicit text/frame selection rejects incomplete native supply before work',
  { timeout },
  async () => {
    const owner = { id: 'capability-test', generation: 1 },
      textApi = { ParagraphBuilder: {} },
      text = new NativeTextLayoutService(textApi, new ResourceRegistry(), owner, new Map()),
      native = {
        nelyxReplayDisplayList() {},
        nelyxReserve() {},
        nelyxSubmit() {},
        nelyxNotifications: () => [],
        nelyxCoreVersion: () => 1,
        nelyxWireVersion: () => 11,
        nelyxIdentity: () => 1,
        nelyxConfigure() {},
        nelyxClose() {},
        nelyxStats: () => [1, 0, 0, 0, 0],
        nelyxReset() {},
        dispose() {},
      },
      frameApi = {},
      frame = new GraphiteRenderer(frameApi, () => native, owner, {
        nativeDisplayLists: true,
      });
    try {
      text.setNativeParagraphTransactions(false);
      frame.setNativeFrameSegments(false);
      assert.throws(() => text.setNativeParagraphTransactions(true), /capability missing/);
      textApi.ParagraphBuilder.nelyxTextTransactionVersion = () => 1;
      assert.throws(() => text.setNativeParagraphTransactions(true), /capability missing/);
      assert.equal(text.nativeParagraphTransactionExecution().textTransactions, 0);
      assert.throws(() => frame.setNativeFrameSegments(true), /capability missing/);
      frameApi.nelyxFrameSegmentVersion = () => 1;
      native.nelyxSealDisplayList = () => {};
      assert.throws(() => frame.setNativeFrameSegments(true), /capability missing/);
      assert.equal(frame.nativeFrameSegmentExecution(), undefined);
    } finally {
      text.setNativeParagraphTransactions(false);
      assert.equal(text.debugStats.paragraphs, 0);
      await frame.dispose();
    }
  },
);
test(
  'the actual C++ engine audit counts real transaction calls and ignores inactive work',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'nelyx-engine-audit-')),
      executable = path.join(directory, 'audit.exe'),
      source = path.join(directory, 'audit.cpp'),
      env = {
        ...windowsCompilerEnvironment(),
        NELYX_NATIVE_SERVICE_EXPERIMENT: 'text',
        NELYX_NATIVE_SERVICE_MANUAL: '',
      };
    try {
      fs.writeFileSync(
        source,
        '#include "JsiNativeServiceAudit.h"\nint main(){using A=RNSkia::NativeServiceAudit;A::recordEngine({{3,99}});A::begin(1);A::recordEngine({{3,3},{4,9},{5,30}});A::end();}\n',
      );
      await execute(
        'cl.exe',
        [
          '/nologo',
          '/std:c++20',
          '/O2',
          '/EHsc',
          '/MD',
          '/I' + path.resolve(import.meta.dirname, '../../skia/native/adapters/jsi/cpp/api'),
          source,
          '/Fe' + executable,
          'kernel32.lib',
        ],
        { cwd: directory, env, timeout },
      );
      const result = spawnSync(executable, [], { cwd: directory, env, timeout, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      const sdk = fixture().sdk,
        proof = verifyNativeEngineExperiment(
          [
            'NELYX_INPUT_GEOMETRY_STATUS ' + JSON.stringify(sdk),
            ...result.stderr.trim().split(/\r?\n/),
          ],
          { mode: 'text', requireTimedWork: false },
        );
      assert.equal(proof.native.textTransactions, 3);
      assert.equal(proof.native.textBytes, 30);
      assert.equal(proof.closed, true);
    } finally {
      assert.equal(path.dirname(fs.realpathSync(directory)), parent);
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);
function fixture(mode = 'text') {
  const totals = Array(10).fill(0);
  if (mode === 'text') totals.splice(3, 3, 3, 9, 30);
  else totals.splice(6, 4, 3, 3, 3, 300);
  const sdk = {
      schema: 1,
      kind: 'experiment',
      mode,
      ownerGeneration: 1,
      closed: true,
      engine: {
        closed: true,
        textTransactions: 3,
        textOperations: 9,
        textBytes: 30,
        frameSeals: 3,
        frameAdmissions: 3,
        frameBytes: 300,
        tsFallbacks: 0,
        fallbackReasons: {},
      },
    },
    native = {
      schema: 1,
      mode,
      ownerGeneration: 1,
      beganQpcMs: 100,
      endedQpcMs: 5100,
      closed: true,
      overflow: false,
      timing: 'qpc-buckets',
      binCount: 1,
      totals,
      memory: [0, 0, 0, 0],
    },
    bins = { schema: 1, index: 0, rows: [[2, ...totals]] };
  return {
    sdk,
    native,
    bins,
    lines() {
      return [
        'NELYX_INPUT_GEOMETRY_STATUS ' + JSON.stringify(this.sdk),
        'NELYX_NATIVE_ENGINE_USAGE ' + JSON.stringify(this.native),
        'NELYX_NATIVE_ENGINE_BINS ' + JSON.stringify(this.bins),
      ];
    },
  };
}
const check = {
  column: 'primary',
  nativeBeginMs: 1000,
  nativeEndMs: 4000,
  nativeSurface: { firstMovementMs: 1100, bottomMs: 3900 },
};
test(
  'manual engine counters prove work and drain without qualifying timed movement',
  { timeout },
  () => {
    for (const mode of ['text', 'frame']) {
      const input = fixture(mode);
      input.sdk.kind = 'manual';
      input.native.timing = 'counters-only';
      input.native.binCount = 0;
      const lines = input.lines().filter((line) => !line.startsWith('NELYX_NATIVE_ENGINE_BINS ')),
        result = verifyNativeEngineExperiment(lines, { mode, manual: true });
      assert.equal(result.observed, true);
      assert.equal(result.closed, true);
      assert.equal(result.nativeDuringEveryLeg, null);
      assert.throws(() => verifyNativeEngineExperiment(lines, { mode, checks: [check] }), /audit/);
    }
  },
);
test(
  'engine evidence rejects startup work, wrong SDK counts, fallback disagreement and retained native frames',
  { timeout },
  () => {
    assert.equal(
      verifyNativeEngineExperiment(fixture().lines(), { mode: 'text', checks: [check] }).observed,
      true,
    );
    for (const mutate of [
      (x) => {
        x.bins.rows[0][0] = 0;
      },
      (x) => {
        x.sdk.engine.textTransactions = 2;
      },
      (x) => {
        x.sdk.engine.tsFallbacks = 1;
      },
      (x) => {
        x.native.memory[0] = 1;
      },
      (x) => {
        x.native.totals[0] = 1;
      },
      (x) => {
        x.native.overflow = true;
      },
    ]) {
      const x = fixture();
      mutate(x);
      assert.throws(
        () => verifyNativeEngineExperiment(x.lines(), { mode: 'text', checks: [check] }),
        /Native engine audit/,
      );
    }
    const frame = fixture('frame');
    assert.equal(
      verifyNativeEngineExperiment(frame.lines(), { mode: 'frame', checks: [check] }).native
        .frameAdmissions,
      3,
    );
    frame.native.totals[8] = 2;
    frame.bins.rows[0][9] = 2;
    assert.throws(
      () => verifyNativeEngineExperiment(frame.lines(), { mode: 'frame', checks: [check] }),
      /unadmitted\/unretired/,
    );
  },
);
