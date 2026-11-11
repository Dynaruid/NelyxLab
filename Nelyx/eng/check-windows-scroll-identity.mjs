// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { engineRoot, sourceIdentity } from '../engine/tools/build.mjs';
import {
  verifyEngineV2Supply,
  verifyEngineV2Application,
  engineV2WindowsHost,
} from '../sdk/tooling/cli/src/engine-v2-runner.mjs';

const app = path.resolve(process.argv[2]);
const supply = verifyEngineV2Supply(path.join(engineRoot, 'dist'), 'windows', 'windows-app-sdk');
const bundle = verifyEngineV2Application(path.join(app, 'dist/v2-windows'), 'windows');
if (sourceIdentity() !== supply.manifest.sourceSha256)
  throw Error('Windows scroll check requires a rebuilt current engine supply');
if (bundle.supply.manifest.sourceSha256 !== supply.manifest.sourceSha256)
  throw Error('Windows app and current engine supply differ');
console.log(
  JSON.stringify({
    sourceSha256: supply.manifest.sourceSha256,
    abi: supply.manifest.abi,
    engineFiles: supply.manifest.files.length,
    appFiles: bundle.manifest.files.length,
    appJsSha256: bundle.manifest.files.find((file) => file.path === 'application/app.js').sha256,
    appHbcSha256: bundle.manifest.files.find((file) => file.path === 'application/app.hbc').sha256,
    executable: path.join(supply.root, engineV2WindowsHost().executable),
    bundle: bundle.root,
  }),
);
