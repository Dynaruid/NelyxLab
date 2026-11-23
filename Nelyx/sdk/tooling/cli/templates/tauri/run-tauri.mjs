// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Gradle and Xcode can call back with a different working directory and environment.
const host = import.meta.dirname;
const app = path.resolve(host, '../../..');
const cli = path.join(app, 'node_modules/@tauri-apps/cli/tauri.js');
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: app,
  env: { ...process.env, TAURI_APP_PATH: host, TAURI_FRONTEND_PATH: app },
  stdio: 'inherit',
  windowsHide: true,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
