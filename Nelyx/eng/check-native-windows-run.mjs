// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';
import {
  nativeWindowsBuildIdentity,
  prepareNativeWindowsRun,
} from '../sdk/tooling/cli/src/windows-native-run-preparation.mjs';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
} else {
  let cases = 0;
  const identity = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)],
    digest = nativeWindowsBuildIdentity(...identity);
  assert.equal(nativeWindowsBuildIdentity(...identity), digest);
  cases++;
  for (let index = 0; index < identity.length; index++) {
    const changed = [...identity];
    changed[index] = 'd'.repeat(64);
    assert.notEqual(nativeWindowsBuildIdentity(...changed), digest);
    cases++;
  }
  assert.throws(
    () => nativeWindowsBuildIdentity(identity[0], undefined, identity[2]),
    /requires prepared/,
  );
  cases++;
  function harness() {
    const state = { sdk: 'sdk-a', app: 'app-a', builds: [], reads: 0, notices: 0 };
    const product = (mode = 'bytecode') => ({
      directory: 'current-' + mode,
      manifest: {
        mode,
        qualification: 'experimental',
        sdkInputsSha256: state.sdk,
        appInputsSha256: state.app,
      },
    });
    state.current = product();
    const dependencies = {
      packageFor: () => state.current,
      readInputs: () => {
        state.reads++;
        return state.sdk;
      },
      readAppInputs: () => {
        state.reads++;
        return state.app;
      },
      build: async (options) => {
        state.builds.push(options);
        state.current = product(options.mode);
      },
      onRebuild: () => {
        state.notices++;
      },
    };
    const run = (options = {}) => prepareNativeWindowsRun({ app: 'app', ...options }, dependencies);
    return { state, dependencies, run };
  }
  {
    const { state, run } = harness(),
      original = state.current;
    assert.equal(await run(), original);
    assert.equal(state.builds.length, 0);
    cases++;
  }
  for (const field of ['app', 'sdk']) {
    const { state, run } = harness();
    state[field] += '-changed';
    await run();
    assert.equal(state.builds.length, 1);
    assert.equal(state.notices, 1);
    await run();
    assert.equal(state.builds.length, 1, 'Unchanged rerun rebuilt');
    cases++;
  }
  {
    const { state, run } = harness();
    state.current = undefined;
    await run();
    assert.equal(state.builds.length, 1);
    cases++;
  }
  {
    const { state, run } = harness();
    delete state.current.manifest.sdkInputsSha256;
    delete state.current.manifest.appInputsSha256;
    await run();
    assert.equal(state.builds.length, 1, 'Unidentified cached inputs were reused');
    cases++;
  }
  {
    const { state, run } = harness();
    await run({ directory: 'portable' });
    assert.equal(state.builds.length, 0);
    assert.equal(state.reads, 0, 'Explicit package read installed SDK/app inputs');
    cases++;
  }
  {
    const { state, run } = harness();
    await assert.rejects(
      run({ directory: 'portable', hermesMode: 'static-aot' }),
      /different Hermes execution mode/,
    );
    assert.equal(state.builds.length, 0);
    cases++;
  }
  {
    const { state, run } = harness();
    await run({ hermesMode: 'static-aot' });
    assert.equal(state.builds.length, 1);
    assert.equal(state.builds[0].mode, 'static-aot');
    cases++;
  }
  {
    const { state, dependencies, run } = harness();
    dependencies.packageFor = () => {
      throw Error('Corrupt package');
    };
    await assert.rejects(run(), /Corrupt package/);
    assert.equal(state.builds.length, 0);
    cases++;
  }
  for (const field of ['sdkInputsSha256', 'appInputsSha256']) {
    const { state, dependencies, run } = harness();
    state.app = 'changed';
    const build = dependencies.build;
    dependencies.build = async (options) => {
      await build(options);
      state.current.manifest[field] = 'stale';
    };
    await assert.rejects(run(), /did not capture the current/);
    cases++;
  }
  {
    const { state, run } = harness();
    state.current.manifest.qualification = 'diagnostic-only';
    await assert.rejects(run(), /requires a product package/);
    assert.equal(state.builds.length, 0);
    cases++;
  }
  {
    const { state, dependencies, run } = harness();
    state.app = 'changed';
    const build = dependencies.build;
    dependencies.build = async (options) => {
      await build(options);
      state.current.manifest.mode = 'static-aot';
    };
    await assert.rejects(run(), /did not publish the selected product mode/);
    cases++;
  }
  console.log('NATIVE_WINDOWS_RUN PASS ' + cases + ' cases');
}
