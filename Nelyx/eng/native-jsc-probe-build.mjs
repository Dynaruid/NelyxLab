// SPDX-License-Identifier: BSD-3-Clause
// Diagnostic entry/output ownership stays with the caller. Compilation,
// inventory and package validation use the ordinary direct native product path.
import path from 'node:path';
import { buildNativeHost } from './build-native-hermes.mjs';
import { buildNativeApplication } from '../sdk/tooling/cli/src/windows-native-runner.mjs';
const root = path.resolve(import.meta.dirname, '../..');
export async function buildNativeJscProbe({
  app,
  output,
  diagnosticEntry,
  mode = 'interpreter',
  signal,
}) {
  const host = await buildNativeHost({
    app,
    engine: 'jsc',
    jscInputs: path.join(root, '.nelyx/windows-native-jsc'),
    signal,
  });
  return buildNativeApplication({
    app,
    engine: 'jsc',
    jscMode: mode,
    mode: 'source',
    hostBuild: host,
    output,
    diagnosticEntry,
    signal,
  });
}
