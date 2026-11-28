// SPDX-License-Identifier: BSD-3-Clause
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDirectory } from './publication.mjs';

export const foregroundCrate = path.resolve(
  import.meta.dirname,
  '../templates/tauri/skia-foreground',
);
export const foregroundSupply = JSON.parse(
  fs.readFileSync(path.join(foregroundCrate, 'supply.json'), 'utf8'),
);

export async function foregroundBuildEnv(directory, target, signal) {
  const selected = foregroundSupply.targets[target];
  if (!selected) throw new Error('No native Skia foreground supply for ' + target);
  ensureDirectory(directory);
  const filename = `skia-binaries-${foregroundSupply.bindingRevision.slice(0, 20)}-${target}-jpegd-jpege-pdf.tar.gz`;
  const archive = path.join(directory, filename);
  const matches = (bytes) =>
    bytes.byteLength === selected.bytes &&
    createHash('sha256').update(bytes).digest('hex') === selected.sha256;
  if (!fs.existsSync(archive) || !matches(fs.readFileSync(archive))) {
    const url = `https://github.com/rust-skia/skia-binaries/releases/download/${foregroundSupply.bindingVersion}/${filename}`;
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]),
    });
    if (!response.ok) throw new Error('Skia binary download failed: ' + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!matches(bytes)) throw new Error('Skia binary does not match the pinned target digest');
    const temporary = path.join(directory, '.' + randomUUID());
    try {
      fs.writeFileSync(temporary, bytes, { flag: 'wx' });
      fs.renameSync(temporary, archive);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }
  // skia-bindings reads a native file path after removing the file:// prefix.
  return { SKIA_BINARIES_URL: 'file://' + archive };
}

export function cleanSkiaOverrides(env) {
  delete env.FORCE_SKIA_BUILD;
  delete env.SKIA_SOURCE_DIR;
  delete env.SKIA_LIBRARY_SEARCH_PATH;
  delete env.SKIA_DEBUG;
  delete env.DOCS_RS;
}
