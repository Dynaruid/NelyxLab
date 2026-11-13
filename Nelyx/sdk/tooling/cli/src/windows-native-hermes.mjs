// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { prepareNativeHermes as prepare } from './windows-native-hermes-toolchain.mjs';
import { windowsCompilerEnvironment } from './windows-static-hermes.mjs';
export { windowsNativeHermesPin as nativeHermesPin } from './windows-native-hermes-pin.mjs';

/** Retain the original preparation entry point with the current verified supplier. */
export async function prepareNativeHermes({ directory = '.nelyx/windows-hermes', signal } = {}) {
  const result = await prepare({ directory, signal });
  return {
    ...result,
    source: path.join(result.directory, 'source'),
    build: path.join(result.directory, 'build'),
    env: windowsCompilerEnvironment(),
  };
}
