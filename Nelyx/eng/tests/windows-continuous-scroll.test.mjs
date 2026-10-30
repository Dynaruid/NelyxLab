// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyWindowsPackage } from '../../sdk/tooling/cli/src/windows-runner.mjs';
import { verifyWindowsRuntime } from '../../sdk/tooling/cli/src/windows-process.mjs';

const timeout = 1_200_000,
  root = path.resolve(import.meta.dirname, '../../..');
test(
  'current Windows package scrolls during continuous OS input and seals a prompt native window close',
  { timeout, skip: process.platform !== 'win32' },
  () => {
    const locator = JSON.parse(
      fs.readFileSync(
        path.join(root, 'sample/nelyx-testbed-app-2/.nelyx/windows/last-package.json'),
        'utf8',
      ),
    );
    const checked = verifyWindowsPackage(locator.directory);
    verifyWindowsRuntime(checked.directory);
    // Each page owns one process, an uninterrupted wheel stream and native-only
    // screen sampling. No UIA/JS reads pace input or wait for each scroll frame.
    for (const page of ['material', 'list', 'cupertino']) {
      const result = spawnSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          path.join(import.meta.dirname, 'windows-continuous-scroll.ps1'),
          '-Executable',
          path.join(checked.directory, checked.manifest.executable),
          '-Page',
          page,
          ...(page === 'material' ? ['-WindowTransitions', '-MouseMotion'] : []),
        ],
        { cwd: root, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 256 * 1024 },
      );
      process.stdout.write((result.stdout ?? '') + (result.stderr ?? ''));
      if (result.error) throw result.error;
      assert.equal(result.status, 0, page + ' actual package scroll/close failed');
    }
  },
);
