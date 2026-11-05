// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditEngineV2Api, engineV2OriginalSurface } from '../tools/api-audit.mjs';
const timeout = 1_200_000;
async function fixture(run) {
  const parent = fs.realpathSync(os.tmpdir()),
    root = fs.mkdtempSync(path.join(parent, 'nelyx-api-')),
    directory = 'node_modules/@nelyx/core',
    pkg = path.join(root, directory);
  const write = (name, text) => fs.writeFileSync(path.join(pkg, name), text);
  try {
    fs.mkdirSync(pkg, { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
    const manifest = {
      name: '@nelyx/core',
      type: 'module',
      exports: {
        './foundation/numbers': { types: './numbers.d.ts', default: './numbers.js' },
        './v2': { types: './v2.d.ts', default: './v2.js' },
      },
    };
    write('package.json', JSON.stringify(manifest));
    write('numbers.d.ts', 'export declare function add(a: number, b: number): number;');
    write('numbers.js', 'export function add(a, b) {return a + b;}');
    write('v2.d.ts', 'export declare function add(a: number, b: number): number;');
    write('v2.js', 'export function add(a, b) {return a + b;}');
    await run({
      root,
      pkg,
      write,
      manifest,
      audit: (options = {}) => auditEngineV2Api({ root, directories: [directory], ...options }),
    });
  } finally {
    assert.equal(path.dirname(path.resolve(root)), parent);
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  }
}
test(
  'API audit requires a live behavior case, and supports an explicitly routed new implementation',
  { timeout },
  () =>
    fixture(async ({ audit }) => {
      const original = '@nelyx/core/foundation/numbers';
      const before = await audit();
      assert.equal(before.inputValid, true, JSON.stringify(before.errors));
      assert.equal(before.compatible, false);
      assert.equal(before.packages[0].entries[0].status, 'canonicalDataReuseBehaviorUnverified');
      const contract = {
        id: 'add',
        exports: [{ module: original, name: 'add', covers: ['call:0'] }],
        run({ load, replacement }) {
          assert.equal(load(original).add(2, 3), 5);
          assert.equal(replacement(original).add(2, 3), 5);
        },
      };
      const accepted = await audit({
        verify: true,
        contracts: [contract],
        resolveRoute: (name) => (name === original ? '@nelyx/core/v2' : null),
      });
      assert.equal(accepted.compatible, true, JSON.stringify(accepted.errors));
      assert.equal(accepted.packages[0].entries[0].route.module, '@nelyx/core/v2');
      const uncovered = await audit({
        verify: true,
        contracts: [{ ...contract, exports: [{ module: original, name: 'add' }] }],
      });
      assert.equal(
        uncovered.compatible,
        false,
        'A case name without explicit overload coverage cannot approve an API',
      );
      const failed = await audit({
        verify: true,
        contracts: [
          contract,
          {
            ...contract,
            id: 'failure',
            run() {
              throw Error('different behavior');
            },
          },
        ],
      });
      assert.equal(failed.compatible, false);
      assert.equal(failed.packages[0].entries[0].status, 'behaviorFailed');
    }),
);
test(
  'An uncovered overload remains unverified after a passing case for another overload',
  { timeout },
  () =>
    fixture(async ({ audit, write }) => {
      write(
        'numbers.d.ts',
        'export declare function add(a: number, b: number): number; export declare function add(a: string, b: string): string;',
      );
      const result = await audit({
        verify: true,
        contracts: [
          {
            id: 'numeric-add',
            exports: [
              { module: '@nelyx/core/foundation/numbers', name: 'add', covers: ['call:0'] },
            ],
            run({ replacement }) {
              assert.equal(replacement('@nelyx/core/foundation/numbers').add(2, 3), 5);
            },
          },
        ],
      });
      assert.equal(result.compatible, false);
      assert.equal(result.packages[0].entries[0].status, 'behaviorPartiallyVerified');
      assert.deepEqual(result.packages[0].entries[0].unverified, ['call:1']);
    }),
);
test(
  'API audit fails on missing declaration/runtime or unresolved reexports without dropping the public module',
  { timeout },
  () =>
    fixture(async ({ audit, pkg, write }) => {
      fs.unlinkSync(path.join(pkg, 'numbers.d.ts'));
      let result = await audit();
      assert.equal(result.inputValid, false);
      assert.equal(result.packages[0].legacySubpaths, 1);
      assert.ok(result.errors.some((error) => error.code === 'missingFile'));
      write('numbers.d.ts', "export { Missing } from './missing.js';");
      result = await audit();
      assert.equal(result.inputValid, false);
      assert.ok(result.errors.some((error) => error.code === 'TS2307'));
      write('numbers.d.ts', 'export declare function add(a: number, b: number): number;');
      fs.unlinkSync(path.join(pkg, 'numbers.js'));
      result = await audit();
      assert.equal(result.inputValid, false);
      assert.equal(result.compatible, false);
    }),
);
test(
  'API audit preserves constructor overloads, generics, readonly and protected subclass hooks',
  { timeout },
  () =>
    fixture(async ({ audit, write, manifest }) => {
      manifest.exports['./framework/widgets/framework'] = manifest.exports['./foundation/numbers'];
      delete manifest.exports['./foundation/numbers'];
      write('package.json', JSON.stringify(manifest));
      write(
        'numbers.d.ts',
        'export declare class Hook<T extends string = string> { constructor(value: number); constructor(value: string); protected readonly value: T; protected build(value: T): T; }',
      );
      write(
        'v2.d.ts',
        'export declare class Hook<T extends string = string> { constructor(value: number); constructor(value: string); protected readonly value: T; protected build(value: number): T; }',
      );
      const result = await audit(),
        entry = result.packages[0].entries[0];
      assert.equal(entry.original.constructors.length, 2);
      assert.equal(
        entry.original.instances[0].find((member) => member.name === 'build').visibility,
        'protected',
      );
      assert.equal(
        entry.original.instances[0].find((member) => member.name === 'value').readonly,
        true,
      );
      assert.equal(entry.status, 'signatureChanged');
      assert.equal(entry.route, null, 'A same-name candidate is never an original import route');
    }),
);
test(
  'The pinned original surface rejects removed modules and narrowed overloads',
  { timeout },
  () =>
    fixture(async ({ audit, write, root, manifest }) => {
      manifest.exports['./foundation/constants'] = {
        types: './constants.d.ts',
        default: './constants.js',
      };
      write('package.json', JSON.stringify(manifest));
      write('constants.d.ts', 'export declare const answer = 7;');
      write('constants.js', 'export const answer = 7;');
      write(
        'numbers.d.ts',
        'export declare function add(a: number, b: number): number; export declare function add(a: string, b: string): string;',
      );
      const scope = engineV2OriginalSurface(await audit(), root);
      write('numbers.d.ts', 'export declare function add(a: number, b: number): number;');
      let result = await audit({ scope });
      assert.equal(result.inputValid, false);
      assert.ok(result.errors.some((error) => error.code === 'originalSurfaceChanged'));
      manifest.exports['./foundation/constants'] = {
        types: './constants.d.ts',
        default: './constants.js',
      };
      delete manifest.exports['./foundation/numbers'];
      write('package.json', JSON.stringify(manifest));
      write('constants.d.ts', 'export declare const answer = 7;');
      write('constants.js', 'export const answer = 7;');
      result = await audit({
        scope,
        verify: true,
        contracts: [
          {
            id: 'constant',
            exports: [
              { module: '@nelyx/core/foundation/constants', name: 'answer', covers: ['value'] },
            ],
            run({ replacement }) {
              assert.equal(replacement('@nelyx/core/foundation/constants').answer, 7);
            },
          },
        ],
      });
      assert.ok(
        result.cases.every((item) => item.passed),
        JSON.stringify({
          cases: result.cases,
          entries: result.packages[0].entries.map(
            ({ name, obligations, signatureMatches, assignable }) => ({
              name,
              obligations,
              signatureMatches,
              assignable,
            }),
          ),
        }),
      );
      assert.equal(result.compatible, false);
      assert.ok(result.errors.some((error) => error.code === 'missingOriginalModule'));
    }),
);

test(
  'Index signatures and aliased unions retain explicit types when any is assignable',
  { timeout },
  () =>
    fixture(async ({ audit, write }) => {
      write(
        'numbers.d.ts',
        'export interface Values {readonly [key: string]: number;} export type Result = number | string;',
      );
      write(
        'v2.d.ts',
        'export interface Values {readonly [key: string]: any;} export type Result = number | boolean;',
      );
      const result = await audit({ resolveRoute: () => '@nelyx/core/v2' }),
        entries = result.packages[0].entries;
      const values = entries.find((entry) => entry.name === 'Values');
      assert.equal(
        values.assignable,
        true,
        'The explicit index shape must catch what TS any assignability permits',
      );
      assert.equal(values.signatureMatches, false);
      assert.equal(values.status, 'signatureChanged');
      assert.deepEqual(values.original.indexes, [
        { key: 'string', value: 'number', readonly: true },
      ]);
      const alias = entries.find((entry) => entry.name === 'Result');
      assert.notEqual(alias.original.definition, alias.replacement.definition);
      assert.equal(alias.status, 'signatureChanged');
    }),
);

test('API audit keeps non-code exports and empty modules as unverified entries', { timeout }, () =>
  fixture(async ({ audit, write, manifest }) => {
    manifest.exports['./assets/icon.ttf'] = './font.ttf';
    manifest.exports['./internal/empty'] = { types: './empty.d.ts', default: './empty.js' };
    write('package.json', JSON.stringify(manifest));
    write('font.ttf', 'font');
    write('empty.d.ts', 'export {};');
    write('empty.js', 'export {};');
    const result = await audit();
    assert.equal(result.packages[0].legacySubpaths, 3);
    assert.ok(result.packages[0].entries.some((entry) => entry.status === 'assetUnverified'));
    assert.ok(
      result.packages[0].entries.some(
        (entry) => entry.status === 'moduleUnverified' && entry.module.includes('/internal/'),
      ),
    );
    assert.equal(result.compatible, false);
  }),
);
