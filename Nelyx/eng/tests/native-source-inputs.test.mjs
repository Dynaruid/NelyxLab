// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyNativeSourceInputs } from '../../skia/eng/native-source-inputs.mjs';
const timeout = 1_200_000;
function fixture(run) {
  const parent = fs.realpathSync(os.tmpdir()),
    workspace = fs.mkdtempSync(path.join(parent, 'nelyx-native-inputs-')),
    skia = path.join(workspace, 'Nelyx/skia');
  const write = (file, value) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value);
  };
  try {
    for (const folder of [
      'core',
      'host',
      'rendering/nelyx_skia',
      'platforms/vulkan',
      'adapters/jsi/cpp/api',
      'adapters/jsi/vulkan',
    ])
      fs.mkdirSync(path.join(skia, 'native', folder), { recursive: true });
    const source = path.join(skia, 'native/adapters/jsi/cpp/api/JsiSkPictureRecorder.h');
    write(source, '// current recorder\n');
    write(path.join(skia, 'native/adapters/jsi/engine.cmake'), '# current binding\n');
    const packages = [];
    for (const name of ['native', 'rn']) {
      const owner = path.join(skia, 'packages', name),
        binding = path.join(
          owner,
          name === 'rn'
            ? 'generated/jsi/api/JsiSkPictureRecorder.h'
            : 'cpp/api/JsiSkPictureRecorder.h',
        );
      write(path.join(owner, 'package.json'), JSON.stringify({ name: '@nelyx/skia-' + name }));
      for (const target of [
        'generated/core',
        'generated/host',
        'generated/gpu/nelyx_skia',
        'generated/vulkan',
        name === 'rn' ? 'generated/native-vulkan' : 'native/vulkan',
      ])
        fs.mkdirSync(path.join(owner, target), { recursive: true });
      write(binding, '// current recorder\n');
      write(
        path.join(owner, name === 'rn' ? 'generated/jsi/engine.cmake' : 'native/jsi/engine.cmake'),
        '# current binding\n',
      );
      for (const relative of [
        'vendor/artifacts.lock.json',
        'vendor/windows-rn-supplier.lock.json',
        'vendor/linux-graphite-probe.lock.json',
        'eng/prepare-artifacts.py',
        'eng/source-build/prepare-rn-modules.py',
        'eng/source-build/rn-modules.cmake',
        'eng/source-build/libwebp.lock.json',
      ]) {
        write(path.join(skia, relative), 'current ' + relative);
        write(path.join(owner, 'native/vulkan/sdk', relative), 'current ' + relative);
      }
      packages.push({ owner, binding });
    }
    return run({ workspace, source, packages, write });
  } finally {
    assert.equal(path.dirname(fs.realpathSync(workspace)), parent);
    assert(path.basename(workspace).startsWith('nelyx-native-inputs-'));
    assert(!fs.lstatSync(workspace).isSymbolicLink());
    fs.rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
test(
  'native and RN archives reject stale canonical bindings before packing and accept their refreshed derivation',
  { timeout },
  () =>
    fixture(({ workspace, source, packages }) => {
      for (const { owner } of packages)
        assert.equal(verifyNativeSourceInputs(owner, workspace).files, 9);
      fs.writeFileSync(source, '// revised recorder packet binding\n');
      for (const { owner, binding } of packages) {
        assert.throws(
          () => verifyNativeSourceInputs(owner, workspace),
          /Prepare .* native sources before supply: canonical source differs/,
        );
        fs.copyFileSync(source, binding);
        assert.equal(
          verifyNativeSourceInputs(owner, workspace).scope,
          'current-canonical-native-inputs',
        );
      }
    }),
);
test(
  'removed native inputs cannot survive as extra compiled files and missing recipes are rejected',
  { timeout },
  () =>
    fixture(({ workspace, source, packages, write }) => {
      for (const { owner, binding } of packages) {
        const extra = path.join(path.dirname(binding), 'obsolete.cpp');
        write(extra, '// stale compiled source\n');
        assert.throws(() => verifyNativeSourceInputs(owner, workspace), /inventory differs/);
        fs.unlinkSync(extra);
        fs.unlinkSync(binding);
        assert.throws(() => verifyNativeSourceInputs(owner, workspace), /inventory differs/);
        fs.copyFileSync(source, binding);
        const recipe = path.join(
          owner,
          path.basename(owner) === 'rn' ? 'generated/jsi/engine.cmake' : 'native/jsi/engine.cmake',
        );
        fs.unlinkSync(recipe);
        assert.throws(
          () => verifyNativeSourceInputs(owner, workspace),
          /inventory differs|canonical source differs or is absent/,
        );
      }
    }),
);
