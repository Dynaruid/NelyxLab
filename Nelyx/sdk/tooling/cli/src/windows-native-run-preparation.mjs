// SPDX-License-Identifier: BSD-3-Clause
import { createHash } from 'node:crypto';
import { nativeEnginePolicy } from './windows-native-engine.mjs';

/** Installed JS/native sources and the exact prepared compiler/renderer supply
 * jointly identify a reusable product. A source-only hash misses supplier changes. */
export function nativeWindowsBuildIdentity(sdk, native, engine) {
  if (
    ![sdk, native, engine].every(
      (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value),
    )
  )
    throw Error('Native run requires prepared SDK, renderer and engine input identities');
  return createHash('sha256')
    .update(JSON.stringify([sdk, native, engine]))
    .digest('hex');
}

/** Default execution follows current app/SDK bytes. An explicit package is a
 * caller-selected portable snapshot and never reads or rebuilds local sources. */
export async function prepareNativeWindowsRun(
  { app, directory, engine, hermesMode, jscMode },
  { packageFor, readInputs, readAppInputs, build, onRebuild = () => {} },
) {
  const runtime = nativeEnginePolicy({ engine, hermesMode, jscMode }),
    mode = runtime.mode;
  const matches = (manifest) =>
    manifest?.mode === mode &&
    (manifest.engine ?? 'hermes') === runtime.engine &&
    (runtime.engine !== 'jsc' || manifest.executionMode === runtime.executionMode);
  if (directory) {
    const verified = packageFor(app, directory);
    if (hermesMode !== undefined && verified.manifest.mode !== hermesMode)
      throw Error('Explicit native package has a different Hermes execution mode');
    if (engine !== undefined && (verified.manifest.engine ?? 'hermes') !== engine)
      throw Error('Explicit native package has a different engine');
    if (jscMode !== undefined && verified.manifest.executionMode !== jscMode)
      throw Error('Explicit native package has a different JSC execution mode');
    return verified;
  }
  let verified = packageFor(app, undefined, runtime.key);
  if (verified?.manifest.qualification === 'diagnostic-only')
    throw Error('Default native run requires a product package');
  if (
    verified?.manifest.sdkInputsSha256 === readInputs(app) &&
    verified?.manifest.appInputsSha256 === readAppInputs(app) &&
    matches(verified?.manifest)
  )
    return verified;
  onRebuild();
  await build({
    app,
    mode,
    engine: runtime.engine,
    ...(runtime.engine === 'jsc' ? { jscMode: runtime.executionMode } : {}),
  });
  verified = packageFor(app, undefined, runtime.key);
  if (
    !verified ||
    !matches(verified.manifest) ||
    verified.manifest.qualification !== 'experimental'
  )
    throw Error('Native rebuild did not publish the selected product mode');
  if (verified.manifest.sdkInputsSha256 !== readInputs(app))
    throw Error('Native rebuild did not capture the current installed SDK');
  if (verified.manifest.appInputsSha256 !== readAppInputs(app))
    throw Error('Native rebuild did not capture the current application inputs');
  return verified;
}
