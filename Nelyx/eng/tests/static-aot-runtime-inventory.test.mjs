// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import {
  inventoryBody,
  createRuntimeInventory,
} from '../../sdk/tooling/static-aot/src/runtime-inventory.mjs';

const timeout = 1_200_000;
const module = (id, source, extra = {}) => ({
  id,
  metroId: id,
  source,
  emitted: source,
  dialect: 'javascript',
  role: 'module',
  owner: {
    name: 'fixture',
    version: '1.0.0',
    root: '.',
    license: 'MIT',
    manifestSha256: 'a'.repeat(64),
  },
  dependencies: [],
  ...extra,
});
const inspect = (modules) =>
  createRuntimeInventory({
    identity: { platform: 'windows', dev: false },
    entry: 'main.js',
    modules,
    sourceMapModules: modules.filter((m) => m.role !== 'append').map((m) => m.id),
  });

test(
  'the denominator includes constructor, accessor, field/static initialization and nested closures without counting type declarations',
  { timeout },
  () => {
    const source = `import type {Dependency} from './types';
    type Signature = (n:number) => number;
    declare class OnlyAType {method():void;}
    class Real<T> {
      static first = (() => 1)();
      value = 2;
      static {globalThis.initialized = true;}
      constructor(public input:T) {}
      get read():number {return this.value;}
      set write(value:number) {this.value=value;}
      method() {let cell=0; return () => ++cell;}
    }
    class Implicit extends Real<number> {}
    export async function execute() {try {await Promise.resolve();} finally {globalThis.closed=true;}}
  `;
    const result = inventoryBody(source, { filename: 'main.ts', dialect: 'typescript' });
    const counts = result.bodies.reduce(
      (all, body) => ({
        ...all,
        [body.kind]: (Object.hasOwn(all, body.kind) ? all[body.kind] : 0) + 1,
      }),
      {},
    );
    assert.deepEqual(counts, {
      'module-initializer': 1,
      'static-field-initializer': 1,
      callable: 4,
      'field-initializer': 1,
      'static-block': 1,
      constructor: 1,
      'get-accessor': 1,
      'set-accessor': 1,
      'implicit-constructor': 1,
    });
    assert(!result.bodies.some((body) => body.name === 'OnlyAType'));
    assert(result.bodies.every((body) => body.classification === 'unclassified'));
    assert(
      result.bodies.every(
        (body) => body.line >= 1 && body.column >= 1 && /^[a-f0-9]{64}$/.test(body.sourceSha256),
      ),
    );
    assert(result.features.some((feature) => feature.kind === 'async'));
    assert(result.features.some((feature) => feature.kind === 'try-finally'));
    const closure = result.bodies.find(
      (body) => source.slice(body.offset, body.end) === '() => ++cell',
    );
    assert(result.bodies.some((body) => body.id === closure.parent && body.name === 'method'));
  },
);

test(
  'Flow without a pragma, exact records, as casts, components and generic methods retain original positions',
  { timeout },
  () => {
    const source = `type Record = {|a:number|};
    class C<T> {constructor(x:T) {} get value():number {return 3;} method<U>(x:U):U {return x;}}
    component View(value:number) {return null;}
    module.exports = {f(x:Record):number {return x.a;}} as any;`;
    const result = inventoryBody(source, { filename: 'runtime.js', dialect: 'flow' });
    assert.equal(result.bodies.filter((body) => body.kind === 'constructor').length, 1);
    assert.equal(result.bodies.filter((body) => body.kind === 'implicit-constructor').length, 0);
    assert(result.bodies.some((body) => body.kind === 'get-accessor'));
    assert(result.bodies.some((body) => body.name === 'View' && body.line === 3));
    assert(result.features.some((feature) => feature.kind === 'generic'));
    assert.equal(result.bodies.length, 6);
  },
);

test(
  'external lazy/CJS cycles, unresolved optional edges, generated loader and appended startup statements remain visible',
  { timeout },
  () => {
    const a = module('main.js', 'const lazy=()=>require("./external");', {
        dependencies: [{ specifier: './external', target: 'external.js', asyncType: null }],
      }),
      b = module('external.js', 'module.exports=()=>require("./main");', {
        dependencies: [
          { specifier: './main', target: 'main.js', asyncType: null },
          { specifier: 'optional', target: null, asyncType: null, optional: true },
        ],
      }),
      loader = module('loader.js', 'globalThis.require=function(id){return id;};', {
        role: 'prepend',
      }),
      startup = module('generated/run.js', 'require(0);', { role: 'append' });
    const result = inspect([a, b, loader, startup]);
    assert.equal(result.summary.modules, 4);
    assert.equal(result.summary.mappedModules, 3);
    assert.equal(result.summary.unresolvedDependencies, 1);
    assert(
      result.runtimeComponents.some(
        (component) =>
          component.length === 2 &&
          component.includes('main.js') &&
          component.includes('external.js'),
      ),
    );
    assert.equal(result.summary.wholeAppNativeAot, false);
    assert.equal(result.summary.typeSpecializationCoverage, 'notVerified');
    assert.equal(result.sha256, inspect([startup, loader, b, a]).sha256);
    assert.notEqual(
      result.sha256,
      inspect([{ ...a, emitted: a.emitted + 'globalThis.changed=true;' }, b, loader, startup])
        .sha256,
    );
  },
);

test(
  'multiple emitted routes to one original TypeScript implementation stay explicit',
  { timeout },
  () => {
    const a = module('main.js', 'export const value=1;', {
      sourceFile: 'src/value.ts',
      dialect: 'typescript',
    });
    const b = module('second.js', 'export const value=1;', {
      sourceFile: 'src/value.ts',
      dialect: 'typescript',
    });
    const result = inspect([a, b]);
    assert.deepEqual(result.evaluationConflicts, [['main.js', 'second.js']]);
  },
);

test(
  'missing or duplicated Metro/map entries, declarations, stale edges and unparseable bodies fail instead of disappearing',
  { timeout },
  () => {
    const entry = module('main.js', 'globalThis.value=1;');
    for (const sourceMapModules of [[], ['main.js', 'missing.js'], ['main.js', 'main.js']]) {
      assert.throws(
        () =>
          createRuntimeInventory({
            identity: {},
            entry: 'main.js',
            modules: [entry],
            sourceMapModules,
          }),
        /map|identities/,
      );
    }
    assert.throws(() => inspect([entry, entry]), /Duplicate/);
    assert.throws(
      () =>
        inspect([
          {
            ...entry,
            dependencies: [{ specifier: 'missing', target: 'missing.js', asyncType: null }],
          },
        ]),
      /Unresolved/,
    );
    assert.throws(
      () =>
        inventoryBody('export declare const value:number;', {
          filename: 'types.d.ts',
          dialect: 'typescript',
        }),
      /implementation/,
    );
    assert.throws(
      () => inventoryBody('function {', { filename: 'broken.js' }),
      /NELYX_RUNTIME_PARSE broken.js:1:/,
    );
    assert.throws(
      () =>
        createRuntimeInventory({
          identity: {},
          entry: 'main.js',
          modules: [entry],
          sourceMapModules: ['main.js'],
          maxBytes: 1,
        }),
      /byte bound/,
    );
    assert.throws(
      () => inventoryBody('function f(){}', { filename: 'many.js', maxBodies: 1 }),
      /bound/,
    );
    assert.throws(
      () =>
        createRuntimeInventory({
          identity: {},
          entry: 'main.js',
          modules: [entry],
          sourceMapModules: ['main.js'],
          maxModules: Infinity,
        }),
      /admission bound/,
    );
  },
);

test(
  'JSON data is excluded from source callables while its actual generated initializer is inventoried',
  { timeout },
  () => {
    const result = inspect([
      module('main.js', '{"value":3}', {
        sourceKind: 'json',
        emitted: '__d(function(){module.exports={value:3};});',
      }),
    ]);
    assert.equal(result.summary.originalBodies, 0);
    assert.equal(result.summary.emittedBodies, 2);
    assert.equal(result.modules[0].sourceKind, 'json');
    assert.throws(
      () => inspect([module('main.js', '{bad', { sourceKind: 'json', emitted: '' })]),
      SyntaxError,
    );
  },
);

test(
  'runtime namespaces and enum initializers are retained alongside erased TypeScript declarations',
  { timeout },
  () => {
    const source =
      'namespace Live {export function f(){return 1;}} enum E {Value=(()=>Live.f())()}';
    const result = inventoryBody(source, { filename: 'namespace.ts', dialect: 'typescript' });
    assert(result.bodies.some((body) => body.name === 'f'));
    assert(result.bodies.some((body) => source.slice(body.offset, body.end) === '()=>Live.f()'));
  },
);

const appRoot = path.resolve(import.meta.dirname, '../../../sample/nelyx-testbed-app-2');
test(
  'installed Release graph includes external runtime and generated startup with an exact source-map correspondence',
  { timeout, skip: !process.env.NELYX_STATIC_AOT_INVENTORY },
  async () => {
    const runner = path.join(appRoot, 'windows/runner');
    assert(
      fs.existsSync(path.join(runner, 'node_modules/metro/package.json')),
      'Install the actual runner before opting in',
    );
    const load = createRequire(path.join(runner, 'package.json'));
    for (const name of ['metro', 'static-aot']) {
      const installed = path.join(runner, 'node_modules/@nelyx', name),
        source = path.resolve(import.meta.dirname, '../../sdk/tooling', name);
      for (const file of [
        'package.json',
        'README.md',
        'src/runtime-inventory.mjs',
        'src/runtime-inventory.d.mts',
      ])
        assert.deepEqual(
          fs.readFileSync(path.join(installed, file)),
          fs.readFileSync(path.join(source, file)),
          name + '/' + file + ': supply current archives and install the runner',
        );
    }
    const installedEntry = load.resolve('@nelyx/metro/runtime-inventory');
    assert(
      installedEntry.startsWith(path.join(runner, 'node_modules') + path.sep),
      'Inventory must resolve through the installed runner',
    );
    const { inspectRuntimeInventory } = await import(pathToFileURL(installedEntry));
    const result = await inspectRuntimeInventory({
      runner,
      appRoot,
      signal: AbortSignal.timeout(timeout),
    });
    assert.equal(result.entry, 'windows/runner/main.tsx');
    for (const name of [
      'react',
      'react-native-windows',
      'metro-runtime',
      '@react-native/js-polyfills',
      '@nelyx/core',
      '@nelyx/skia-rn',
      '@nelyx/material',
      '@nelyx/cupertino',
    ])
      assert(
        result.modules.some((module) => module.owner.name === name),
        name,
      );
    assert(
      result.modules.some(
        (module) =>
          module.role === 'append' &&
          module.metroId === result.modules.find((module) => module.id === result.entry).metroId,
      ),
    );
    assert(result.modules.some((module) => module.role === 'prepend'));
    const owned = result.modules.filter(
      (module) => module.owner.name.startsWith('@nelyx/') && module.id.includes('/dist/'),
    );
    assert(owned.length > 0);
    assert(owned.every((module) => module.sourceMapSha256 && module.sourceFile.includes('/src/')));
    assert(result.summary.originalBodies > result.summary.modules);
    assert(result.summary.emittedBodies > result.summary.modules);
    assert.equal(result.summary.wholeAppNativeAot, false);
    assert.equal(result.identity.stage, 'pre-partition-release');
    console.log(
      'STATIC_AOT_RUNTIME_INVENTORY ' +
        JSON.stringify({
          sha256: result.sha256,
          ...result.summary,
          runtimeComponents: result.runtimeComponents.length,
          evaluationConflicts: result.evaluationConflicts,
        }),
    );
  },
);
