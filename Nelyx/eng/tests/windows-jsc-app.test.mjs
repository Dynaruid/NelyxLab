// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { buildWindows, verifyWindowsPackage } from '../../sdk/tooling/cli/src/windows-runner.mjs';
import { startWindowsProcess } from '../../sdk/tooling/cli/src/windows-process.mjs';

const timeout = 1_200_000;
test(
  'JSC JIT and interpreter run the real Testbed, respond and close all native owners',
  {
    timeout,
    skip: process.platform !== 'win32' || process.env.NELYX_TEST_JSC_APP !== '1',
  },
  async (t) => {
    const app = path.resolve(import.meta.dirname, '../../../sample/nelyx-testbed-app-2'),
      base = fs.realpathSync(path.join(app, '.nelyx/windows'));
    const temporary = fs.mkdtempSync(path.join(base, 'jsc-app-')),
      env = windowsCompilerEnvironment();
    const compile = (file, args) => {
      const result = spawnSync(file, args, {
        env,
        cwd: temporary,
        encoding: 'utf8',
        windowsHide: true,
        timeout,
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stdout + result.stderr);
    };
    try {
      const helper = path.join(temporary, 'app-debug.exe');
      compile('cl.exe', [
        '/nologo',
        '/std:c++20',
        '/EHsc',
        '/MD',
        '/O2',
        path.join(import.meta.dirname, 'windows-app-debug.cpp'),
        '/Fe:' + helper,
        '/Fo:' + temporary + '\\',
        '/link',
        'dbghelp.lib',
        'psapi.lib',
        'user32.lib',
      ]);
      for (const mode of ['jit', 'interpreter']) {
        const directory = path.join(base, 'packages/Release');
        let current;
        try {
          current = verifyWindowsPackage(directory);
        } catch {}
        if (current?.manifest.cohort.engine !== 'jsc' || current.manifest.jscExecutionMode !== mode)
          await buildWindows({ app, engine: 'jsc', jscMode: mode, signal: t.signal });
        const verified = verifyWindowsPackage(directory);
        assert.equal(verified.manifest.jscExecutionMode, mode);
        assert.equal(fs.readFileSync(path.join(directory, 'jsc-mode.txt'), 'utf8'), mode + '\n');
        assert(
          fs.existsSync(path.join(directory, 'licenses/JSC-COPYING.LIB')),
          'LGPL notice must survive the native .lib output filter',
        );
        let output = '';
        const debuggerProcess = spawn(helper, [path.join(directory, 'NelyxRNHost.exe')], {
          cwd: directory,
          env,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const collect = (chunk) => {
          output = (output + chunk.toString()).slice(-4 * 1024 ** 2);
        };
        debuggerProcess.stdout.on('data', collect);
        debuggerProcess.stderr.on('data', collect);
        const abort = () => debuggerProcess.kill();
        t.signal.addEventListener('abort', abort, { once: true });
        try {
          assert.equal(
            await new Promise((resolve, reject) => {
              debuggerProcess.once('error', reject);
              debuggerProcess.once('close', resolve);
            }),
            0,
            output.slice(-16000),
          );
        } finally {
          t.signal.removeEventListener('abort', abort);
        }
        assert.match(output, /first-content-ready/);
        assert.match(output, /closed views=0 consumers=0 gpuDrained=1 inputRetired=1/);
        assert.match(output, /INSTANCE_DESTROYED/);
        assert.match(output, /APP_DEBUG_EXIT 0/);
        assert.doesNotMatch(output, /REACT_ERROR|APP_DEBUG_FAULT/);
        // A debug event suspends the UI thread. Check responsiveness separately
        // in the normal process path, after the window becomes visible.
        const child = startWindowsProcess(path.join(directory, 'NelyxRNHost.exe'), [], {
          cwd: directory,
        });
        let window;
        try {
          for (let attempt = 0; attempt < 20; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            const inspected = spawnSync(
              'powershell.exe',
              [
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                `$p=Get-Process -Id ${child.pid} -ErrorAction Stop; [pscustomobject]@{title=$p.MainWindowTitle;responding=$p.Responding;modules=@($p.Modules | Where-Object ModuleName -in @('JavaScriptCore.dll','v8jsi.dll') | ForEach-Object ModuleName)} | ConvertTo-Json -Compress`,
              ],
              { encoding: 'utf8', windowsHide: true, timeout },
            );
            if (inspected.status === 0) {
              window = JSON.parse(inspected.stdout);
              if (window.title === 'NelyxTestbed2' && window.responding) break;
            }
          }
          assert.equal(window?.title, 'NelyxTestbed2');
          assert.equal(window?.responding, true);
          assert.deepEqual(window.modules, ['JavaScriptCore.dll']);
        } finally {
          const result = await child.stop();
          assert.equal(result.forced, false);
          assert.equal(result.exitCode, 0);
        }
        console.log(
          'JSC_APP_PASS ' +
            JSON.stringify({
              mode,
              window,
              firstContentReady: true,
              closedOwners: true,
              normalExit: 0,
              files: verified.files,
            }),
        );
      }
    } finally {
      assert.equal(path.dirname(fs.realpathSync(temporary)), base);
      assert(path.basename(temporary).startsWith('jsc-app-'));
      assert(!fs.lstatSync(temporary).isSymbolicLink());
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  },
);
