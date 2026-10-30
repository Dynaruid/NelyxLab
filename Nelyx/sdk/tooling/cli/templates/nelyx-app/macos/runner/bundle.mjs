// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const load = createRequire(import.meta.url);
const target = path.basename(path.dirname(import.meta.dirname));
const output = path.join(import.meta.dirname, '.bundle');
fs.mkdirSync(output, { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    load.resolve('@react-native-community/cli/build/bin.js'),
    'bundle',
    '--config',
    'metro.config.cjs',
    '--platform',
    target,
    '--entry-file',
    'main.ts',
    '--bundle-output',
    path.join(output, `index.${target}.bundle`),
    '--sourcemap-output',
    path.join(output, `index.${target}.bundle.map`),
    '--assets-dest',
    path.join(output, 'assets'),
    '--dev',
    'false',
    '--minify',
    'true',
    '--max-workers',
    '2',
  ],
  { cwd: import.meta.dirname, stdio: 'inherit', windowsHide: true },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
