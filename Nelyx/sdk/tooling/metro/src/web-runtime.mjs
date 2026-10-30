// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

/** The same pinned CanvasKit bytes are served by development and static builds. */
export function readWebRuntime(config, runtimeDirectory) {
  const load = createRequire(path.join(config.projectRoot, 'package.json'));
  const manifestPath = runtimeDirectory
    ? path.join(runtimeDirectory, 'native-manifest.json')
    : load.resolve('@nelyx/skia-web/native-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.status === 'requires-build')
    throw new Error('Build and supply the Nelyx CanvasKit runtime before building the Web app');
  if (manifest.packageRuntime !== undefined && manifest.packageRuntime !== 'generated/runtime')
    throw new Error('Invalid packaged Web runtime path');
  const runtimeRoot =
    runtimeDirectory ??
    (manifest.packageRuntime
      ? path.join(path.dirname(manifestPath), manifest.packageRuntime)
      : null);
  if (
    manifest.schema !== 'nelyx.canvaskit/v1' ||
    manifest.version !== 'm153-nelyx-paragraph.1' ||
    manifest.paragraphApiVersion !== 1 ||
    manifest.adapterAbi !== 1 ||
    !runtimeRoot ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== 2 ||
    new Set(manifest.files.map((file) => file.id)).size !== 2 ||
    manifest.files.some(
      (file) =>
        !['canvaskit.js', 'canvaskit.wasm'].includes(file.id) ||
        file.path !== file.id ||
        !/^[a-f0-9]{64}$/.test(file.sha256),
    )
  )
    throw new Error('Invalid Web runtime manifest');
  const runtime = manifest.files.map((file) => ({
    file,
    bytes: fs.readFileSync(path.join(runtimeRoot, file.path)),
  }));
  for (const { file, bytes } of runtime)
    if (createHash('sha256').update(bytes).digest('hex') !== file.sha256)
      throw new Error('CanvasKit build artifact hash mismatch');
  const license = path.join(runtimeRoot, 'LICENSE_SKIA');
  return { manifest, runtime, license };
}
