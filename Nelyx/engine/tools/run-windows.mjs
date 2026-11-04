// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { engineRoot, sourceIdentity } from './build.mjs';
const directory = path.join(engineRoot, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'engine-manifest.json')));
if (manifest.sourceSha256 !== sourceIdentity() || !manifest.profiles?.native)
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
const child = spawn(path.join(directory, 'native/NelyxEngineV2Host.exe'), [directory], {
  stdio: 'inherit',
});
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
