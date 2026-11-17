// SPDX-License-Identifier: BSD-3-Clause
// Compile the existing RN JSC adapter against both its own and the direct
// host's JSI headers. This is an ABI admission diagnostic, not a VM benchmark.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { windowsCompilerEnvironment } from '../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { patchJscMicrotasks, windowsJscPin } from '../sdk/tooling/cli/src/windows-jsc.mjs';
import { patchNativeJscAdapter } from '../sdk/tooling/cli/src/native-jsc-adapter.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const runtimeAdmission = process.argv.includes('--runtime');
if (!process.argv.includes('--child')) {
  try {
    await execute(
      process.execPath,
      [import.meta.filename, '--child', ...(runtimeAdmission ? ['--runtime'] : [])],
      {
        cwd: root,
        timeout: 1_200_000,
      },
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
} else {
  const parent = path.join(root, '.tmp'),
    temporary = fs.mkdtempSync(path.join(parent, 'jsc-host-abi-')),
    deadline = Date.now() + 1_200_000,
    remaining = () => {
      assert(Date.now() < deadline, 'JSC ABI diagnostic exceeded 20 minutes');
      return deadline - Date.now();
    };
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  try {
    const producer = fs.readFileSync(
        path.join(root, 'Nelyx/sdk/tooling/cli/src/windows-jsc.mjs'),
        'utf8',
      ),
      hashes = producer.match(/const headerHashes = \{([\s\S]*?)\n\};/)?.[1];
    assert(hashes, 'Missing current JSC header pin');
    const headers = [...hashes.matchAll(/'([^']+)': '([a-f0-9]{64})'/g)];
    assert.equal(headers.length, 8);
    const include = path.join(temporary, 'include');
    fs.mkdirSync(path.join(include, 'JavaScriptCore'), { recursive: true });
    await Promise.all(
      headers.map(async ([, name, expected]) => {
        assert.equal(path.basename(name), name);
        const response = await fetch(
          `https://raw.githubusercontent.com/WebKit/WebKit/${windowsJscPin.revision}/Source/JavaScriptCore/API/${name}`,
          { signal: AbortSignal.timeout(Math.min(120_000, remaining())) },
        );
        assert(response.ok, 'Pinned JSC header download failed: ' + name);
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal(digest(bytes), expected, 'Pinned JSC header differs: ' + name);
        fs.writeFileSync(path.join(include, 'JavaScriptCore', name), bytes);
      }),
    );
    const runner = path.join(root, 'sample/nelyx-demo-app/windows/runner'),
      load = createRequire(path.join(runner, 'package.json')),
      rn = path.dirname(load.resolve('react-native/package.json')),
      direct = path.join(root, '.nelyx/windows-hermes/source/API/jsi'),
      adapterSource = fs.readFileSync(path.join(rn, 'ReactCommon/jsc/JSCRuntime.cpp'), 'utf8'),
      adapter = path.join(temporary, 'JSCRuntime.cpp');
    fs.writeFileSync(
      adapter,
      runtimeAdmission ? patchNativeJscAdapter(adapterSource) : patchJscMicrotasks(adapterSource),
    );
    const env = windowsCompilerEnvironment(),
      results = [];
    for (const [name, jsi] of [
      ['rnw', path.join(rn, 'ReactCommon/jsi')],
      ['direct-host', direct],
    ]) {
      const result = spawnSync(
        'cl.exe',
        [
          '/nologo',
          '/std:c++20',
          '/EHsc',
          '/MD',
          '/O2',
          '/DNDEBUG',
          '/DNOMINMAX',
          '/D_WINDOWS',
          '/c',
          '/I' + jsi,
          '/I' + path.join(rn, 'ReactCommon'),
          '/I' + path.join(rn, 'ReactCommon/jsc'),
          '/I' + include,
          adapter,
          '/Fo:' + path.join(temporary, name + '.obj'),
        ],
        {
          cwd: temporary,
          env,
          timeout: remaining(),
          windowsHide: true,
          encoding: 'utf8',
          maxBuffer: 4 * 1024 * 1024,
        },
      );
      if (result.error) throw result.error;
      const errors = (result.stdout + result.stderr)
        .split(/\r?\n/)
        .filter((line) => /(?:fatal )?error C\d+/.test(line))
        .map((line) =>
          line.replaceAll(temporary, '<probe>').replaceAll(root, '<repo>').slice(0, 900),
        );
      results.push({
        target: name,
        compiled: result.status === 0,
        exitCode: result.status,
        jsiHeaderSha256: digest(fs.readFileSync(path.join(jsi, 'jsi/jsi.h'))),
        diagnostics: errors.slice(0, 8),
        errorCount: errors.length,
      });
    }
    // A positive control is required before interpreting an incompatibility.
    assert(results[0].compiled, JSON.stringify(results[0]));
    console.log(
      'JSC_HOST_ABI ' +
        JSON.stringify({
          kind: 'compile-only',
          runtimeExecuted: false,
          performanceSample: false,
          webkitRevision: windowsJscPin.revision,
          adapterSha256: digest(adapterSource),
          results,
        }),
    );
    if (runtimeAdmission) {
      assert(results[1].compiled, JSON.stringify(results[1]));
      const browser = path.join(process.env.LOCALAPPDATA, 'ms-playwright/webkit-2272'),
        vm = path.join(browser, 'JavaScriptCore.dll');
      assert.equal(digest(fs.readFileSync(vm)), windowsJscPin.runtimeSha256);
      const run = (command, args) => {
        const result = spawnSync(command, args, {
          cwd: temporary,
          env,
          encoding: 'utf8',
          windowsHide: true,
          timeout: remaining(),
          maxBuffer: 4 * 1024 * 1024,
        });
        if (result.error) throw result.error;
        if (result.status !== 0) throw Error((result.stdout + result.stderr).slice(-12000));
        return result.stdout;
      };
      const exports = run('dumpbin.exe', ['/exports', vm]),
        symbols = [...exports.matchAll(/^\s+\d+\s+[A-F0-9]+\s+[A-F0-9]+\s+(JS\w+)\s*$/gm)].map(
          (match) => match[1],
        );
      for (const symbol of [
        'JSLock',
        'JSUnlock',
        'JSGlobalContextSetUnhandledRejectionCallback',
        'JSGlobalContextSetEvalEnabled',
      ])
        assert(symbols.includes(symbol), 'Missing JSC native service: ' + symbol);
      const definition = path.join(temporary, 'JavaScriptCore.def'),
        library = path.join(temporary, 'JavaScriptCore.lib');
      fs.writeFileSync(
        definition,
        'LIBRARY JavaScriptCore.dll\nEXPORTS\n' +
          symbols.join('\n') +
          '\nkJSClassDefinitionEmpty DATA\n',
      );
      run('lib.exe', ['/NOLOGO', '/MACHINE:X64', '/DEF:' + definition, '/OUT:' + library]);
      const images = [];
      for (const name of ['JavaScriptCore.dll', 'icuin77.dll', 'icuuc77.dll', 'icudt77.dll']) {
        const source = path.join(browser, name);
        fs.copyFileSync(source, path.join(temporary, name));
        images.push({ name, sha256: digest(fs.readFileSync(source)) });
      }
      const executable = path.join(temporary, 'direct-jsc-admission.exe');
      run('cl.exe', [
        '/nologo',
        '/std:c++20',
        '/EHsc',
        '/MD',
        '/O2',
        '/DNDEBUG',
        '/DNOMINMAX',
        '/D_WINDOWS',
        '/I' + direct,
        '/I' + path.join(rn, 'ReactCommon'),
        '/I' + path.join(rn, 'ReactCommon/jsc'),
        '/I' + include,
        '/I' + path.join(root, 'Nelyx/sdk/native/windows'),
        '/I' + path.join(root, 'Nelyx/sdk/native/windows-jsc'),
        '/I' + path.join(root, 'Nelyx/sdk/native/windows-hermes'),
        '/I' + path.join(runner, 'node_modules/@nelyx/skia-native/cpp'),
        '/I' + path.join(runner, 'node_modules/@nelyx/skia-native/generated/host'),
        adapter,
        path.join(root, 'Nelyx/eng/fixtures/native-jsc-admission.cpp'),
        '/Fe:' + executable,
        '/Fo:' + temporary + '\\',
        '/link',
        library,
        path.join(root, '.nelyx/windows-hermes/build/jsi/jsi.lib'),
      ]);
      for (const mode of ['interpreter', 'jit']) {
        fs.writeFileSync(path.join(temporary, 'jsc-mode.txt'), mode + '\n');
        console.log(
          'JSC_DIRECT_RUNTIME ' +
            JSON.stringify({
              mode,
              images,
              output: run(executable, []).trim(),
              performanceSample: false,
            }),
        );
      }
    }
  } finally {
    assert.equal(path.dirname(fs.realpathSync(temporary)), fs.realpathSync(parent));
    assert(!fs.lstatSync(temporary).isSymbolicLink());
    fs.rmSync(temporary, { recursive: true, force: true });
    console.log('JSC_HOST_ABI_CLEANUP_DONE');
  }
}
