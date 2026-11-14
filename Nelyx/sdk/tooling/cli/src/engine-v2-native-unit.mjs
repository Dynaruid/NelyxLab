// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { verifyNativeHermes } from './windows-native-hermes-toolchain.mjs';
import { windowsCompilerEnvironment } from './windows-static-hermes.mjs';
import { windowsNativeHermesPin } from './windows-native-hermes-pin.mjs';
import { windowsNativeHermesCohort } from '@nelyx/sdk/runtime/cohorts';
import { windowsHermesPolicy } from './windows-hermes-policy.mjs';
import { compileHermesImage } from './windows-hermes-image.mjs';

export const engineV2NativeUnit = Object.freeze({
  version: 1,
  entry: 'application/app.native.dll',
  factory: 'sh_export_nelyx_engine_app',
  policy: `windows-hermes-${windowsNativeHermesPin.version}-native-unit-v1`,
  asyncBreakCheck: true,
});
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function runtimeIdentity(supply) {
  const runtime = supply.manifest.files.find(
    (file) => file.path === 'windows-app-sdk/hermesvm.dll',
  );
  if (!runtime) throw Error('Native unit requires the declared Windows Hermes VM');
  return runtime.sha256;
}
function checkCapability(supply) {
  const capability = supply.manifest.profiles['windows-app-sdk']?.appNativeUnit;
  if (
    !capability ||
    Object.keys(capability).length !== Object.keys(engineV2NativeUnit).length ||
    Object.entries(engineV2NativeUnit).some(([key, value]) => capability[key] !== value)
  )
    throw Error('The Windows host does not supply the selected native unit contract');
}
/** Compile the existing App JS without replacing Source bodies or callbacks.
 * Compiler inputs are explicit for this optional Windows execution path. */
export async function buildEngineV2NativeUnit({ supply, staged, compilerInputs, signal }) {
  checkCapability(supply);
  const checked = verifyNativeHermes(path.resolve(compilerInputs)),
    runtimeSha256 = runtimeIdentity(supply);
  if (hash(path.join(checked.directory, 'build/lib/hermesvm.dll')) !== runtimeSha256)
    throw Error('Native compiler inputs and supplied Windows VM differ');
  const source = path.join(staged, 'application/app.js'),
    sourceSha256 = hash(source);
  const build = await compileHermesImage({
    checked,
    env: windowsCompilerEnvironment(),
    output: path.join(staged, engineV2NativeUnit.entry),
    runtimeLibrary: path.join(checked.directory, 'build/lib/hermesvm.lib'),
    signal,
    units: [
      {
        name: 'nelyx_engine_app',
        source,
        flags: [
          ...windowsHermesPolicy('optimized', windowsNativeHermesCohort()).flags,
          '-Xes6-block-scoping',
          '-emit-async-break-check',
          '-g1',
        ],
        typed: false,
        requireNumeric: false,
        evidence: true,
      },
    ],
  });
  if (hash(source) !== sourceSha256) throw Error('App JS changed during native compilation');
  const evidence = 'application/app.native-map.json';
  fs.writeFileSync(
    path.join(staged, evidence),
    JSON.stringify({
      schema: 'nelyx.app.v2.native-map/1',
      sourceSha256,
      units: build.units.map(({ unit, nativeFunctions }) => ({ unit, nativeFunctions })),
      nativePcMap: build.nativePcMap,
    }) + '\n',
  );
  return {
    ...engineV2NativeUnit,
    sourceSha256,
    runtimeSha256,
    toolchainSha256: checked.sha256,
    release: windowsNativeHermesPin.version,
    revision: windowsNativeHermesPin.revision,
    architecture: 'x64',
    heap: 'HEAP_HV_64',
    crt: 'MD',
    evidence,
  };
}
export function verifyEngineV2NativeUnit(manifest, supply, sourceSha256, root) {
  if (manifest.nativeUnit === undefined) return;
  checkCapability(supply);
  const unit = manifest.nativeUnit;
  if (
    !unit ||
    manifest.target !== 'windows' ||
    Object.entries(engineV2NativeUnit).some(([key, value]) => unit[key] !== value) ||
    unit.sourceSha256 !== sourceSha256 ||
    unit.runtimeSha256 !== runtimeIdentity(supply) ||
    unit.release !== windowsNativeHermesPin.version ||
    unit.revision !== windowsNativeHermesPin.revision ||
    unit.architecture !== 'x64' ||
    unit.heap !== 'HEAP_HV_64' ||
    unit.crt !== 'MD' ||
    !/^[a-f0-9]{64}$/.test(unit.toolchainSha256) ||
    unit.evidence !== 'application/app.native-map.json' ||
    !manifest.files.some((file) => file.path === unit.entry) ||
    !manifest.files.some((file) => file.path === unit.evidence)
  )
    throw Error(
      'App native unit source/runtime/compiler contract differs; rebuild the application',
    );
  const map = JSON.parse(fs.readFileSync(path.join(root, unit.evidence), 'utf8'));
  if (
    map.schema !== 'nelyx.app.v2.native-map/1' ||
    map.sourceSha256 !== sourceSha256 ||
    map.units?.length !== 1 ||
    map.units[0].unit !== 'nelyx_engine_app' ||
    map.units[0].nativeFunctions?.sourceSha256 !== sourceSha256 ||
    !map.units[0].nativeFunctions?.functions?.length ||
    !map.nativePcMap
  )
    throw Error('App native function/PC map is missing or belongs to another source');
}
