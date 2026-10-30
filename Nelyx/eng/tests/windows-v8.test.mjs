// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { windowsV8Cohort, validateCohort, nativeCohort } from '../../sdk/dist/runtime/cohorts.js';
import { createProviderRegistry } from '../../sdk/dist/runtime/providers.js';
import {
  readV8RuntimeIdentity,
  validateNativeRuntimeIdentity,
} from '../../sdk/dist/backends/react-native/engine.js';
import { patchWindowsV8Source, windowsV8Pin } from '../../sdk/tooling/cli/src/windows-v8.mjs';
import { verifyWindowsPackage } from '../../sdk/tooling/cli/src/windows-runner.mjs';
const timeout = 1_200_000;
test(
  'V8 is an explicit Windows source cohort and leaves the default Hermes bytecode policy intact',
  { timeout },
  () => {
    const registry = createProviderRegistry(),
      v8 = registry.cohort('windows', { cohort: 'rn-0.83.10-v8' }, 'rn-v8-graphite-vulkan');
    assert.deepEqual(v8, windowsV8Cohort());
    assert.equal(v8.engineVersion, windowsV8Pin.version);
    assert.equal(v8.engineRevision, windowsV8Pin.revision);
    assert.equal(v8.bytecodeVersion, null);
    assert.equal(registry.profile('windows', 'rn-v8-graphite-vulkan').identity.runtime, 'v8');
    assert.equal(registry.cohort('windows', {}, 'rn-v8-graphite-vulkan').id, v8.id);
    assert.throws(
      () => registry.cohort('windows', { cohort: 'rn-0.83.10' }, 'rn-v8-graphite-vulkan'),
      /Unsupported provider cohort/,
    );
    assert.equal(registry.profile('windows').identity.runtime, 'hermes');
    assert.equal(registry.cohort('windows').engine, 'hermes');
    assert.equal(nativeCohort('windows').bytecodeVersion, 99);
    assert.throws(
      () => validateCohort({ ...v8, bytecodeVersion: 99 }, 'windows'),
      /source bundles/,
    );
    assert.throws(
      () =>
        validateCohort(
          { ...nativeCohort('android'), engine: 'v8', bytecodeVersion: null },
          'android',
        ),
      /framework\/engine/,
    );
  },
);
test(
  'a V8 package rejects an otherwise inventoried Hermes bytecode payload before launch',
  { timeout },
  () => {
    const parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'nelyx-v8-package-'));
    try {
      const hbc = Buffer.alloc(32);
      hbc.writeBigUInt64LE(0x1f1903c103bc1fc6n);
      hbc.writeUInt32LE(99, 8);
      const files = [];
      for (const [name, bytes] of [
        ['NelyxRNHost.exe', Buffer.from('exe')],
        ['Microsoft.ReactNative.dll', Buffer.from('rnw')],
        ['hermes.dll', Buffer.from('hermes')],
        ['Assets/icudtl.dat', Buffer.from('icu')],
        ['Bundle/index.windows.bundle', hbc],
      ]) {
        const file = path.join(directory, name);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, bytes);
        files.push({
          path: name,
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
      }
      fs.writeFileSync(
        path.join(directory, 'nelyx-package.json'),
        JSON.stringify({
          schema: 'nelyx.rnw-package/v1',
          target: 'windows',
          profile: 'rn-v8-graphite-vulkan',
          architecture: 'x64',
          configuration: 'Release',
          app: 'V8Test',
          executable: 'NelyxRNHost.exe',
          bundle: 'Bundle/index.windows.bundle',
          qualification: 'notVerified',
          nativeInputsSha256: 'a'.repeat(64),
          nativeBindingConfiguration: 'Release',
          crt: 'MD',
          iteratorDebugLevel: 0,
          hermesCompilerFlags: null,
          cohort: windowsV8Cohort(),
          files,
        }),
      );
      assert.throws(
        () => verifyWindowsPackage(directory),
        /V8 requires a JavaScript source bundle/,
      );
      const file = path.join(directory, 'nelyx-package.json'),
        manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const policy of [null, 'foreign-policy', 'nelyx.v8-native-es2022-rn0.83.10/v1']) {
        fs.writeFileSync(file, JSON.stringify({ ...manifest, v8CompilerPolicy: policy }));
        assert.throws(() => verifyWindowsPackage(directory), /V8 compiler policy differs/);
      }
      fs.writeFileSync(
        file,
        JSON.stringify({ ...manifest, v8CompilerPolicy: 'nelyx.v8-native-es2022-rn0.83.10/v2' }),
      );
      assert.throws(
        () => verifyWindowsPackage(directory),
        /V8 requires a JavaScript source bundle/,
      );
    } finally {
      assert.equal(path.dirname(fs.realpathSync(directory)), parent);
      assert(path.basename(directory).startsWith('nelyx-v8-package-'));
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);
test(
  'V8 admission requires the owning native runtime version and revision; Hermes remains independently checked',
  { timeout },
  () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__nelyxV8RuntimeIdentity');
    try {
      delete globalThis.__nelyxV8RuntimeIdentity;
      assert.equal(readV8RuntimeIdentity(), undefined);
      globalThis.__nelyxV8RuntimeIdentity = {
        engine: 'v8',
        releaseVersion: windowsV8Pin.version,
        revision: windowsV8Pin.revision,
        description: 'V8Runtime',
      };
      const identity = readV8RuntimeIdentity();
      assert(Object.isFrozen(identity));
      validateNativeRuntimeIdentity(windowsV8Cohort(), identity);
      for (const value of [
        undefined,
        { ...identity, revision: '0'.repeat(40) },
        { releaseVersion: '1.0.0', bytecodeVersion: 99 },
      ])
        assert.throws(
          () => validateNativeRuntimeIdentity(windowsV8Cohort(), value),
          /V8 runtime identity/,
        );
      assert.throws(
        () => validateNativeRuntimeIdentity(nativeCohort('windows'), identity),
        /Hermes runtime identity/,
      );
      validateNativeRuntimeIdentity(nativeCohort('windows'), {
        releaseVersion: '1.0.0',
        bytecodeVersion: 99,
      });
    } finally {
      if (previous) Object.defineProperty(globalThis, '__nelyxV8RuntimeIdentity', previous);
      else delete globalThis.__nelyxV8RuntimeIdentity;
    }
  },
);
test(
  'RNW source adaptation is bounded to the pinned runtime creation seam and retains the Hermes branch',
  { timeout, skip: process.platform !== 'win32' },
  () => {
    const original = fs.readFileSync(
      new URL(
        '../../../sample/nelyx-testbed-app-2/windows/runner/node_modules/react-native-windows/Microsoft.ReactNative/ReactHost/ReactInstanceWin.cpp',
        import.meta.url,
      ),
      'utf8',
    );
    const source = patchWindowsV8Source(original);
    assert(source.includes('m_options.JsiEngine() == JSIEngine::V8'));
    assert(source.includes('std::make_unique<Nelyx::WindowsJavaScript::Runtime>'));
    assert(source.includes('std::make_unique<Microsoft::ReactNative::HermesJSRuntime>'));
    assert.throws(() => patchWindowsV8Source(source), /runtime creation changed/);
  },
);
