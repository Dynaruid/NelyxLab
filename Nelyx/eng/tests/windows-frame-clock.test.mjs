// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
const timeout = 1_200_000;
function run(file, args, options = {}) {
  const result = spawnSync(file, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout,
    ...options,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, (result.stdout ?? '') + (result.stderr ?? ''));
  return result.stdout;
}
test(
  'Windows refresh deadlines wake from idle independently of compositor activity and stop their worker',
  { timeout, skip: process.platform !== 'win32' },
  () => {
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
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-frame-clock-'));
    try {
      const executable = path.join(directory, 'clock.exe');
      run(
        'cl.exe',
        [
          '/nologo',
          '/std:c++20',
          '/EHsc',
          '/MD',
          '/O2',
          '/DNOMINMAX',
          '/Fe:' + executable,
          '/Fo:' + path.join(directory, 'clock.obj'),
          path.join(import.meta.dirname, 'windows-frame-clock.cpp'),
        ],
        { cwd: directory, env },
      );
      const result = run(executable, [], { cwd: directory });
      assert.match(
        result,
        /PASS clock=dwm-timing ticks=[89] idle=1 maximumRequestMs=[\d.]+ stopped=1/,
      );
      console.log(result.trim());
    } finally {
      assert.equal(path.dirname(directory), fs.realpathSync(os.tmpdir()));
      assert(path.basename(directory).startsWith('nelyx-frame-clock-'));
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);
