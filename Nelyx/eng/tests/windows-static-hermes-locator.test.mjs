// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readStaticHermesLocator } from '../../sdk/tooling/cli/src/windows-static-hermes-locator.mjs';
const timeout = 1_200_000;

test(
  'prepare can recover missing locators and deleted supplier parents while build remains strict',
  { timeout },
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-hermes-locator-'));
    try {
      const file = path.join(root, 'locator.json'),
        directory = path.join(root, 'deleted-cache', 'native', 'hermes');
      assert.equal(readStaticHermesLocator(file, { allowMissing: true }), null);
      assert.throws(() => readStaticHermesLocator(file), { code: 'ENOENT' });
      fs.writeFileSync(
        file,
        JSON.stringify({
          schema: 'nelyx.windows-static-hermes-locator/v1',
          directory,
          sha256: 'a'.repeat(64),
        }),
      );
      const before = fs.readFileSync(file);
      assert.equal(readStaticHermesLocator(file, { allowMissing: true }), null);
      assert.throws(() => readStaticHermesLocator(file), { code: 'ENOENT' });
      assert.deepEqual(
        fs.readFileSync(file),
        before,
        'Failure must preserve the previous locator until a new supplier succeeds',
      );
      assert(
        !fs.existsSync(directory),
        'Reading a locator must not create an old external cache path',
      );
      fs.mkdirSync(directory, { recursive: true });
      assert.equal(readStaticHermesLocator(file, { allowMissing: true }).directory, directory);
      assert.equal(readStaticHermesLocator(file).sha256, 'a'.repeat(64));
      assert.deepEqual(fs.readFileSync(file), before);
    } finally {
      assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
      assert(path.basename(root).startsWith('nelyx-hermes-locator-'));
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);

test(
  'prepare does not hide malformed, invalid or non-directory supplier locators',
  { timeout },
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-hermes-locator-'));
    try {
      const file = path.join(root, 'locator.json'),
        directory = path.join(root, 'missing');
      const valid = {
        schema: 'nelyx.windows-static-hermes-locator/v1',
        directory,
        sha256: 'a'.repeat(64),
      };
      for (const patch of [
        { schema: 'foreign' },
        { directory: 'relative' },
        { directory: 4 },
        { sha256: 'invalid' },
      ]) {
        fs.writeFileSync(file, JSON.stringify({ ...valid, ...patch }));
        assert.throws(
          () => readStaticHermesLocator(file, { allowMissing: true }),
          /locator changed/,
        );
      }
      fs.writeFileSync(file, '{');
      assert.throws(() => readStaticHermesLocator(file, { allowMissing: true }), SyntaxError);
      fs.writeFileSync(directory, 'not a supplier');
      fs.writeFileSync(file, JSON.stringify(valid));
      assert.throws(() => readStaticHermesLocator(file, { allowMissing: true }), /not a directory/);
    } finally {
      assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir()));
      assert(path.basename(root).startsWith('nelyx-hermes-locator-'));
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);
