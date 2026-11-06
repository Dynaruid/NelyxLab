// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { engineRoot, sourceIdentity } from './build.mjs';
const directory = path.join(engineRoot, 'dist');
const host = process.argv[2]?.replace(/^--host=/, '') ?? 'windows-hwnd';
if (process.argv.length > 3 || !['windows-hwnd', 'windows-app-sdk'].includes(host))
  throw new Error('Usage: run-windows.mjs [--host=windows-hwnd|windows-app-sdk]');
const profile = host === 'windows-app-sdk' ? 'windows-app-sdk' : 'native';
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'engine-manifest.json')));
if (manifest.sourceSha256 !== sourceIdentity() || !manifest.profiles?.[profile])
  throw new Error(
    'Engine v2 supply is stale or lacks the Windows host; run npm.cmd run build:engine-v2',
  );
for (const file of manifest.files) {
  const target = path.resolve(directory, file.path);
  if (
    !target.startsWith(directory + path.sep) ||
    createHash('sha256').update(fs.readFileSync(target)).digest('hex') !== file.sha256
  )
    throw new Error('Engine v2 supply identity mismatch: ' + file.path);
}
const executable =
  host === 'windows-app-sdk'
    ? 'windows-app-sdk/NelyxEngineAppSdkHost.exe'
    : 'native/NelyxEngineV2Host.exe';
const child = spawn(path.join(directory, executable), [directory], {
  stdio: 'inherit',
});
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
