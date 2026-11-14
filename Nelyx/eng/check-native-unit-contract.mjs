// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  engineV2NativeUnit,
  verifyEngineV2NativeUnit,
} from '../sdk/tooling/cli/src/engine-v2-native-unit.mjs';
import { windowsNativeHermesPin } from '../sdk/tooling/cli/src/windows-native-hermes-pin.mjs';

const parent = path.resolve('.nelyx'),
  temporary = fs.mkdtempSync(path.join(parent, 'unit-contract-'));
if (path.dirname(temporary) !== parent || !path.basename(temporary).startsWith('unit-contract-'))
  throw Error('Invalid owned native unit fixture');
const watchdog = setTimeout(() => {
  throw Error('Native unit contract check exceeded 20 minutes');
}, 1_200_000);
try {
  const source = 'a'.repeat(64),
    runtime = 'b'.repeat(64);
  const supply = {
    manifest: {
      profiles: { 'windows-app-sdk': { appNativeUnit: { ...engineV2NativeUnit } } },
      files: [{ path: 'windows-app-sdk/hermesvm.dll', sha256: runtime }],
    },
  };
  const unit = {
    ...engineV2NativeUnit,
    sourceSha256: source,
    runtimeSha256: runtime,
    toolchainSha256: 'c'.repeat(64),
    release: windowsNativeHermesPin.version,
    revision: windowsNativeHermesPin.revision,
    architecture: 'x64',
    heap: 'HEAP_HV_64',
    crt: 'MD',
    evidence: 'application/app.native-map.json',
  };
  const manifest = {
    target: 'windows',
    nativeUnit: unit,
    files: [{ path: unit.entry }, { path: unit.evidence }],
  };
  fs.mkdirSync(path.join(temporary, 'application'));
  const map = {
    schema: 'nelyx.app.v2.native-map/1',
    sourceSha256: source,
    units: [
      { unit: 'nelyx_engine_app', nativeFunctions: { sourceSha256: source, functions: [{}] } },
    ],
    nativePcMap: { functions: [{}] },
  };
  const write = (value) =>
    fs.writeFileSync(path.join(temporary, unit.evidence), JSON.stringify(value));
  write(map);
  verifyEngineV2NativeUnit(manifest, supply, source, temporary);
  verifyEngineV2NativeUnit({ target: 'web' }, supply, source, 'missing-unused-root');
  for (const change of [
    { version: 2 },
    { factory: 'other' },
    { policy: 'other' },
    { asyncBreakCheck: false },
    { sourceSha256: runtime },
    { runtimeSha256: source },
    { toolchainSha256: '' },
    { revision: 'other' },
    { architecture: 'arm64' },
    { heap: 'other' },
    { crt: 'MT' },
    { evidence: '../outside.json' },
  ])
    assert.throws(() =>
      verifyEngineV2NativeUnit(
        { ...manifest, nativeUnit: { ...unit, ...change } },
        supply,
        source,
        temporary,
      ),
    );
  assert.throws(() =>
    verifyEngineV2NativeUnit({ ...manifest, nativeUnit: null }, supply, source, temporary),
  );
  assert.throws(() =>
    verifyEngineV2NativeUnit({ ...manifest, target: 'web' }, supply, source, temporary),
  );
  assert.throws(() =>
    verifyEngineV2NativeUnit({ ...manifest, files: [] }, supply, source, temporary),
  );
  const incompatible = structuredClone(supply);
  incompatible.manifest.profiles['windows-app-sdk'].appNativeUnit.version = 2;
  assert.throws(() => verifyEngineV2NativeUnit(manifest, incompatible, source, temporary));
  write({ ...map, sourceSha256: runtime });
  assert.throws(() => verifyEngineV2NativeUnit(manifest, supply, source, temporary));
  write({ ...map, units: [] });
  assert.throws(() => verifyEngineV2NativeUnit(manifest, supply, source, temporary));
  write({ ...map, nativePcMap: null });
  assert.throws(() => verifyEngineV2NativeUnit(manifest, supply, source, temporary));
  console.log(
    'Native unit contract: source/runtime/compiler/ABI, factory/break-check policy, evidence and target mismatch rejection; bytecode path PASS.',
  );
} finally {
  clearTimeout(watchdog);
  fs.rmSync(temporary, { recursive: true, force: true });
}
