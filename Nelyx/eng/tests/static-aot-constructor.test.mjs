// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const load = createRequire(import.meta.url),
  transformer = load('../../sdk/tooling/metro/src/native-typed-transformer.cjs'),
  upstream = load('../../sdk/tooling/metro/src/native-hermes-transformer.cjs'),
  babel = load('@babel/core'),
  timeout = 1_200_000;
test(
  'Hermes lowers JSX before TDZ checks and preserves early JSX reference errors',
  { timeout },
  () => {
    const runner = path.resolve(
      import.meta.dirname,
      '../../../sample/nelyx-testbed-app-2/windows/runner',
    );
    for (const early of [false, true]) {
      const src = `const React={createElement(type){return type();}};${early ? 'const result=<Later/>;' : ''}const Later=()=>7;${early ? '' : 'const result=<Later/>;'}globalThis.result=result;`;
      const ast = upstream.transform({
        src,
        filename: path.join(runner, 'tdz-fixture.jsx'),
        options: {
          platform: 'windows',
          dev: false,
          projectRoot: runner,
          enableBabelRCLookup: true,
          enableBabelRuntime: false,
        },
      }).ast;
      const code = babel.transformFromAstSync(ast, src, { configFile: false, babelrc: false }).code;
      const context = vm.createContext({
        require(name) {
          assert.equal(name, 'react/jsx-runtime');
          return { jsx: (type) => type() };
        },
      });
      if (early)
        assert.throws(
          () => vm.runInContext(code, context),
          (error) => error.name === 'ReferenceError',
        );
      else {
        vm.runInContext(code, context);
        assert.equal(context.result, 7);
      }
    }
    const filename = path.join(
      runner,
      'node_modules/react-native-windows/Libraries/Components/Button.windows.js',
    );
    assert(
      upstream.transform({
        src: fs.readFileSync(filename, 'utf8'),
        filename,
        options: {
          platform: 'windows',
          dev: false,
          projectRoot: runner,
          enableBabelRCLookup: true,
        },
      }).ast,
    );
    const loader = path.join(runner, 'node_modules/metro-runtime/src/polyfills/require.js'),
      source = fs.readFileSync(loader, 'utf8'),
      ast = upstream.transform({
        src: source,
        filename: loader,
        options: {
          platform: 'windows',
          dev: false,
          projectRoot: runner,
          enableBabelRCLookup: true,
        },
      }).ast;
    assert(
      load('@babel/parser').parse(
        babel.transformFromAstSync(ast, source, { configFile: false, babelrc: false }).code,
      ),
    );
  },
);
test(
  'implicit base constructor provenance preserves field order, new.target and derived forwarding',
  { timeout },
  () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-constructor-'));
    try {
      const filename = path.join(folder, 'body.js'),
        plan = path.join(folder, 'plan.json');
      const src = `export const Empty=class {}; export const Field=class {value=observe();}; export class Base {constructor(...args){this.args=args;this.target=new.target;}} export const Derived=class extends Base {};`;
      fs.writeFileSync(plan, JSON.stringify({ schema: 'nelyx.typed-metro-plan/v1', files: [] }));
      const options = {
        platform: 'windows',
        dev: false,
        projectRoot: path.resolve(
          import.meta.dirname,
          '../../../sample/nelyx-testbed-app-2/windows/runner',
        ),
        enableBabelRCLookup: true,
        experimentalImportSupport: false,
        customTransformOptions: {
          nelyxTypedPlan: fs.readFileSync(plan, 'utf8'),
          nelyxTypedPlanSha256: createHash('sha256').update(fs.readFileSync(plan)).digest('hex'),
        },
      };
      const original = upstream.transform({ src, filename, options }),
        adapted = transformer.transform({ src, filename, options });
      const execute = (ast) => {
        let observations = 0;
        const context = vm.createContext({
          exports: {},
          require: load,
          observe: () => ++observations,
        });
        vm.runInContext(
          babel.transformFromAstSync(ast, src, { configFile: false, babelrc: false }).code,
          context,
        );
        vm.runInContext(
          `
      const e=new exports.Empty(1,2),f=new exports.Field();
      function Target(){} const reflected=Reflect.construct(exports.Empty,[3,4],Target);
      const d=new exports.Derived(5,6);
      globalThis.result=JSON.stringify({emptyLength:exports.Empty.length,name:exports.Empty.name,prototype:Object.getPrototypeOf(e)===exports.Empty.prototype,field:f.value,reflected:Object.getPrototypeOf(reflected)===Target.prototype,args:d.args,target:d.target===exports.Derived});
    `,
          context,
        );
        return { value: JSON.parse(context.result), observations };
      };
      assert.deepEqual(execute(adapted.ast), execute(original.ast));
      const code = babel.transformFromAstSync(adapted.ast, src, {
        configFile: false,
        babelrc: false,
      }).code;
      assert.match(code, /class extends Base/);
      assert.doesNotMatch(code, /_classCallCheck|_callSuper|_createClass/);
      assert.equal(execute(adapted.ast).value.reflected, true);
    } finally {
      assert.equal(path.dirname(folder), fs.realpathSync(os.tmpdir()));
      assert(!fs.lstatSync(folder).isSymbolicLink());
      fs.rmSync(folder, { recursive: true, force: true });
    }
  },
);
test(
  'Metro elimination provenance retains the source hash and exact removed callable range',
  { timeout },
  async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-frontend-'));
    try {
      const filename = path.join(folder, 'dead.js'),
        plan = path.join(folder, 'plan.json'),
        src = 'function unused(){return 1;} function live(){return 2;} globalThis.live=live;';
      fs.writeFileSync(plan, JSON.stringify({ schema: 'nelyx.typed-metro-plan/v1', files: [] }));
      const options = {
        platform: 'windows',
        dev: false,
        projectRoot: path.resolve(
          import.meta.dirname,
          '../../../sample/nelyx-testbed-app-2/windows/runner',
        ),
        customTransformOptions: {
          nelyxTypedPlan: fs.readFileSync(plan, 'utf8'),
          nelyxTypedPlanSha256: createHash('sha256').update(fs.readFileSync(plan)).digest('hex'),
        },
      };
      const captured = await transformer.withEvidence(() =>
          transformer.transform({ src, filename, options }),
        ),
        evidence = captured.evidence.elimination;
      assert.equal(evidence.sourceSha256, createHash('sha256').update(src).digest('hex'));
      assert(
        evidence.removed.some(
          (range) => range.start.column === 0 && range.end.column === src.indexOf(' function live'),
        ),
      );
      assert(
        !evidence.removed.some((range) => range.start.column === src.indexOf('function live')),
      );
    } finally {
      assert.equal(path.dirname(folder), fs.realpathSync(os.tmpdir()));
      assert(!fs.lstatSync(folder).isSymbolicLink());
      fs.rmSync(folder, { recursive: true, force: true });
    }
  },
);
