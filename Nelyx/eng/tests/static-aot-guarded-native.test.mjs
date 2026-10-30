// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { automaticPartition } from '../../sdk/tooling/static-aot/src/type-policy.mjs';
import { compileWindowsStaticAot } from '../../sdk/tooling/cli/src/windows-static-aot.mjs';
import {
  verifyWindowsStaticHermes,
  windowsCompilerEnvironment,
} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { nativeCohort } from '../../sdk/dist/runtime/cohorts.js';
import vm from 'node:vm';
const timeout = 1_200_000,
  hash = (value) => createHash('sha256').update(value).digest('hex');
test(
  'automatically guarded scalar specialization matches native JS coercion and public subclass dispatch',
  { timeout, skip: !process.env.NELYX_STATIC_HERMES_INPUTS },
  async (t) => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-guarded-native-'));
    try {
      const runner = path.resolve(
          import.meta.dirname,
          '../../../sample/nelyx-testbed-app-2/windows/runner',
        ),
        entry = path.join(folder, 'entry.ts');
      const source = `function scalar(x:number):number{return x+1;} class Base{double(x:number):number{return x*2;}} class Derived extends Base{double(x:number):number{return x*3;}}
    (function(){const values:any[]=[2,'3',null,undefined,{valueOf(){return 4;}},NaN,-0,Infinity];const base=new Base(),derived=new Derived();(globalThis as any).languageResult=JSON.stringify({scalar:values.map(value=>scalar(value)),base:values.map(value=>base.double(value)),derived:values.map(value=>derived.double(value))});})();`;
      fs.writeFileSync(entry, source);
      const partition = automaticPartition({ entry, applicationRoot: folder, packageRoots: [] });
      assert.equal(partition.bindings.length, 3);
      const reference = ts.transpileModule(source, {
          compilerOptions: { target: ts.ScriptTarget.ES2022 },
        }).outputText,
        original = path.join(folder, 'source.js'),
        root = path.join(folder, 'root.js'),
        typed = path.join(folder, 'typed.ts'),
        plan = path.join(folder, 'plan.json');
      fs.writeFileSync(original, reference);
      fs.writeFileSync(typed, partition.source);
      const context = vm.createContext({});
      vm.runInContext(reference, context, { timeout });
      fs.writeFileSync(path.join(folder, 'expected.json'), context.languageResult);
      fs.writeFileSync(
        plan,
        JSON.stringify({
          schema: 'nelyx.typed-metro-plan/v1',
          files: [
            {
              file: root,
              sha256: hash(reference),
              bindings: partition.bindings,
              consumed: 'consumed-0.json',
            },
          ],
        }),
      );
      const load = createRequire(import.meta.url),
        transformer = load('../../sdk/tooling/metro/src/native-typed-transformer.cjs');
      const ast = transformer.transform({
        src: reference,
        filename: root,
        options: {
          platform: 'windows',
          dev: false,
          projectRoot: runner,
          enableBabelRuntime: false,
          customTransformOptions: {
            nelyxTypedPlan: fs.readFileSync(plan, 'utf8'),
            nelyxTypedPlanSha256: hash(fs.readFileSync(plan)),
          },
        },
      }).ast;
      fs.writeFileSync(
        root,
        load('@babel/core').transformFromAstSync(ast, reference, {
          configFile: false,
          babelrc: false,
        }).code,
      );
      const checked = verifyWindowsStaticHermes(process.env.NELYX_STATIC_HERMES_INPUTS),
        env = windowsCompilerEnvironment(),
        supplier = path.join(
          process.env.USERPROFILE,
          '.nuget/packages/microsoft.javascript.hermes/0.0.0-2604.21001-94aa5e1d',
        ),
        include = path.join(supplier, 'build/native/include');
      await compileWindowsStaticAot({
        toolchain: checked.directory,
        source: root,
        typedSource: typed,
        partitionSha256: partition.irSha256,
        output: path.join(folder, 'NelyxApp.aot.dll'),
        hermesDirectory: supplier,
        cohort: nativeCohort('windows'),
        signal: t.signal,
      });
      fs.copyFileSync(
        path.join(checked.directory, 'build/API/hermes_shared/hermes.dll'),
        path.join(folder, 'hermes.dll'),
      );
      fs.copyFileSync(
        path.join(supplier, 'build/native/win32/x64/hermes-icu.dll'),
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
        return r.stdout;
      };
      const exe = path.join(folder, 'guarded.exe');
      run('cl.exe', [
        '/nologo',
        '/std:c++20',
        '/EHsc',
        '/MD',
        '/O2',
        '/DNDEBUG',
        '/I' + include,
        '/I' + path.join(include, 'node-api'),
        '/Fe' + exe,
        '/Fo' + path.join(folder, 'guarded.obj'),
        path.join(import.meta.dirname, 'static-aot-language.cpp'),
        '/link',
        path.join(checked.directory, 'build/API/hermes_shared/hermes.lib'),
      ]);
      assert.match(run(exe, ['aot']), /PASS-native-language/);
      fs.writeFileSync(
        entry,
        'function dynamic(value:any){return value;} (globalThis as any).languageResult=JSON.stringify({dynamic:dynamic("ordinary-js")});',
      );
      const dynamic = automaticPartition({ entry, applicationRoot: folder, packageRoots: [] });
      assert.equal(dynamic.bindings.length, 0);
      fs.writeFileSync(typed, dynamic.source);
      fs.writeFileSync(
        root,
        ts.transpileModule(fs.readFileSync(entry, 'utf8'), {
          compilerOptions: { target: ts.ScriptTarget.ES2022 },
        }).outputText,
      );
      fs.writeFileSync(
        path.join(folder, 'expected.json'),
        JSON.stringify({ dynamic: 'ordinary-js' }),
      );
      await compileWindowsStaticAot({
        toolchain: checked.directory,
        source: root,
        typedSource: typed,
        partitionSha256: dynamic.irSha256,
        output: path.join(folder, 'NelyxApp.aot.dll'),
        hermesDirectory: supplier,
        cohort: nativeCohort('windows'),
        signal: t.signal,
        diagnosticMap: dynamic,
      });
      assert.match(run(exe, ['aot']), /PASS-native-language/);
    } finally {
      assert.equal(path.dirname(folder), fs.realpathSync(os.tmpdir()));
      assert(!fs.lstatSync(folder).isSymbolicLink());
      fs.rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  },
);
