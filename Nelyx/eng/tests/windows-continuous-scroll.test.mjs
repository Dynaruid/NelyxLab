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
    for (const page of ['material', 'list', 'cupertino', 'mixed']) {
      const run = () =>
        spawnSync(
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
      let result = run();
      process.stdout.write((result.stdout ?? '') + (result.stderr ?? ''));
      if (result.status !== 0 && !result.error) {
        const line = result.stdout
          ?.split(/\r?\n/)
          .find((row) => row.startsWith('CONTINUOUS_FAILURE '));
        const failure = line ? JSON.parse(line.slice('CONTINUOUS_FAILURE '.length)) : undefined;
        // A leg without foreground ownership never injected valid input. Permit
        // one fresh owner; never retry native failures, stalls or bad exit.
        if (failure?.alive && !failure.foreground && /foreground/i.test(failure.message)) {
          process.stdout.write('CONTINUOUS_OWNER_RETRY ' + page + '\n');
          result = run();
          process.stdout.write((result.stdout ?? '') + (result.stderr ?? ''));
        }
      }
      if (result.error) throw result.error;
      assert.equal(result.status, 0, page + ' actual package scroll/close failed');
    }
  },
);

test(
  'maximized Gallery keeps moving through window transitions and both wheel directions in three fresh owners',
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
    for (let trial = 1; trial <= 3; trial++) {
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
          'material',
          '-WindowTransitions',
          '-Maximized',
          '-MouseMotion',
          '-InputDurationMs',
          '5000',
          '-InputXFraction',
          '0.667',
        ],
        { cwd: root, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 512 * 1024 },
      );
      process.stdout.write((result.stdout ?? '') + (result.stderr ?? ''));
      if (result.error) throw result.error;
      assert.equal(result.status, 0, 'maximized Gallery owner ' + trial);
      const line = result.stdout.split(/\r?\n/).find((row) => row.startsWith('CONTINUOUS_SCROLL '));
      assert.ok(line, 'maximized Gallery report');
      const report = JSON.parse(line.slice('CONTINUOUS_SCROLL '.length));
      assert.equal(report.drained, true);
      assert.equal(report.exitCode, 0);
      assert.equal(report.checks.length, 2);
      assert.ok(
        report.checks.every((check) => check.primingPackets === 80 && check.maximumGapMs <= 350),
      );
      console.log('MAXIMIZED_GALLERY_PASS', {
        trial,
        gaps: report.checks.map((check) => check.maximumGapMs),
      });
    }
  },
);
