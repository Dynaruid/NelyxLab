// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { localFile } from './node-files.mjs';

export function checkWebRuntimeManifest(manifest) {
  if (
    manifest?.schema !== 'nelyx.canvaskit/v2' ||
    manifest.source !== 'npm' ||
    manifest.version !== '0.42.0' ||
    manifest.initialMemoryBytes !== 128 * 1024 * 1024 ||
    manifest.maximumMemoryBytes !== 2 * 1024 * 1024 * 1024 ||
    manifest.adapterAbi !== 1 ||
    !Array.isArray(manifest.files) ||
    manifest.files.length !== 2 ||
    new Set(manifest.files.map((file) => file?.id)).size !== 2 ||
    manifest.files.some(
      (file) =>
        !['canvaskit.js', 'canvaskit.wasm'].includes(file?.id) ||
        file.path !== file.id ||
        !/^[a-f0-9]{64}$/.test(file.sha256),
    )
  )
    throw new Error('Invalid Web runtime manifest');
}

/** Publish the pinned default binaries from the renderer's npm dependency. */
export function readWebRuntime(runnerRoot) {
  const load = createRequire(path.resolve(runnerRoot, 'package.json'));
  const manifestPath = load.resolve('@nelyx/skia-web/native-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  checkWebRuntimeManifest(manifest);
  const packagePath = createRequire(manifestPath).resolve('canvaskit-wasm/package.json');
  const installed = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (installed.name !== 'canvaskit-wasm' || installed.version !== manifest.version)
    throw new Error('Installed canvaskit-wasm version differs from the Web runtime manifest');
  const runtimeRoot = path.dirname(packagePath);
  const runtime = manifest.files.map((file) => ({
    file,
    bytes: fs.readFileSync(localFile(runtimeRoot, 'bin/' + file.path)),
  }));
  for (const { file, bytes } of runtime)
    if (createHash('sha256').update(bytes).digest('hex') !== file.sha256)
      throw new Error('CanvasKit build artifact hash mismatch');
  const license = localFile(runtimeRoot, 'LICENSE');
  if (!fs.readFileSync(license).length) throw new Error('Missing CanvasKit license');
  return { manifest, runtime, license };
}
