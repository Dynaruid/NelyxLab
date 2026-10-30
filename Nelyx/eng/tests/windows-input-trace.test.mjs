// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
const timeout = 1_200_000;
function run(file, args, options = {}) {
  const result = spawnSync(file, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout,
    maxBuffer: 4 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, (result.stdout ?? '') + (result.stderr ?? ''));
  return result.stdout;
}
test(
  'Windows input observations allocate only when enabled, preserve their reader protocol and retire with their owner',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const vs = run(
      path.join(process.env['ProgramFiles(x86)'], 'Microsoft Visual Studio/Installer/vswhere.exe'),
      [
        '-latest',
        '-products',
        '*',
        '-requires',
        'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
        '-property',
        'installationPath',
      ],
    ).trim();
    assert(vs);
    const setup = run(
      process.env.ComSpec ?? 'cmd.exe',
      [
        '/d',
        '/s',
        '/c',
        '""' +
          path.join(vs, 'Common7/Tools/VsDevCmd.bat') +
          '" -arch=x64 -host_arch=x64 >nul && set"',
      ],
      { windowsVerbatimArguments: true },
    );
    const env = Object.fromEntries(
      Object.entries(process.env).map(([key, value]) => [key.toUpperCase(), value]),
    );
    for (const line of setup.split(/\r?\n/)) {
      const index = line.indexOf('=');
      if (index > 0) env[line.slice(0, index).toUpperCase()] = line.slice(index + 1);
    }
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-input-trace-'));
    try {
      const executable = path.join(directory, 'trace.exe');
      run(
        'cl.exe',
        [
          '/nologo',
          '/std:c++20',
          '/EHsc',
          '/MD',
          '/O2',
          '/DNOMINMAX',
          '/DWIN32_LEAN_AND_MEAN',
          '/Fe:' + executable,
          '/Fo:' + path.join(directory, 'trace.obj'),
          path.join(import.meta.dirname, 'windows-input-trace.cpp'),
          '/link',
          'user32.lib',
        ],
        { cwd: directory, env },
      );
      assert.match(
        run(executable, ['--disabled'], {
          cwd: directory,
          env: { ...env, NELYX_WINDOWS_INPUT_TRACE: '0' },
        }),
        /PASS input-trace disabled=1 allocated=0/,
      );
      async function readRecorder(mode, raw, verify) {
        const full = mode === '--full-reader',
          child = spawn(executable, [mode], {
            cwd: directory,
            env: {
              ...env,
              NELYX_WINDOWS_INPUT_TRACE: '1',
              NELYX_WINDOWS_INPUT_TRACE_FULL: full ? '1' : '0',
            },
            windowsHide: true,
            timeout,
          });
        let output = '',
          errors = '',
          ready;
        const admitted = new Promise((resolve) => {
          ready = resolve;
        });
        child.stdout.on('data', (chunk) => {
          output += chunk.toString();
          if (output.includes('INPUT_TRACE_READY pid=')) ready();
        });
        child.stderr.on('data', (chunk) => {
          errors += chunk.toString();
        });
        const completed = new Promise((resolve, reject) => {
          child.once('error', reject);
          child.once('close', (code) => resolve(code));
        });
        try {
          await Promise.race([
            admitted,
            completed.then(() => {
              throw Error('Native input recorder exited before admission: ' + errors);
            }),
          ]);
          const receipt = JSON.parse(
            run(
              'pwsh.exe',
              [
                '-NoProfile',
                '-NonInteractive',
                '-File',
                path.resolve(import.meta.dirname, '../windows-input-trace.ps1'),
                '-TargetProcessId',
                String(child.pid),
                ...(raw ? ['-Raw'] : []),
              ],
              { cwd: directory },
            ),
          );
          assert.equal(receipt.pid, child.pid);
          verify(receipt);
        } finally {
          assert.equal(await completed, 0, errors);
        }
        assert(
          output.includes(
            `PASS input-trace capacity=8192 sampleEvery=${full ? 1 : 16} latest=17 rareDrop=1 cleanup=1`,
          ),
        );
        console.log(output.trim());
      }
      await readRecorder('--reader', true, (receipt) => {
        assert.equal(receipt.retained, 3);
        assert.equal(receipt.stages.find((value) => value.stage === 'sdk-received').count, 17);
        assert.equal(receipt.entries.at(-1).stage, 'sdk-drop');
        assert.equal(receipt.entries.at(-1).input, 16);
      });
      await readRecorder('--full-reader', true, (receipt) => {
        assert.equal(receipt.sampleEvery, 1);
        assert.equal(receipt.retained, 18);
        assert.deepEqual(
          receipt.entries.slice(0, 17).map((value) => value.input),
          Array.from({ length: 17 }, (_, i) => i + 1),
        );
        assert.equal(receipt.entries.at(-1).stage, 'sdk-drop');
      });
      await readRecorder('--gesture-reader', false, (receipt) => {
        assert.equal(
          receipt.frameGaps.length,
          2,
          'Different surface generations must not form a frame gap',
        );
        const [actual, sampled] = receipt.frameGaps;
        assert.equal(actual.consecutiveSubmissions, true);
        assert.equal(actual.fromSubmission, 50);
        assert.equal(actual.toSubmission, 51);
        assert(actual.gapMs >= 650);
        assert.deepEqual(
          actual.transitions.map((event) => event.kind),
          ['panZoomEnd', 'inertiaCancel', 'panZoomStart'],
          'Terminal events must remain visible when evaluating a gap during continued physical motion',
        );
        assert.equal(actual.fromCoreInput, 10);
        assert.equal(actual.toCoreInput, 12);
        assert.equal(sampled.consecutiveSubmissions, false);
        assert.equal(sampled.submissionDelta, 16);
        assert(sampled.gapMs >= 300);
        assert.match(
          receipt.gapScope,
          /end\/cancel does not establish physical finger lift or normal idle/,
        );
      });
    } finally {
      assert.equal(path.dirname(directory), fs.realpathSync(os.tmpdir()));
      assert(path.basename(directory).startsWith('nelyx-input-trace-'));
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);
