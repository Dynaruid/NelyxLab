// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { execute } from '../../sdk/tooling/cli/src/commands.mjs';
import {
  ensureDirectory,
  removeDirectory,
  withSignals,
} from '../../sdk/tooling/cli/src/publication.mjs';

const root = path.resolve(import.meta.dirname, '..');
const output = path.resolve(root, '../sdk/src/backends/generated/tauri.ts');
const cache = ensureDirectory(path.join(root, '.cache'));
const read = (file) => fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');

await withSignals(async (signal) => {
  const stage = fs.mkdtempSync(path.join(cache, '.bindings-'));
  const generated = path.join(stage, 'tauri.ts');
  try {
    await execute(
      'cargo',
      [
        'run',
        '--locked',
        '--manifest-path',
        'Cargo.toml',
        '--package',
        'tauri-plugin-nelyx-backend',
        '--features',
        'generate-bindings',
        '--example',
        'export-bindings',
        '--',
        generated,
      ],
      {
        cwd: root,
        signal,
        env: { ...process.env, CARGO_TARGET_DIR: path.join(cache, 'bindings-cargo') },
      },
    );
    if (process.argv.includes('--write')) {
      ensureDirectory(path.dirname(output));
      fs.writeFileSync(output, read(generated));
    } else if (read(output) !== read(generated)) {
      throw new Error('SDK Tauri bindings are stale. Run npm run generate:backend-bindings.');
    }
  } finally {
    removeDirectory(stage, cache);
  }
});
