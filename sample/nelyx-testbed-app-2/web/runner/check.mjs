// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url),
  config = load('@nelyx/metro/web-config').createWebRunnerTypeScriptConfig({
    runnerRoot: import.meta.dirname,
    appRoot: path.resolve(import.meta.dirname, '../..'),
  });
fs.writeFileSync(
  new URL('tsconfig.generated.json', import.meta.url),
  JSON.stringify(config, null, 2) + '\n',
);
const { runTypeScriptCompiler } = load('@nelyx/metro/typescript-compiler');
const result = runTypeScriptCompiler(import.meta.dirname, ['-p', 'tsconfig.generated.json']);
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.status;
