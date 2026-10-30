// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { nativeHermesSourceTree } from '../../sdk/tooling/cli/src/windows-native-hermes-source.mjs';
import { sha256, fileTree } from '../../sdk/tooling/cli/src/files.mjs';
const timeout = 1_200_000;
test(
  'native supplier identity ignores only declared Android outputs and still rejects actual source drift',
  { timeout },
  () => {
    const parent = fs.realpathSync(os.tmpdir()),
      root = fs.mkdtempSync(path.join(parent, 'nelyx-hermes-source-'));
    const write = (name, value) => {
      const file = path.join(root, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, value);
    };
    try {
      write('CMakeLists.txt', '// pinned');
      write('android/build.gradle', '// source');
      write('lib/VM.cpp', '// source');
      const expected = createHash('sha256')
        .update(JSON.stringify(fileTree(root).map((name) => [name, sha256(path.join(root, name))])))
        .digest('hex');
      assert.equal(
        nativeHermesSourceTree(root),
        expected,
        'Existing clean-source receipts keep their exact digest',
      );
      for (const name of [
        'android/.gradle',
        'android/build',
        'android/build-logic/.gradle',
        'android/build-logic/build',
      ])
        write(name + '/cache.bin', 'generated');
      assert.equal(nativeHermesSourceTree(root), expected);
      write('android/build.gradle', '// edited source');
      assert.notEqual(nativeHermesSourceTree(root), expected);
      write('android/build.gradle', '// source');
      write('lib/build/new.cpp', '// This build-named source directory is not allowlisted');
      assert.notEqual(nativeHermesSourceTree(root), expected);
      fs.unlinkSync(path.join(root, 'lib/build/new.cpp'));
      fs.unlinkSync(path.join(root, 'lib/VM.cpp'));
      assert.notEqual(nativeHermesSourceTree(root), expected);
    } finally {
      assert.equal(path.dirname(root), parent);
      assert(path.basename(root).startsWith('nelyx-hermes-source-'));
      assert(!fs.lstatSync(root).isSymbolicLink());
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);
