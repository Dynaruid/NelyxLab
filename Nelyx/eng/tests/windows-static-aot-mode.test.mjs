// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { verifyStaticAotApplication } from '../../sdk/tooling/cli/src/windows-static-aot.mjs';
import { windowsHermesExecutionMode } from '../../sdk/tooling/cli/src/windows-aot-mode.mjs';
import {
  prepareWindows,
  buildWindows,
  verifyWindowsPackage,
  packWindows,
} from '../../sdk/tooling/cli/src/windows-runner.mjs';
import { verifyWindowsRuntime } from '../../sdk/tooling/cli/src/windows-process.mjs';
const timeout = 1_200_000;

test(
  'static-aot is canonical and retired mode names are rejected without aliases',
  { timeout },
  async () => {
    assert.equal(windowsHermesExecutionMode(), 'bytecode');
    assert.equal(windowsHermesExecutionMode('static-aot'), 'static-aot');
    for (const mode of ['typed-aot', 'aot', 'other', '', null, false])
      assert.throws(
        () => windowsHermesExecutionMode(mode),
        /Choose Windows --hermes-mode bytecode or static-aot/,
      );
    // Rejection happens before nonexistent app/native inputs can be opened.
    await assert.rejects(
      prepareWindows({ app: 'not-an-application', hermesMode: 'typed-aot' }),
      /Choose/,
    );
    await assert.rejects(buildWindows({ app: 'not-an-application', hermesMode: 'aot' }), /Choose/);
    await assert.rejects(
      prepareWindows({ app: 'not-an-application', engine: 'v8', hermesMode: 'static-aot' }),
      /requires --engine hermes and Release/,
    );
    await assert.rejects(
      buildWindows({ app: 'not-an-application', configuration: 'Debug', hermesMode: 'static-aot' }),
      /requires --engine hermes and Release/,
    );
    await import('@nelyx/static-aot/source-graph');
    await import('@nelyx/cli/windows-static-aot');
    await assert.rejects(import('@nelyx/typed-aot/source-graph'), { code: 'ERR_MODULE_NOT_FOUND' });
    await assert.rejects(import('@nelyx/cli/windows-typed-hermes'), {
      code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    });
  },
);

test('sample and generated Windows runners share the canonical mode contract', { timeout }, () => {
  const source = fs.readFileSync(
    path.join(
      import.meta.dirname,
      '../../sdk/tooling/cli/templates/nelyx-app/windows/runner/build.mjs',
    ),
  );
  const sample = fs.readFileSync(
    path.join(import.meta.dirname, '../../../sample/nelyx-testbed-app-2/windows/runner/build.mjs'),
  );
  assert.deepEqual(sample, source);
});

test(
  'the current native package carries only the canonical mode',
  { timeout, skip: !process.env.NELYX_STATIC_AOT_PACKAGE },
  async () => {
    const directory = process.env.NELYX_STATIC_AOT_PACKAGE,
      manifestFile = path.join(directory, 'nelyx-package.json');
    const before = fs.readFileSync(manifestFile),
      verified = verifyWindowsPackage(directory);
    assert.equal(verified.manifest.hermesExecutionMode, 'static-aot');
    verifyWindowsRuntime(directory);
    assert.deepEqual(fs.readFileSync(manifestFile), before);
    const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'static-aot-app.json')));
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-static-aot-contract-'));
    try {
      for (const retired of [
        { schema: 'nelyx.windows-typed-hermes-app/v2' },
        { schema: 'nelyx.windows-static-aot-app/v3' },
        { schema: 'nelyx.windows-static-aot-app/v4' },
        { mode: 'typed-native-hybrid' },
        { bootstrapFormat: 'nelyx-static-hermes-native/v2' },
      ]) {
        fs.writeFileSync(
          path.join(fixture, 'static-aot-app.json'),
          JSON.stringify({ ...metadata, ...retired }),
        );
        assert.throws(() => verifyStaticAotApplication(fixture), /application identity differs/);
      }
      fs.writeFileSync(
        path.join(fixture, 'static-aot-app.json'),
        JSON.stringify({
          ...metadata,
          internalJavaScript: { ...metadata.internalJavaScript, mode: 'bytecode' },
        }),
      );
      assert.throws(() => verifyStaticAotApplication(fixture), /native internal JavaScript/);
      if (process.platform === 'win32') {
        const key =
            Object.keys(process.env).find((name) => name.toUpperCase() === 'PATH') ?? 'PATH',
          previous = process.env[key],
          output = path.join(fixture, 'failed.zip');
        try {
          process.env[key] = '';
          await assert.rejects(packWindows({ app: fixture, directory, output }), /ENOENT/);
        } finally {
          if (previous === undefined) delete process.env[key];
          else process.env[key] = previous;
        }
        assert(!fs.existsSync(output));
        assert.deepEqual(fs.readdirSync(path.join(fixture, '.nelyx/windows/pack-staging')), []);
      }
    } finally {
      assert.equal(path.dirname(fixture), fs.realpathSync(os.tmpdir()));
      assert(!fs.lstatSync(fixture).isSymbolicLink());
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  },
);
