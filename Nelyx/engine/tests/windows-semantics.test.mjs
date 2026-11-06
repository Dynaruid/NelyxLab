// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { engineRoot, timeout } from '../tools/build.mjs';

test(
  'Current Windows UIA providers preserve mixed state, Radio selection and owner retirement',
  { timeout, skip: process.platform !== 'win32' },
  () => {
    const repo = path.resolve(engineRoot, '../..'),
      supplier = path.join(repo, 'Nelyx/skia/vendor/inputs/windows-x64'),
      parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'engine-semantics-'));
    let environment;
    const run = (file, args) => {
      const result = spawnSync(file, args, {
        cwd: directory,
        env: environment,
        encoding: 'utf8',
        windowsHide: true,
        timeout,
        maxBuffer: 2 * 1024 * 1024,
      });
      if (result.error) throw result.error;
      assert.equal(result.status, 0, result.stdout + result.stderr);
      return result.stdout;
    };
    try {
      environment = windowsCompilerEnvironment();
      const source = path.join(directory, 'main.cpp'),
        executable = path.join(directory, 'semantics.exe');
      fs.writeFileSync(
        source,
        `#include <windows.h>
#include <objbase.h>
#include <stdexcept>
#include <iostream>
void semanticsChecks();
void require(bool value,const char* message){if(!value)throw std::runtime_error(message);}
int main(){if(FAILED(CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED)))return 2;
int result=0;try{semanticsChecks();}catch(const std::exception& e){std::cerr<<e.what();result=1;}
CoUninitialize();return result;}
`,
      );
      const includes = [
        path.join(repo, 'Nelyx/sdk/native/windows-hermes'),
        path.join(repo, 'Nelyx/skia/native/core'),
        path.join(supplier, 'headers'),
        path.join(repo, '.nelyx/windows-hermes/source/API/jsi'),
        path.join(repo, '.nelyx/windows-hermes/source/API'),
        path.join(repo, '.nelyx/windows-hermes/source/public'),
      ];
      run('cl.exe', [
        '/nologo',
        '/std:c++20',
        '/EHsc',
        '/MD',
        '/utf-8',
        '/DNOMINMAX',
        '/DWIN32_LEAN_AND_MEAN',
        ...includes.map((value) => '/I' + value),
        source,
        path.join(repo, 'Nelyx/eng/tests/native-hermes-semantics.cpp'),
        path.join(repo, 'Nelyx/skia/native/core/paragraph_queries.cpp'),
        '/Fe' + executable,
        '/link',
        ...fs
          .readdirSync(path.join(supplier, 'libraries'))
          .filter((file) => file.endsWith('.lib'))
          .map((file) => path.join(supplier, 'libraries', file)),
        'user32.lib',
        'ole32.lib',
        'oleaut32.lib',
        'uuid.lib',
        'uiautomationcore.lib',
        'dwrite.lib',
        'gdi32.lib',
      ]);
      const output = run(executable, []);
      assert.match(output, /PASS native UIA patterns\/state/);
      console.log(output.trim());
    } finally {
      assert.equal(path.dirname(directory), parent);
      assert.match(path.basename(directory), /^engine-semantics-/);
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
    }
  },
);
