// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyPackageSourceInputs } from '../package-source-inputs.mjs';
const timeout = 1_200_000;
function fixture(run) {
  const parent = fs.realpathSync(os.tmpdir()),
    root = fs.mkdtempSync(path.join(parent, 'nelyx-package-source-'));
  try {
    fs.mkdirSync(path.join(root, 'src'));
    fs.mkdirSync(path.join(root, 'dist'));
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ name: '@nelyx/fixture', exports: { '.': './dist/value.js' } }),
    );
    fs.writeFileSync(path.join(root, 'src/value.ts'), 'export const value=1;\n');
    fs.writeFileSync(path.join(root, 'dist/value.js'), 'export const value=1;\n');
    const map = {
      version: 3,
      sources: ['../src/value.ts'],
      sourcesContent: ['export const value=1;\n'],
      names: [],
      mappings: '',
    };
    const writeMap = () =>
      fs.writeFileSync(path.join(root, 'dist/value.js.map'), JSON.stringify(map));
    writeMap();
    return run(root, map, writeMap);
  } finally {
    assert.equal(path.dirname(fs.realpathSync(root)), parent);
    assert(path.basename(root).startsWith('nelyx-package-source-'));
    assert(!fs.lstatSync(root).isSymbolicLink());
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
test(
  'supply rejects source changed after emit and admits the rebuilt captured input',
  { timeout },
  () =>
    fixture((root, map, writeMap) => {
      assert.equal(verifyPackageSourceInputs(root).modules, 1);
      fs.writeFileSync(path.join(root, 'src/value.ts'), 'export const value=2;\n');
      assert.throws(
        () => verifyPackageSourceInputs(root),
        /Rebuild @nelyx\/fixture before supply: source differs/,
      );
      fs.writeFileSync(path.join(root, 'dist/value.js'), 'export const value=2;\n');
      map.sourcesContent[0] = 'export const value=2;\n';
      writeMap();
      assert.equal(verifyPackageSourceInputs(root).scope, 'current-source-map-inputs');
    }),
);
test('supply rejects missing maps and source outside the package owner', { timeout }, () =>
  fixture((root, map, writeMap) => {
    fs.unlinkSync(path.join(root, 'dist/value.js.map'));
    assert.throws(() => verifyPackageSourceInputs(root), /source map absent/);
    map.sources[0] = '../../outside.ts';
    writeMap();
    assert.throws(() => verifyPackageSourceInputs(root), /source escapes its package/);
  }),
);
test(
  'an emitted package cannot silently become a raw source package when its dist disappears',
  { timeout },
  () =>
    fixture((root) => {
      const from = path.resolve(root, 'dist'),
        to = path.resolve(root, 'emitted');
      assert.equal(path.dirname(from), root);
      assert.equal(path.dirname(to), root);
      assert(!fs.lstatSync(from).isSymbolicLink());
      fs.renameSync(from, to);
      assert.throws(() => verifyPackageSourceInputs(root), /dist is absent/);
      fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({ name: '@nelyx/fixture', exports: { '.': './src/value.mjs' } }),
      );
      fs.writeFileSync(path.join(root, 'src/value.mjs'), 'export const value=1;\n');
      assert.equal(verifyPackageSourceInputs(root).scope, 'source-only-package');
    }),
);
