// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { engineRoot } from '../tools/build.mjs';
import { canvasKitSupply } from '../render/canvaskit-web/provider.ts';

/** Exercise the binary actually packaged for these hosts, without a fallback. */
export function canvasKitTestSupply() {
  const root = path.join(engineRoot, 'dist'),
    manifest = JSON.parse(fs.readFileSync(path.join(root, 'engine-manifest.json'))),
    selected = manifest.canvasKit;
  for (const [field, value] of Object.entries(canvasKitSupply))
    assert.equal(selected[field], value, 'Unexpected selected CanvasKit ' + field);
  const result = {};
  for (const field of ['js', 'wasm', 'sourceManifest']) {
    const file = path.resolve(root, selected[field]),
      entry = manifest.files.find((entry) => entry.path === selected[field]);
    assert.ok(file.startsWith(root + path.sep) && entry);
    assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'), entry.sha256);
    result[field] = file;
  }
  return result;
}
