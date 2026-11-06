// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import './execution-model.test.mjs';
import { stableApiSurface } from '../tools/api-scope.mjs';
import {
  auditEngineV2Api,
  engineV2OriginalSurface,
  engineV2ApiTarget,
} from '../tools/api-audit.mjs';
const timeout = 1_200_000;
test(
  'Scope normalization leaves custom unique symbols and type data unchanged',
  { timeout },
  () => {
    assert.deepEqual(
      stableApiSurface({
        name: '__@custom@123',
        type: '__@iterator@123',
        members: [{ name: '__@iterator@123' }],
      }),
      { name: '__@custom@123', type: '__@iterator@123', members: [{ name: '__@iterator@123' }] },
    );
  },
);
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
  'Scope union normalization preserves literals, overload order and intersection order',
  { timeout },
  () => {
    const left = {
      value: '"tight" | "loose"',
      calls: ['(fit: "tight" | "loose"): void', '(fit: number): void'],
      members: [{ name: 'literal', visibility: 'public', type: '"tight | loose"' }],
    };
    const right = {
      ...left,
      value: '"loose" | "tight"',
      calls: ['(fit: "loose" | "tight"): void', '(fit: number): void'],
    };
    assert.deepEqual(stableApiSurface(left), stableApiSurface(right));
    assert.notDeepEqual(
      stableApiSurface(left),
      stableApiSurface({ ...right, calls: [...right.calls].reverse() }),
    );
    assert.equal(stableApiSurface(left).members[0].type, '"tight | loose"');
    const overloaded = '((x: "a") => 1) & ((x: string) => 2)';
    assert.equal(stableApiSurface({ value: overloaded }).value, overloaded);
    assert.notDeepEqual(
      stableApiSurface({ value: overloaded }),
      stableApiSurface({ value: '((x: string) => 2) & ((x: "a") => 1)' }),
    );
  },
);
test(
  'Package JSON scope allows additive v2 exports and still rejects changed original JSON values',
  { timeout },
  () =>
    fixture(async ({ audit, root, write, manifest }) => {
      manifest.description = 'original public asset';
      manifest.exports['./package.json'] = './package.json';
      write('package.json', JSON.stringify(manifest));
      const scope = engineV2OriginalSurface(await audit(), root, { stable: true });
      write('original.d.ts', 'export declare const value: number;');
      write('original.js', 'export const value=1;');
      const added = {
        ...manifest,
        exports: {
          ...manifest.exports,
          './v2/original': { types: './original.d.ts', default: './original.js' },
        },
      };
      write('package.json', JSON.stringify(added));
      assert.equal((await audit({ scope, targets: ['web', 'windows'] })).inputValid, true);
      write('package.json', JSON.stringify({ ...added, description: 'changed original asset' }));
      const changed = await audit({ scope, targets: ['web', 'windows'] });
      assert.equal(changed.inputValid, false);
      assert.ok(
        changed.errors.some(
          (error) =>
            error.code === 'originalSurfaceChanged' &&
            error.message === '@nelyx/core/package.json#*',
        ),
      );
    }),
);
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
  'An additive v2 App entry keeps the original scope and union fingerprints unchanged',
  { timeout },
  () =>
    fixture(async ({ audit, root, write, manifest }) => {
      write(
        'numbers.d.ts',
        'export type Level = "low" | "middle" | "high"; export declare function level(value: Level): Level;',
      );
      write('numbers.js', 'export const level = value => value;');
      const scope = engineV2OriginalSurface(await audit(), root, { stable: true });
      const extra = { types: './original.d.ts', default: './original.js' };
      write(
        'original.d.ts',
        'export type Reversed = "high" | "middle" | "low"; export {Level} from "./numbers.js";',
      );
      write('original.js', 'export {};');
      write(
        'package.json',
        JSON.stringify({ ...manifest, exports: { './v2/original': extra, ...manifest.exports } }),
      );
      const current = await audit({ scope, targets: ['web', 'windows'] });
      assert.equal(current.inputValid, true, JSON.stringify(current.errors));
      assert.deepEqual(engineV2OriginalSurface(current, root, { stable: true }), scope);
      assert.equal(
        current.targetInputs[0].counts.total,
        2,
        'The actual consumer still resolves and validates the additive entry',
      );
      write('original.d.ts', 'export type Invalid = NotARealNativeType;');
      const invalid = await audit({ scope, targets: ['web', 'windows'] });
      assert.equal(invalid.inputValid, false);
      assert.equal(
        (await audit({ scope })).inputValid,
        false,
        'The inventory-only mode validates additive v2 declarations separately',
      );
      assert.ok(
        invalid.targetInputs.every((input) =>
          input.errors.some((error) => error.code === 'TS2304'),
        ),
      );
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

test(
  'Target consumers resolve original imports, isolate DOM globals, and keep the complete scope',
  { timeout },
  () =>
    fixture(async ({ audit, write }) => {
      write('numbers.d.ts', 'export declare function add(a: Window, b: number): number;');
      const result = await audit({ targets: ['windows', 'web'] });
      const [windows, web] = result.targetInputs;
      assert.equal(windows.inputValid, false);
      assert.ok(
        windows.errors.some((error) => error.code === 'TS2304' && error.message.includes('Window')),
      );
      assert.equal(web.inputValid, true, JSON.stringify(web.errors));
      assert.equal(
        result.inputValid,
        false,
        'A passing browser program cannot hide a native declaration failure',
      );
      for (const target of result.targetInputs) {
        assert.equal(target.skipLibCheck, false);
        assert.equal(
          target.counts.total,
          target.counts.applicable + target.counts.notApplicable + target.counts.unverified,
        );
        assert.equal(target.counts.total, 1);
        assert.equal(target.modules[0].module, '@nelyx/core/foundation/numbers');
      }
      assert.equal(result.packages[0].legacySubpaths, 1);
    }),
);

test(
  'Target applicability uses the original platform contract and rejects unknown targets',
  { timeout },
  () => {
    assert.equal(
      engineV2ApiTarget('@nelyx/sdk/platforms/windows/application', 'windows').applicable,
      true,
    );
    assert.equal(
      engineV2ApiTarget('@nelyx/sdk/platforms/windows/application', 'web').applicable,
      false,
    );
    assert.equal(engineV2ApiTarget('@nelyx/sdk/providers/web.json', 'web').applicable, true);
    assert.equal(
      engineV2ApiTarget('@nelyx/sdk/platforms/android/application', 'windows').applicable,
      false,
    );
    assert.equal(
      engineV2ApiTarget('@nelyx/core/framework/rendering/object', 'web').applicable,
      true,
    );
    assert.throws(
      () => engineV2ApiTarget('@nelyx/core/framework/rendering/object', 'unknown'),
      /Unknown API target/,
    );
  },
);

test(
  'Stable scope preserves old hashes, ignores compiler symbol IDs, and still rejects changed members and literal data',
  { timeout },
  () =>
    fixture(async ({ audit, root, write }) => {
      write(
        'numbers.d.ts',
        'export declare class Values { [Symbol.iterator](): Iterator<number>; } export type Marker = "__@iterator@123";',
      );
      const scope = engineV2OriginalSurface(await audit(), root, { stable: true });
      assert.equal(scope.schema, 'nelyx.api.original/3');
      assert.ok(
        scope.packages[0].modules[0].exports.every(
          (entry) => entry.length === 3 && /^[a-f0-9]{64}$/.test(entry[1]),
        ),
      );
      const unchanged = await audit({ scope, targets: ['web', 'windows'] });
      assert.equal(unchanged.inputValid, true, JSON.stringify(unchanged.errors));
      write(
        'numbers.d.ts',
        'export declare class Values { [Symbol.iterator](): Iterator<string>; } export type Marker = "__@iterator@456";',
      );
      const changed = await audit({ scope });
      assert.equal(changed.inputValid, false);
      assert.ok(
        changed.errors.some(
          (error) => error.code === 'originalSurfaceChanged' && error.message.endsWith('#Values'),
        ),
      );
      assert.ok(
        changed.errors.some(
          (error) => error.code === 'originalSurfaceChanged' && error.message.endsWith('#Marker'),
        ),
      );
    }),
);

test(
  'Stable computed names retain unique-symbol declaration identity and literal property names',
  { timeout },
  () =>
    fixture(async ({ audit, root, write }) => {
      write('a.d.ts', 'export declare const brand: unique symbol;');
      write('b.d.ts', 'export declare const brand: unique symbol;');
      const declaration = (module, literal = '__@iterator@123') =>
        `import {brand} from './${module}.js'; export interface Value { readonly [brand]: true; readonly '${literal}': string; }`;
      write('numbers.d.ts', declaration('a'));
      const scope = engineV2OriginalSurface(await audit(), root, { stable: true });
      assert.equal((await audit({ scope, targets: ['windows', 'web'] })).inputValid, true);
      write('numbers.d.ts', declaration('b'));
      const changedSymbol = await audit({ scope });
      assert.equal(changedSymbol.inputValid, false);
      assert.ok(
        changedSymbol.errors.some(
          (error) => error.code === 'originalSurfaceChanged' && error.message.endsWith('#Value'),
        ),
      );
      write('numbers.d.ts', declaration('a', '__@iterator@456'));
      const changedLiteral = await audit({ scope });
      assert.equal(changedLiteral.inputValid, false);
      assert.ok(
        changedLiteral.errors.some(
          (error) => error.code === 'originalSurfaceChanged' && error.message.endsWith('#Value'),
        ),
      );
    }),
);
test(
  'Computed symbol scope is independent of repository or installed package directory layout',
  { timeout },
  () =>
    fixture(async ({ audit, root, pkg, write }) => {
      write('a.d.ts', 'export declare const brand: unique symbol;');
      write(
        'numbers.d.ts',
        "import {brand} from './a.js';export interface Value { readonly [brand]: true; }",
      );
      const scope = engineV2OriginalSurface(await audit(), root, { stable: true });
      const moved = path.join(root, 'relocated-package');
      assert.equal(path.dirname(moved), root);
      assert.ok(pkg.startsWith(root + path.sep));
      fs.renameSync(pkg, moved);
      fs.symlinkSync(moved, pkg, 'junction');
      const installed = await auditEngineV2Api({
        root,
        directories: ['relocated-package'],
        scope,
        targets: ['windows', 'web'],
      });
      assert.equal(installed.inputValid, true, JSON.stringify(installed.errors));
    }),
);
