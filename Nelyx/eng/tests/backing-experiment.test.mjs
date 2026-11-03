// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { execute } from '../../sdk/tooling/cli/src/commands.mjs';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { verifyWindowsInputs } from '../../sdk/tooling/cli/src/native-inputs.mjs';
import { verifyNativeSourceInputs } from '../../skia/eng/native-source-inputs.mjs';
import { verifyBackingExperiment, withoutBackingEvidence } from './backing-experiment.js';
const timeout = 1_200_000;
const status = 'NELYX_INPUT_GEOMETRY_STATUS ';
const line = (prefix, row) => prefix + JSON.stringify(row);
function fixture() {
  const selection = { schema: 1, kind: 'backing-selection', mode: 'backing', ownerGeneration: 1 },
    sdk = {
      ...selection,
      kind: 'backing-sdk',
      created: 1,
      reused: 8,
      invalid: 0,
      closed: true,
      tsFallbacks: 0,
    },
    native = {
      schema: 1,
      mode: 'backing',
      ownerGeneration: 1,
      beganQpcMs: 100,
      endedQpcMs: 5100,
      created: 1,
      reused: 8,
      destroyed: 1,
      initialObjects: 0,
      initialBytes: 0,
      liveObjects: 0,
      liveBytes: 0,
      peakObjects: 1,
      peakBytes: 4096,
      overflow: false,
      closed: true,
      binCount: 3,
    },
    bins = {
      schema: 1,
      index: 0,
      rows: [
        [0, 1, 4, 0],
        [2, 0, 4, 0],
        [5, 0, 0, 1],
      ],
    };
  return {
    selection,
    sdk,
    native,
    bins,
    lines() {
      return [
        line(status, this.selection),
        line(status, this.sdk),
        line('NELYX_WIN32_BACKING_USAGE ', this.native),
        line('NELYX_WIN32_BACKING_BINS ', this.bins),
      ];
    },
  };
}
const check = {
  column: 'primary',
  nativeBeginMs: 1000,
  nativeEndMs: 4000,
  nativeSurface: { firstMovementMs: 1100, bottomMs: 3900 },
  observation: {
    backingOverflow: 0,
    backingEvents: [
      [2001, 2],
      [2500, 2],
    ],
  },
};
test(
  'backing audit rejects startup-only, mode/SDK disagreement, missing bins and retained backing',
  { timeout },
  () => {
    const good = fixture();
    assert.equal(
      verifyBackingExperiment(good.lines(), { mode: 'backing', checks: [check] }).timed[0].reused,
      4,
    );
    for (const mutate of [
      (x) => {
        x.bins.rows[0][2] = 8;
        x.bins.rows[1][2] = 0;
      },
      (x) => {
        x.native.liveBytes = 4096;
      },
      (x) => {
        x.sdk.reused = 7;
      },
      (x) => {
        x.selection.mode = 'ts';
      },
      (x) => {
        x.native.overflow = true;
      },
      (x) => {
        x.native.peakObjects = 4;
      },
      (x) => {
        x.bins.rows.pop();
      },
      (x) => {
        x.native.destroyed = 0;
      },
    ]) {
      const broken = fixture();
      mutate(broken);
      assert.throws(
        () => verifyBackingExperiment(broken.lines(), { mode: 'backing', checks: [check] }),
        /backing audit/,
      );
    }
    assert.throws(
      () =>
        verifyBackingExperiment(good.lines(), {
          mode: 'backing',
          checks: [{ ...check, observation: { backingOverflow: 0, backingEvents: [] } }],
        }),
      /no proven/,
    );
    assert.deepEqual(
      withoutBackingEvidence([...good.lines(), 'NELYX_INPUT_GEOMETRY_STATUS {"kind":"request"}']),
      ['NELYX_INPUT_GEOMETRY_STATUS {"kind":"request"}'],
    );
  },
);

test(
  'the delivered Win32 import keeps exact pixels and frame fences through backing reuse and eviction',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const root = path.resolve(import.meta.dirname, '../../..'),
      app = path.join(root, 'sample/nelyx-testbed-app-2'),
      runner = path.join(app, 'windows/runner'),
      input = verifyWindowsInputs({
        runner,
        input: JSON.parse(
          fs.readFileSync(path.join(app, '.nelyx/windows/native-inputs.json'), 'utf8'),
        ).input,
      }),
      binding = path.join(runner, 'node_modules/@nelyx/skia-rn'),
      parent = fs.realpathSync(os.tmpdir());
    verifyNativeSourceInputs(binding);
    const directory = fs.mkdtempSync(path.join(parent, 'nelyx-native-backing-'));
    try {
      const env = windowsCompilerEnvironment(),
        executable = path.join(directory, 'backing.exe'),
        defines = [
          'SK_GRAPHITE',
          'SK_VULKAN',
          'SK_USE_INTERNAL_VULKAN_HEADERS',
          'VK_NO_PROTOTYPES',
          'VK_USE_PLATFORM_WIN32_KHR',
          'NOMINMAX',
          'WIN32_LEAN_AND_MEAN',
        ],
        includes = [
          path.join(input.root, input.manifest.headers),
          ...['generated/core', 'generated/gpu', 'generated/vulkan'].map((name) =>
            path.join(binding, name),
          ),
        ],
        libraries = [
          'd3d11',
          'dxgi',
          'dcomp',
          'dwmapi',
          'user32',
          'gdi32',
          'dwrite',
          'ole32',
          'oleaut32',
          'uuid',
          'usp10',
          'shlwapi',
          'shell32',
          'imm32',
          'comctl32',
          'runtimeobject',
          'advapi32',
          'bcrypt',
        ];
      await execute(
        'cl.exe',
        [
          '/nologo',
          '/std:c++20',
          '/O2',
          '/MD',
          '/EHsc',
          '/bigobj',
          '/utf-8',
          ...defines.map((value) => '/D' + value),
          ...includes.map((value) => '/I' + value),
          path.join(import.meta.dirname, 'native-backing.cpp'),
          '/Fo' + path.join(directory, 'backing.obj'),
          '/Fe' + executable,
          '/link',
          ...input.manifest.libraries.map((name) => path.join(input.root, name)),
          ...libraries.map((name) => name + '.lib'),
        ],
        { cwd: directory, env, timeout },
      );
      for (const mode of ['ts', 'backing']) {
        const result = spawnSync(
          executable,
          [path.join(app, 'assets/NotoSansKR.ttf'), path.join(input.root, input.manifest.icu)],
          {
            cwd: directory,
            env: { ...env, NELYX_WINDOWS_BACKING_REUSE: mode === 'backing' ? '1' : '0' },
            encoding: 'utf8',
            timeout,
          },
        );
        assert.equal(result.status, 0, result.stdout + result.stderr);
        const callerLine = result.stdout
            .split(/\r?\n/)
            .find((row) => row.startsWith('BACKING_CALLER ')),
          caller = JSON.parse(callerLine.slice(15));
        assert.equal(caller.frames, 16);
        const proof = verifyBackingExperiment(
          [
            line(status, { schema: 1, kind: 'backing-selection', mode, ownerGeneration: 17 }),
            line(status, {
              schema: 1,
              kind: 'backing-sdk',
              mode,
              ownerGeneration: 17,
              created: caller.created,
              reused: caller.reused,
              invalid: 0,
              closed: true,
              tsFallbacks: 0,
            }),
            ...result.stderr.trim().split(/\r?\n/),
          ],
          { mode, checks: [], requireTimedWork: false },
        );
        assert.equal(proof.peakObjects, mode === 'backing' ? 3 : 1);
        assert.equal(proof.reused > 0, mode === 'backing');
        console.log('DELIVERED_BACKING_PASS', {
          mode,
          ...caller,
          peakObjects: proof.peakObjects,
          peakBytes: proof.peakBytes,
          scope:
            'native caller and readback; actual Testbed SDK execution and cadence are separate',
        });
      }
    } finally {
      assert.equal(path.dirname(fs.realpathSync(directory)), parent);
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  },
);
test(
  'the actual native worker audit ignores disabled work and seals allocation balance on drain',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'nelyx-backing-audit-')),
      source = path.join(directory, 'audit.cpp'),
      executable = path.join(directory, 'audit.exe'),
      env = windowsCompilerEnvironment();
    try {
      fs.writeFileSync(
        source,
        '#include "win32_backing_audit.h"\n#include <thread>\nint main(){nelyx::vulkan::Win32BackingAudit a;a.record(1,99,9999);a.begin(7,true,0,0);std::thread worker([&](){a.record(1,1,4096);a.record(2,1,4096);a.record(3,0,0);});worker.join();a.end(0,0);}\n',
      );
      await execute(
        'cl.exe',
        [
          '/nologo',
          '/std:c++20',
          '/EHsc',
          '/MD',
          '/O2',
          '/I' + path.resolve(import.meta.dirname, '../../skia/native/platforms/vulkan'),
          source,
          '/Fe' + executable,
          'kernel32.lib',
        ],
        { cwd: directory, env, timeout },
      );
      const result = spawnSync(executable, [], { cwd: directory, env, encoding: 'utf8', timeout });
      assert.equal(result.status, 0, result.stderr);
      const lines = [
        line(status, { schema: 1, kind: 'backing-selection', mode: 'backing', ownerGeneration: 7 }),
        line(status, {
          schema: 1,
          kind: 'backing-sdk',
          mode: 'backing',
          ownerGeneration: 7,
          created: 1,
          reused: 1,
          invalid: 0,
          tsFallbacks: 0,
          closed: true,
        }),
        ...result.stderr.trim().split(/\r?\n/),
      ];
      const proof = verifyBackingExperiment(lines, {
        mode: 'backing',
        checks: [],
        requireTimedWork: false,
      });
      assert.equal(proof.created, 1);
      assert.equal(proof.reused, 1);
      assert.equal(proof.destroyed, 1);
    } finally {
      assert.equal(path.dirname(fs.realpathSync(directory)), parent);
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);
