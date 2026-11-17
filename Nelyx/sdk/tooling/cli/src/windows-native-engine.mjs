// SPDX-License-Identifier: BSD-3-Clause
import { createHash } from 'node:crypto';
export const nativeWindowsEngineIdentity = (jsi, jsc) => {
  if (![jsi, jsc].every((value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)))
    throw Error('Native JSC requires prepared JSI and VM input identities');
  return createHash('sha256')
    .update(JSON.stringify([jsi, jsc]))
    .digest('hex');
};
export function nativeEnginePolicy({ engine = 'hermes', mode, hermesMode, jscMode } = {}) {
  if (!['hermes', 'jsc'].includes(engine)) throw Error('Choose direct native engine hermes or jsc');
  if (engine === 'jsc') {
    if (hermesMode !== undefined || (mode !== undefined && mode !== 'source'))
      throw Error('Direct JSC uses source execution; Hermes modes are not applicable');
    const executionMode = jscMode ?? 'jit';
    if (!['jit', 'interpreter'].includes(executionMode))
      throw Error('Choose JSC jit or interpreter');
    return {
      engine,
      host: 'native-jsc',
      mode: 'source',
      executionMode,
      key: 'jsc',
      executable: 'NelyxJscHost.exe',
      vm: 'JavaScriptCore.dll',
      hostSchema: 'nelyx.native-jsc-host/v1',
      packageSchema: 'nelyx.native-jsc-package/v1',
    };
  }
  if (jscMode !== undefined) throw Error('JSC execution mode requires engine jsc');
  if (mode && hermesMode && mode !== hermesMode) throw Error('Conflicting native Hermes modes');
  mode ??= hermesMode ?? 'bytecode';
  if (!['bytecode', 'static-aot'].includes(mode))
    throw Error('Choose Hermes bytecode or static-aot');
  return {
    engine,
    host: 'native-hermes',
    mode,
    key: mode,
    executable: 'NelyxHermesHost.exe',
    vm: 'hermesvm.dll',
    hostSchema: 'nelyx.native-hermes-host/v1',
    packageSchema: 'nelyx.native-hermes-package/v1',
  };
}
export function nativeManifestPolicy(manifest) {
  const engine = manifest.schema === 'nelyx.native-jsc-package/v1' ? 'jsc' : 'hermes';
  if (
    (manifest.engine !== undefined && manifest.engine !== engine) ||
    (engine === 'jsc' && manifest.engine !== 'jsc')
  )
    throw Error('Native package engine tag differs');
  const policy = nativeEnginePolicy({
    engine,
    mode: manifest.mode,
    ...(engine === 'jsc' ? { jscMode: manifest.executionMode } : {}),
  });
  if (
    manifest.schema !== policy.packageSchema ||
    manifest.mode !== policy.mode ||
    (engine === 'jsc' && manifest.executionMode !== policy.executionMode)
  )
    throw Error('Native package engine/mode identity differs');
  return policy;
}
