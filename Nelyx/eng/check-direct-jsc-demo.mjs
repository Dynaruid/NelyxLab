// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import { buildNativeJscProbe } from './native-jsc-probe-build.mjs';
const root = path.resolve(import.meta.dirname, '../..');
if (!process.argv.includes('--child')) {
  try {
    await execute(process.execPath, [import.meta.filename, '--child'], {
      cwd: root,
      timeout: 1_200_000,
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
} else {
  const parent = path.join(root, 'sample/nelyx-demo-app/.nelyx/native-windows'),
    temporary = fs.mkdtempSync(path.join(parent, '.direct-jsc-demo-'));
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 1_200_000);
  try {
    const built = await buildNativeJscProbe({
      app: path.join(root, 'sample/nelyx-demo-app'),
      output: path.join(temporary, 'package'),
      signal: controller.signal,
    });
    await execute(built.executable, [built.bundle, built.assetRoot, 'source', '8000'], {
      cwd: built.directory,
      env: { ...process.env, NELYX_NATIVE_DIAGNOSTICS: '1' },
      signal: controller.signal,
      timeout: 1_200_000,
    });
    console.log('DIRECT_JSC_DEMO_START_CLOSE_PASS');
  } finally {
    clearTimeout(timer);
    controller.abort();
    assert.equal(path.dirname(fs.realpathSync(temporary)), fs.realpathSync(parent));
    assert(!fs.lstatSync(temporary).isSymbolicLink());
    fs.rmSync(temporary, { recursive: true, force: true });
    console.log('DIRECT_JSC_DEMO_CLEANUP_DONE');
  }
}
