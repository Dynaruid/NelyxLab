// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
const app = path.resolve(import.meta.dirname, '../..'),
  last = JSON.parse(fs.readFileSync(path.join(app, '.nelyx/windows/last-build.json'), 'utf8'));
const executable = path.join(app, 'windows/x64/Release/NelyxRNHost.exe');
if (
  last.schema !== 'nelyx.rnw-build/v1' ||
  last.executable !== executable ||
  createHash('sha256').update(fs.readFileSync(executable)).digest('hex') !== last.exeSha256
)
  throw new Error('Run requires the current verified RNW build');
const child = spawn(executable, [], {
  cwd: path.dirname(executable),
  stdio: 'inherit',
  windowsHide: true,
});
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
