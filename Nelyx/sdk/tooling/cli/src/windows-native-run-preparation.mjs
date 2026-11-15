// SPDX-License-Identifier: BSD-3-Clause
import { createHash } from 'node:crypto';

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
  { app, directory, hermesMode },
  { packageFor, readInputs, readAppInputs, build, onRebuild = () => {} },
) {
  const mode = hermesMode ?? 'bytecode';
  if (directory) {
    const verified = packageFor(app, directory);
    if (hermesMode !== undefined && verified.manifest.mode !== hermesMode)
      throw Error('Explicit native package has a different Hermes execution mode');
    return verified;
  }
  let verified = packageFor(app, undefined, mode);
  if (verified?.manifest.qualification === 'diagnostic-only')
    throw Error('Default native run requires a product package');
  if (
    verified?.manifest.sdkInputsSha256 === readInputs(app) &&
    verified?.manifest.appInputsSha256 === readAppInputs(app) &&
    verified?.manifest.mode === mode
  )
    return verified;
  onRebuild();
  await build({ app, mode });
  verified = packageFor(app, undefined, mode);
  if (
    !verified ||
    verified.manifest.mode !== mode ||
    verified.manifest.qualification !== 'experimental'
  )
    throw Error('Native rebuild did not publish the selected product mode');
  if (verified.manifest.sdkInputsSha256 !== readInputs(app))
    throw Error('Native rebuild did not capture the current installed SDK');
  if (verified.manifest.appInputsSha256 !== readAppInputs(app))
    throw Error('Native rebuild did not capture the current application inputs');
  return verified;
}
