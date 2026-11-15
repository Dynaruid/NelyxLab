// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareNativeApplication } from '../../../Nelyx/sdk/tooling/cli/src/windows-native-runner.mjs';

const app = path.resolve(import.meta.dirname, '..');
const root = path.resolve(app, '../..');

/** Reuse the repository's current supplier without duplicating its native libraries. */
export async function prepareDemoWindowsInputs(input) {
  const prepared = await prepareNativeApplication({
    app,
    nativeInputs: path.resolve(
      input ?? path.join(root, 'Nelyx/skia/vendor/inputs/windows-x64/source-inputs.json'),
    ),
    engineInputs: path.join(root, '.nelyx/windows-hermes'),
  });
  console.log(JSON.stringify(prepared));
  return prepared;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await prepareDemoWindowsInputs(process.argv[2]);
