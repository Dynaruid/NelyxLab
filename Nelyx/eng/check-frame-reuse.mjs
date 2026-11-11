// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { windowsCompilerEnvironment } from '../sdk/tooling/cli/src/windows-static-hermes.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const parent = path.join(root, '.nelyx');
fs.mkdirSync(parent, { recursive: true });
const temporary = fs.mkdtempSync(path.join(parent, 'frame-reuse-'));
if (!temporary.startsWith(parent + path.sep)) throw Error('Temporary check escaped its owner');
const env = windowsCompilerEnvironment();
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: temporary,
    env,
    encoding: 'utf8',
    timeout: 1_200_000,
    windowsHide: true,
  });
  if (result.error || result.status)
    throw Error(`${command}: ${result.error ?? result.status}\n${result.stdout}${result.stderr}`);
  return result.stdout;
}
try {
  run('cl.exe', [
    '/nologo',
    '/std:c++20',
    '/EHsc',
    '/MD',
    '/O2',
    '/DNOMINMAX',
    path.join(import.meta.dirname, 'check-frame-reuse.cpp'),
    path.join(import.meta.dirname, 'check-moving-list.cpp'),
    path.join(import.meta.dirname, 'check-date-layout.cpp'),
    path.join(import.meta.dirname, 'check-transaction-sharing.cpp'),
    path.join(import.meta.dirname, 'check-materialization.cpp'),
    path.join(import.meta.dirname, 'check-live-paint-activation.cpp'),
    path.join(import.meta.dirname, 'check-provider-admission.cpp'),
    path.resolve(
      process.argv.slice(2).find((arg) => arg.endsWith('.lib')) ??
        path.join(root, 'Nelyx/engine/dist/native/nelyx_engine_v2.lib'),
    ),
    '/Fe:check.exe',
  ]);
  console.log(run(path.join(temporary, 'check.exe'), []).trim());
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
