// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { verifyWindowsPackage } from '../../sdk/tooling/cli/src/windows-runner.mjs';
import { startWindowsProcess } from '../../sdk/tooling/cli/src/windows-process.mjs';

const timeout = 1_200_000,
  root = path.resolve(import.meta.dirname, '../../..'),
  trials = process.env.NELYX_WINDOWS_MIXED_TRIALS
    ? process.env.NELYX_WINDOWS_MIXED_TRIALS.split(',').map(Number)
    : [1, 2, 3, 4];
if (
  !trials.length ||
  new Set(trials).size !== trials.length ||
  trials.some((n) => ![1, 2, 3, 4].includes(n))
)
  throw Error('NELYX_WINDOWS_MIXED_TRIALS must select distinct owners 1..4');
function helper(pid, buttonRange) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(import.meta.dirname, 'windows-mixed-input.ps1'),
        '-AppPid',
        String(pid),
        '-KoreanIme',
        ...(buttonRange ? ['-ButtonRange'] : []),
      ],
      { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '';
    const consume = (data) => {
      output = (output + data.toString()).slice(-256 * 1024);
    };
    child.stdout.on('data', consume);
    child.stderr.on('data', consume);
    const timer = setTimeout(() => child.kill(), timeout);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      process.stdout.write(output);
      if (code !== 0) reject(Error('Actual mixed input helper exited ' + code));
      else {
        const line = output.split(/\r?\n/).find((line) => line.startsWith('MIXED_INPUT '));
        if (!line) reject(Error('Actual mixed input report missing'));
        else {
          try {
            resolve(JSON.parse(line.slice('MIXED_INPUT '.length)));
          } catch (error) {
            reject(error);
          }
        }
      }
    });
  });
}
test(
  `Windows mixed input, Korean IME and native close for fresh owners ${trials.join(',')}; owner 4 checks button keys`,
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const locator = JSON.parse(
      fs.readFileSync(
        path.join(root, 'sample/nelyx-testbed-app-2/.nelyx/windows/last-package.json'),
        'utf8',
      ),
    );
    assert.equal(
      createHash('sha256')
        .update(fs.readFileSync(path.join(locator.directory, 'nelyx-package.json')))
        .digest('hex'),
      locator.manifestSha256,
    );
    const checked = verifyWindowsPackage(locator.directory);
    for (const trial of trials) {
      const buttonRange = trial === 4;
      let native = '';
      const child = startWindowsProcess(
        path.join(checked.directory, checked.manifest.executable),
        [],
        {
          cwd: checked.directory,
          env: {
            ...process.env,
            NELYX_WINDOWS_INPUT_TRACE: '1',
            NELYX_TRACKPAD_DIAGNOSTICS: '1',
            NELYX_WINDOWS_FRAME_DIAGNOSTICS: '1',
          },
          onOutput: (data) => {
            native = (native + data).slice(-64 * 1024);
          },
        },
      );
      try {
        const report = await helper(child.pid, buttonRange);
        assert.equal(report.fields, 12);
        assert.equal(report.buttons, 36);
        assert.equal(report.ime.status, 'PASS-scoped');
        assert.equal(report.ime.undoAfterCommit, true);
        assert.equal(
          report.checks.filter((row) =>
            buttonRange ? row.buttonKeysWithoutEditor : row.osKeyWithoutRefocus,
          ).length,
          3,
        );
        const close = await child.stop();
        assert.equal(close.exitCode, 0);
        assert.equal(close.forced, false);
        assert.match(native, /closed views=0 consumers=0 gpuDrained=1 inputRetired=1/);
        assert.doesNotMatch(native, /REACT_ERROR|close-failed|text-input-failed/);
        console.log('MIXED_OWNER_PASS', { trial, buttonRange, pid: child.pid, close });
      } finally {
        await child.stop();
        process.stdout.write(
          native
            .split(/\r?\n/)
            .filter((line) => /closed |close-failed|REACT_ERROR|text-input-failed/.test(line))
            .slice(-8)
            .join('\n') + '\n',
        );
      }
    }
  },
);
