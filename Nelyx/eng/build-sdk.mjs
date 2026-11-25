// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { buildPackage } from './build-packages.mjs';
import { withSdkLock, workspaceRoot as root } from './sdk-lock.mjs';
import { buildRustSupply } from '../backend/eng/build-supply.mjs';
import { sha256 } from '../sdk/tooling/contracts/src/node-files.mjs';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { withSignals } from '../sdk/tooling/cli/src/publication.mjs';
import {
  buildStage,
  fingerprint,
  hashTree,
  readBuildState,
  writeBuildState,
} from '../sdk/tooling/cli/src/build-cache.mjs';

/** Called while the workspace SDK publication lock is held. */
export async function buildSdk(signal) {
  for (const name of ['core', 'cupertino', 'material', 'tooling-contracts', 'skia-web', 'sdk'])
    buildPackage(name, signal);
  const start = performance.now();
  const generator = path.join(import.meta.dirname, 'generate-providers.mjs');
  const sdk = path.join(root, 'Nelyx', 'sdk');
  const state = path.join(sdk, '.cache', 'provider-build.json');
  const output = path.join(sdk, 'providers');
  const key = fingerprint(
    [
      generator,
      path.join(root, 'Nelyx/dist/version.js'),
      path.join(sdk, 'dist/version.js'),
      ...['providers', 'compatibility', 'cohorts'].map((name) =>
        path.join(sdk, 'dist/runtime', name + '.js'),
      ),
    ].map(sha256),
  );
  const previous = readBuildState(state);
  const hit =
    previous?.key === key &&
    fs.existsSync(output) &&
    fingerprint(hashTree(output)) === previous.output;
  if (!hit) {
    await execute(process.execPath, [generator], { cwd: root, signal });
    writeBuildState(state, { key, output: fingerprint(hashTree(output)) });
  }
  buildStage('provider-metadata', start, {
    calls: hit ? 0 : 1,
    reason: hit ? 'verified output reused' : 'inputs or outputs changed',
  });
  await buildRustSupply(signal);
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename)
  await withSignals((signal) => withSdkLock(() => buildSdk(signal)));
