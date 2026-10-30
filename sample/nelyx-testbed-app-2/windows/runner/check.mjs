// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const load = createRequire(import.meta.url),
  { createRunnerTypeScriptConfig } = load('@nelyx/metro/runner-config');
const config = createRunnerTypeScriptConfig({
  target: 'windows',
  runnerRoot: import.meta.dirname,
  appRoot: path.resolve(import.meta.dirname, '../..'),
});
config.include = ['main.tsx', 'App.tsx', '../../src/**/*.ts'];
fs.writeFileSync(
  new URL('tsconfig.generated.json', import.meta.url),
  JSON.stringify(config, null, 2) + '\n',
);
const result = spawnSync(
  process.execPath,
  [load.resolve('typescript/bin/tsc'), '-p', 'tsconfig.generated.json'],
  { cwd: import.meta.dirname, stdio: 'inherit', windowsHide: true },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
