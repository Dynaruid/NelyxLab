// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNativeHost as build } from '../sdk/tooling/cli/src/windows-native-host.mjs';
export { verifyNativeHermes } from '../sdk/tooling/cli/src/windows-native-hermes-toolchain.mjs';
export const root = path.resolve(import.meta.dirname, '../..');
export function buildNativeHost(options = {}) {
  return build({
    app: path.join(root, 'sample/nelyx-testbed-app-2'),
    engineInputs: path.join(root, '.nelyx/windows-hermes'),
    nativeInputs: path.join(root, 'Nelyx/skia/vendor/inputs/windows-x64/vendor-inputs.json'),
    ...options,
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))
  try {
    const result = await buildNativeHost();
    console.log(
      JSON.stringify({
        directory: result.directory,
        sourceSha256: result.manifest.sourceSha256,
        toolchainSha256: result.manifest.toolchainSha256,
      }),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
