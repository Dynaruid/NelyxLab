// SPDX-License-Identifier: BSD-3-Clause
import { spawnSync } from 'node:child_process';
import path from 'node:path';
if (process.platform !== 'win32')
  throw Error('Windows resize diagnostics require a Windows desktop');
const result = spawnSync(
  process.execPath,
  [
    '--test',
    '--test-timeout=1200000',
    path.join(import.meta.dirname, 'tests/windows-animation.test.mjs'),
  ],
  {
    cwd: path.resolve(import.meta.dirname, '../..'),
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      NELYX_ANIMATION_MODE: 'live-resize',
      NELYX_ANIMATION_TRACE: process.env.NELYX_ANIMATION_TRACE ?? '0',
      NELYX_ANIMATION_DRAG_HZ: process.env.NELYX_ANIMATION_DRAG_HZ ?? '61',
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
