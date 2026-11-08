// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { engineRoot, sourceIdentity } from './build.mjs';
import { prepareRepositoryAppPackages } from '../../eng/prepare-app-packages.mjs';
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
prepareRepositoryAppPackages();
const { buildEngineV2Application, engineV2Operation } =
  await import('../../sdk/tooling/cli/src/engine-v2-runner.mjs');
const app = path.resolve(engineRoot, '../../sample/nelyx-testbed-app-2/engine-v2');
await buildEngineV2Application({ app, target: 'windows', windowsHost: host });
const result = await engineV2Operation('run', { app, target: 'windows' });
process.exitCode = result.exitCode;
