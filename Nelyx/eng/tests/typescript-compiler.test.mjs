// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  resolveTypeScriptCompiler,
  runTypeScriptCompiler,
} from '../../sdk/tooling/metro/src/typescript-compiler.cjs';
const timeout = 1_200_000,
  load = createRequire(import.meta.url);

test(
  'TypeScript 7 uses the consumer compiler and preserves actual type errors in paths with spaces',
  { timeout },
  () => {
    const parent = fs.realpathSync(os.tmpdir()),
      root = fs.mkdtempSync(path.join(parent, 'nelyx-typescript-space-'));
    try {
      fs.mkdirSync(path.join(root, 'node_modules'));
      fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
      fs.symlinkSync(
        path.dirname(load.resolve('@typescript/native/package.json')),
        path.join(root, 'node_modules/typescript'),
        'junction',
      );
      fs.writeFileSync(
        path.join(root, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noEmit: true,
            types: [],
            target: 'ES2022',
            module: 'NodeNext',
          },
          files: ['entry.ts'],
        }),
      );
      const source = path.join(root, 'entry.ts');
      fs.writeFileSync(source, 'export const value:number=42;');
      const admitted = runTypeScriptCompiler(root, ['-p', 'tsconfig.json', '--pretty', 'false']);
      assert.equal(admitted.version, '7.0.2');
      assert.equal(admitted.status, 0, admitted.stdout + admitted.stderr);
      fs.writeFileSync(source, "export const value:number='wrong';");
      const rejected = runTypeScriptCompiler(root, ['-p', 'tsconfig.json', '--pretty', 'false']);
      assert.notEqual(rejected.status, 0);
      assert.match(rejected.stdout + rejected.stderr, /TS2322/);
    } finally {
      assert.equal(path.dirname(path.resolve(root)), parent);
      assert.match(path.basename(root), /^nelyx-typescript-space-/);
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);
test(
  'TypeScript consumers reject older compilers and mismatched executable metadata before compilation',
  { timeout },
  () => {
    const parent = fs.realpathSync(os.tmpdir()),
      root = fs.mkdtempSync(path.join(parent, 'nelyx-typescript-reject-'));
    try {
      const pkg = path.join(root, 'node_modules/typescript');
      fs.mkdirSync(pkg, { recursive: true });
      fs.writeFileSync(path.join(root, 'package.json'), '{}');
      fs.writeFileSync(
        path.join(pkg, 'package.json'),
        JSON.stringify({ name: 'typescript', version: '5.9.3', bin: { tsc: 'missing.cjs' } }),
      );
      assert.throws(() => resolveTypeScriptCompiler(root), /TypeScript >=7/);
      fs.writeFileSync(
        path.join(pkg, 'package.json'),
        JSON.stringify({ name: 'typescript', version: '7.0.2', bin: { tsc: 'version.cjs' } }),
      );
      fs.writeFileSync(path.join(pkg, 'version.cjs'), "console.log('Version 6.0.3');");
      assert.throws(() => resolveTypeScriptCompiler(root), /compiler\/package version differs/);
    } finally {
      assert.equal(path.dirname(path.resolve(root)), parent);
      assert.match(path.basename(root), /^nelyx-typescript-reject-/);
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);
