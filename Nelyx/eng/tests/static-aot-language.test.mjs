// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import {
  compileWindowsStaticHermes,
  verifyWindowsStaticHermes,
  windowsCompilerEnvironment,
} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { nativeCohort } from '../../sdk/dist/runtime/cohorts.js';
const timeout = 1_200_000;
test(
  'native dynamic classes, private fields, proxy/exception identity, iterators, collections and microtasks match source JS',
  { timeout, skip: process.platform !== 'win32' || !process.env.NELYX_STATIC_HERMES_INPUTS },
  async (t) => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-language-'));
    try {
      const source = path.join(folder, 'source.js'),
        text = fs.readFileSync(path.join(import.meta.dirname, 'static-aot-language.js'), 'utf8');
      const load = createRequire(import.meta.url),
        runner = path.resolve(
          import.meta.dirname,
          '../../../sample/nelyx-testbed-app-2/windows/runner',
        ),
        transformer = load('../../sdk/tooling/metro/src/native-hermes-transformer.cjs');
      const ast = transformer.transform({
        src: text,
        filename: path.join(runner, 'language-fixture.js'),
        options: {
          projectRoot: runner,
          platform: 'windows',
          dev: false,
          enableBabelRuntime: false,
        },
      }).ast;
      const generated = load('@babel/core').transformFromAstSync(ast, text, {
        configFile: false,
        babelrc: false,
      }).code;
      fs.writeFileSync(source, generated);
      const expected = JSON.parse(await vm.runInNewContext(text, {}, { timeout })),
        checked = verifyWindowsStaticHermes(process.env.NELYX_STATIC_HERMES_INPUTS),
        env = windowsCompilerEnvironment();
      const hermes = path.join(
          process.env.USERPROFILE,
          '.nuget/packages/microsoft.javascript.hermes/0.0.0-2604.21001-94aa5e1d',
        ),
        include = path.join(hermes, 'build/native/include');
      await compileWindowsStaticHermes({
        toolchain: checked.directory,
        source,
        output: path.join(folder, 'NelyxApp.aot.dll'),
        hermesDirectory: hermes,
        cohort: nativeCohort('windows'),
        signal: t.signal,
      });
      fs.copyFileSync(
        path.join(checked.directory, 'build/API/hermes_shared/hermes.dll'),
        path.join(folder, 'hermes.dll'),
      );
      fs.copyFileSync(
        path.join(hermes, 'build/native/win32/x64/hermes-icu.dll'),
        path.join(folder, 'hermes-icu.dll'),
      );
      const run = (file, args) => {
        const r = spawnSync(file, args, {
          cwd: folder,
          env,
          encoding: 'utf8',
          windowsHide: true,
          timeout,
          maxBuffer: 2 * 1024 ** 2,
        });
        assert.ifError(r.error);
        assert.equal(r.status, 0, r.stdout + r.stderr);
        return r.stdout + r.stderr;
      };
      const executable = path.join(folder, 'language.exe');
      run('cl.exe', [
        '/nologo',
        '/std:c++20',
        '/EHsc',
        '/MD',
        '/O2',
        '/DNDEBUG',
        '/I' + include,
        '/I' + path.join(include, 'node-api'),
        '/Fe' + executable,
        '/Fo' + path.join(folder, 'language.obj'),
        path.join(import.meta.dirname, 'static-aot-language.cpp'),
        '/link',
        path.join(checked.directory, 'build/API/hermes_shared/hermes.lib'),
      ]);
      const output = run(executable, []);
      assert.match(output, /PASS-native-language/);
      const line = output.split('\n').find((line) => line.startsWith('LANGUAGE_RESULT '));
      assert(line);
      assert.deepEqual(JSON.parse(line.slice('LANGUAGE_RESULT '.length)), expected);
    } finally {
      assert.equal(path.dirname(folder), fs.realpathSync(os.tmpdir()));
      assert(!fs.lstatSync(folder).isSymbolicLink());
      fs.rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  },
);
