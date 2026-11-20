// SPDX-License-Identifier: BSD-3-Clause
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { nativeEnginePolicy } from './windows-native-engine.mjs';

/** Entry selection is relative to the app and must stay inside its owned sources. */
export function nativeApplicationEntry(app, entry) {
  app = fs.realpathSync(app);
  entry ??= JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).nelyx?.appEntry;
  if (typeof entry !== 'string' || !entry || path.isAbsolute(entry))
    throw Error('Native --entry requires a file relative to the application');
  const file = fs.realpathSync(path.resolve(app, entry)),
    relative = path.relative(app, file);
  if (
    !relative ||
    relative.split(path.sep).includes('..') ||
    path.isAbsolute(relative) ||
    !fs.statSync(file).isFile()
  )
    throw Error('Native --entry must be a file inside the application');
  return relative.split(path.sep).join('/');
}

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
  { app, directory, engine, hermesMode, jscMode, entry },
  { packageFor, readInputs, readAppInputs, build, onRebuild = () => {} },
) {
  const runtime = nativeEnginePolicy({ engine, hermesMode, jscMode }),
    mode = runtime.mode;
  const matches = (manifest) =>
    manifest?.mode === mode &&
    (manifest.engine ?? 'hermes') === runtime.engine &&
    (manifest.appEntry ?? null) === (entry ?? null) &&
    (runtime.engine !== 'jsc' || manifest.executionMode === runtime.executionMode);
  if (directory) {
    if (entry !== undefined)
      throw Error('--entry cannot be combined with --package; the package fixes its entry');
    const verified = packageFor(app, directory);
    if (hermesMode !== undefined && verified.manifest.mode !== hermesMode)
      throw Error('Explicit native package has a different Hermes execution mode');
    if (engine !== undefined && (verified.manifest.engine ?? 'hermes') !== engine)
      throw Error('Explicit native package has a different engine');
    if (jscMode !== undefined && verified.manifest.executionMode !== jscMode)
      throw Error('Explicit native package has a different JSC execution mode');
    return verified;
  }
  let current = packageFor(app, undefined, runtime.key);
  if (current?.manifest.qualification === 'diagnostic-only')
    throw Error('Default native run requires a product package');
  if (
    current &&
    matches(current.manifest) &&
    current.manifest.appInputsSha256 === readAppInputs(app) &&
    current.manifest.sdkInputsSha256 === readInputs(app)
  )
    return current;
  onRebuild();
  await build({
    app,
    mode,
    engine: runtime.engine,
    ...(entry !== undefined ? { entry } : {}),
    ...(runtime.engine === 'jsc' ? { jscMode: runtime.executionMode } : {}),
  });
  current = packageFor(app, undefined, runtime.key);
  if (!current || !matches(current.manifest) || current.manifest.qualification !== 'experimental')
    throw Error('Native rebuild did not publish the selected product mode');
  if (current.manifest.sdkInputsSha256 !== readInputs(app))
    throw Error('Native rebuild did not capture the current installed SDK');
  if (current.manifest.appInputsSha256 !== readAppInputs(app))
    throw Error('Native rebuild did not capture the current application inputs');
  return current;
}
