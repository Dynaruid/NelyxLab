// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { engineRoot, sourceIdentity } from './build.mjs';
import { prepareRepositoryAppPackages } from '../../eng/prepare-app-packages.mjs';
import { prepareOriginalSample } from '../../../sample/prepare-engine-app.mjs';
const directory = path.join(engineRoot, 'dist');
if (process.argv.length > 2) throw new Error('Usage: run-windows.mjs');
const profile = 'windows-app-sdk';
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
const app = prepareOriginalSample('nelyx-testbed-app-2');
await buildEngineV2Application({ app, target: 'windows' });
const result = await engineV2Operation('run', { app, target: 'windows' });
process.exitCode = result.exitCode;
