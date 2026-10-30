// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { windowsJscCohort, nativeCohort, validateCohort } from '../../sdk/dist/runtime/cohorts.js';
import { createProviderRegistry } from '../../sdk/dist/runtime/providers.js';
import {
  readJscRuntimeIdentity,
  validateNativeRuntimeIdentity,
} from '../../sdk/dist/backends/react-native/engine.js';
import {
  windowsJscMode,
  windowsJscPin,
  patchWindowsJscSource,
  patchJscMicrotasks,
} from '../../sdk/tooling/cli/src/windows-jsc.mjs';
import {
  verifyWindowsPackage,
  buildWindows,
  prepareWindows,
} from '../../sdk/tooling/cli/src/windows-runner.mjs';
const timeout = 1_200_000;

test(
  'JSC is a pinned Windows source cohort with independent runtime admission',
  { timeout },
  () => {
    const registry = createProviderRegistry(),
      cohort = windowsJscCohort();
    assert.deepEqual(registry.cohort('windows', {}, 'rn-jsc-graphite-vulkan'), cohort);
    assert.equal(registry.profile('windows', 'rn-jsc-graphite-vulkan').identity.runtime, 'jsc');
    assert.equal(cohort.engineVersion, windowsJscPin.version);
    assert.equal(cohort.engineRevision, windowsJscPin.revision);
    assert.equal(cohort.bytecodeVersion, null);
    assert.equal(registry.cohort('windows').engine, 'hermes');
    assert.throws(
      () => validateCohort({ ...cohort, bytecodeVersion: 99 }, 'windows'),
      /source bundles/,
    );
    assert.throws(
      () => validateCohort({ ...nativeCohort('android'), engine: 'jsc' }, 'android'),
      /framework\/engine/,
    );
    assert.throws(
      () => registry.cohort('windows', { cohort: cohort.id }, 'rn-v8-graphite-vulkan'),
      /Unsupported provider cohort/,
    );
  },
);

test(
  'execution modes reject typos and cross-engine configuration before native work',
  { timeout },
  async () => {
    assert.equal(windowsJscMode(), 'jit');
    assert.equal(windowsJscMode('interpreter'), 'interpreter');
    for (const mode of ['JIT', 'aot', 'jitless', '', null])
      assert.throws(() => windowsJscMode(mode), /jit or interpreter/);
    for (const engine of ['v8', 'hermes']) {
      assert.throws(() => windowsJscMode('interpreter', engine), /requires --engine jsc/);
      await assert.rejects(
        buildWindows({ app: 'unused', engine, jscMode: 'interpreter' }),
        /requires --engine jsc/,
      );
      await assert.rejects(
        prepareWindows({ app: 'unused', engine, jscMode: 'jit' }),
        /requires --engine jsc/,
      );
    }
    await assert.rejects(
      buildWindows({ app: 'unused', engine: 'jsc', hermesMode: 'static-aot' }),
      /Static Hermes requires/,
    );
    await assert.rejects(
      buildWindows({ app: 'unused', engine: 'jsc', hermesProfile: 'optimized' }),
      /hermes-profile requires/,
    );
  },
);

test('runtime identity validates actual VM mode, engine and pinned revision', { timeout }, () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, '__nelyxJscRuntimeIdentity');
  try {
    delete globalThis.__nelyxJscRuntimeIdentity;
    assert.equal(readJscRuntimeIdentity(), undefined);
    for (const mode of ['jit', 'interpreter']) {
      const identity = {
        engine: 'jsc',
        releaseVersion: windowsJscPin.version,
        revision: windowsJscPin.revision,
        description: '<JSCRuntime>',
        mode,
        jitEnabled: mode === 'jit',
      };
      globalThis.__nelyxJscRuntimeIdentity = identity;
      assert(Object.isFrozen(readJscRuntimeIdentity()));
      validateNativeRuntimeIdentity(windowsJscCohort(), readJscRuntimeIdentity());
      for (const bad of [
        { ...identity, jitEnabled: !identity.jitEnabled },
        { ...identity, revision: '0'.repeat(40) },
        { ...identity, engine: 'v8' },
      ])
        assert.throws(
          () => validateNativeRuntimeIdentity(windowsJscCohort(), bad),
          /JSC runtime identity/,
        );
      globalThis.__nelyxJscRuntimeIdentity = { ...identity, jitEnabled: !identity.jitEnabled };
      assert.equal(readJscRuntimeIdentity(), undefined);
    }
    assert.throws(
      () => validateNativeRuntimeIdentity(windowsJscCohort(), undefined),
      /JSC runtime identity/,
    );
  } finally {
    if (previous) Object.defineProperty(globalThis, '__nelyxJscRuntimeIdentity', previous);
    else delete globalThis.__nelyxJscRuntimeIdentity;
  }
});

test(
  'JSC packages reject Hermes bytecode, invalid compiler policies and mode changes',
  { timeout },
  () => {
    const parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'nelyx-jsc-package-'));
    try {
      const records = new Map(),
        put = (name, bytes) => {
          bytes = Buffer.from(bytes);
          const file = path.join(directory, name);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, bytes);
          records.set(name, {
            path: name,
            bytes: bytes.length,
            sha256: createHash('sha256').update(bytes).digest('hex'),
          });
        };
      const hbc = Buffer.alloc(32);
      hbc.writeBigUInt64LE(0x1f1903c103bc1fc6n);
      hbc.writeUInt32LE(99, 8);
      for (const [name, bytes] of [
        ['NelyxRNHost.exe', 'exe'],
        ['Microsoft.ReactNative.dll', 'rnw'],
        ['hermes.dll', 'hermes'],
        ['Assets/icudtl.dat', 'icu'],
        ['Bundle/index.windows.bundle', hbc],
        ['jsc-mode.txt', 'interpreter\n'],
      ])
        put(name, bytes);
      const manifest = {
        schema: 'nelyx.rnw-package/v1',
        target: 'windows',
        profile: 'rn-jsc-graphite-vulkan',
        architecture: 'x64',
        configuration: 'Release',
        app: 'JscTest',
        executable: 'NelyxRNHost.exe',
        bundle: 'Bundle/index.windows.bundle',
        qualification: 'notVerified',
        nativeInputsSha256: 'a'.repeat(64),
        nativeBindingConfiguration: 'Release',
        crt: 'MD',
        iteratorDebugLevel: 0,
        hermesCompilerFlags: null,
        hermesCompilerProfile: null,
        hermesCompilerPolicy: null,
        jscCompilerPolicy: 'nelyx.jsc-native-es2022-rn0.83.10/v1',
        jscExecutionMode: 'interpreter',
        cohort: windowsJscCohort(),
      };
      const write = (overrides = {}) =>
        fs.writeFileSync(
          path.join(directory, 'nelyx-package.json'),
          JSON.stringify({ ...manifest, files: [...records.values()], ...overrides }),
        );
      write();
      assert.throws(
        () => verifyWindowsPackage(directory),
        /JSC requires a JavaScript source bundle/,
      );
      write({ jscCompilerPolicy: 'foreign' });
      assert.throws(() => verifyWindowsPackage(directory), /JSC compiler policy/);
      write({ jscExecutionMode: 'aot' });
      assert.throws(() => verifyWindowsPackage(directory), /jit or interpreter/);
      put('Bundle/index.windows.bundle', 'globalThis.value=42;');
      write({ jscExecutionMode: 'jit' });
      assert.throws(() => verifyWindowsPackage(directory), /packaged execution mode differs/);
      write({ cohort: nativeCohort('windows'), profile: 'rn-graphite-vulkan' });
      assert.throws(() => verifyWindowsPackage(directory), /Unexpected JSC configuration/);
    } finally {
      assert.equal(path.dirname(fs.realpathSync(directory)), parent);
      assert(path.basename(directory).startsWith('nelyx-jsc-package-'));
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);

test('pinned RNW and JSC adapter seams reject drift and repeated application', { timeout }, () => {
  const root = new URL(
    '../../../sample/nelyx-testbed-app-2/windows/runner/node_modules/',
    import.meta.url,
  );
  const host = fs.readFileSync(
      new URL('react-native-windows/Microsoft.ReactNative/ReactHost/ReactInstanceWin.cpp', root),
      'utf8',
    ),
    jsc = fs.readFileSync(new URL('react-native/ReactCommon/jsc/JSCRuntime.cpp', root), 'utf8');
  assert.match(patchWindowsJscSource(host), /Nelyx::WindowsJsc::RuntimeHolder/);
  assert.throws(
    () => patchWindowsJscSource(patchWindowsJscSource(host)),
    /runtime creation changed/,
  );
  assert.match(patchJscMicrotasks(jsc), /JSC's outer C API lock exit/);
  assert.throws(() => patchJscMicrotasks(patchJscMicrotasks(jsc)), /microtask adapter changed/);
});
