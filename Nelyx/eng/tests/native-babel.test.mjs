// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const load = createRequire(import.meta.url),
  babel = load('@babel/core'),
  config = load('../../sdk/tooling/metro/src/babel-config.cjs'),
  timeout = 1_200_000;

test(
  'Hermes lexical lowering matches source loops, including mutable heads and per-iteration TDZ',
  { timeout },
  async () => {
    const projectRoot = path.resolve('sample/nelyx-testbed-app-2/windows/runner'),
      filename = path.resolve('Nelyx/eng/tests/static-aot-language.js'),
      src = fs.readFileSync(filename, 'utf8');
    const transformer = load('../../sdk/tooling/metro/src/native-hermes-transformer.cjs'),
      ast = transformer.transform({
        src,
        filename,
        options: { projectRoot, platform: 'windows', dev: false, enableBabelRuntime: false },
      }).ast;
    const code = babel.transformFromAstSync(ast, src, { configFile: false, babelrc: false }).code;
    assert.deepEqual(
      JSON.parse(await vm.runInNewContext(code, {}, { timeout })),
      JSON.parse(await vm.runInNewContext(src, {}, { timeout })),
    );
    const plain =
      'class Plain {value=7;#secret=3;read(){return this.value+this.#secret}} JSON.stringify([new Plain().value,new Plain().read()])';
    const plainAst = transformer.transform({
      src: plain,
      filename,
      options: { projectRoot, platform: 'windows', dev: false, enableBabelRuntime: false },
    }).ast;
    assert.equal(
      vm.runInNewContext(
        babel.transformFromAstSync(plainAst, plain, { configFile: false, babelrc: false }).code,
        {},
        { timeout },
      ),
      vm.runInNewContext(plain, {}, { timeout }),
    );
  },
);

test(
  'Hermes lowering preserves actual Core error filtering and ancestor mutation loops',
  { timeout },
  () => {
    const ts = load('typescript'),
      projectRoot = path.resolve('sample/nelyx-testbed-app-2/windows/runner');
    const method = (file, className, name) => {
      const text = fs.readFileSync(file, 'utf8'),
        source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      const owner = source.statements.find(
          (node) => ts.isClassDeclaration(node) && node.name?.text === className,
        ),
        node = owner?.members.find((node) => node.name?.getText(source) === name);
      assert(node, 'Actual Core method missing: ' + name);
      return node.getText(source);
    };
    const servicesFile = 'Nelyx/src/services/binding.ts',
      services = ts.createSourceFile(
        servicesFile,
        fs.readFileSync(servicesFile, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      ),
      environment = services.statements
        .filter(
          (node) =>
            ts.isFunctionDeclaration(node) &&
            ['environment', 'lifecycle'].includes(node.name?.text),
        )
        .map((node) => node.getText(services))
        .join('\n');
    const source = `${environment}\nclass PageRoute {policy={};${method('Nelyx/src/framework/widgets/pages.ts', 'PageRoute', 'registerPolicy')}}const owners=new WeakMap();
    const StackFrame={fromStackString:JSON.parse};class FlutterError {static _stackFilters=[{filter(frames,reasons){reasons[0]='group';reasons[1]='group'}}];${method('Nelyx/src/foundation/flutter-error.ts', 'FlutterError', 'defaultStackFilter')}}
    class RenderObject {inputGeometrySubtreeWork=0;parent;${method('Nelyx/src/framework/rendering/object.ts', 'RenderObject', 'changeInputGeometryWork')}}
    export function probe(){const page=new PageRoute(),parent=new RenderObject(),child=new RenderObject();child.parent=parent;child.changeInputGeometryWork(2);child.changeInputGeometryWork(-1);const env=environment(new Map(Object.entries({revision:1,locales:['en-US'],localeSource:'native',brightness:'light',textScale:1,lifecycle:'resumed',localeObservation:'event',capabilities:new Map([['clipboardRead','available'],['clipboardWrite','available'],['navigation','available']]),accessibility:new Map(Object.entries({features:0,supportedFeatures:0,semanticsEnabled:false,source:'native',observation:'poll'}))})));return [FlutterError.defaultStackFilter([JSON.stringify([{className:'Visible',packageScheme:'app',package:'main',source:'first'},{className:'Visible',packageScheme:'app',package:'main',source:'second'},{className:'Visible',packageScheme:'app',package:'main',source:'third'}])]),parent.inputGeometrySubtreeWork,child.inputGeometrySubtreeWork,env,owners.get(page.policy)===page]}`;
    const expected = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const transformer = load('../../sdk/tooling/metro/src/native-hermes-transformer.cjs'),
      ast = transformer.transform({
        src: source,
        filename: path.join(projectRoot, 'core-regression.ts'),
        options: { projectRoot, platform: 'windows', dev: false, enableBabelRuntime: false },
      }).ast;
    const actual = babel.transformFromAstSync(ast, source, {
      configFile: false,
      babelrc: false,
    }).code;
    const run = (code) => {
      const exports = {};
      vm.runInNewContext(code, { exports }, { timeout });
      return JSON.stringify(exports.probe());
    };
    assert.equal(run(actual), run(expected));
  },
);

test(
  'Hermes native frontend preserves the actual application configuration loop before TDZ lowering',
  { timeout },
  async () => {
    const projectRoot = path.resolve('sample/nelyx-testbed-app-2/windows/runner'),
      filename = path.resolve('Nelyx/sdk/src/runtime/config.ts'),
      src = fs.readFileSync(filename, 'utf8');
    const transformer = load('../../sdk/tooling/metro/src/native-hermes-transformer.cjs'),
      ast = transformer.transform({
        src,
        filename,
        options: { projectRoot, platform: 'windows', dev: false, enableBabelRuntime: false },
      }).ast;
    const exports = {},
      code = babel.transformFromAstSync(ast, src, { configFile: false, babelrc: false }).code;
    vm.runInNewContext(code, { exports }, { timeout });
    const configuration = JSON.parse(
        fs.readFileSync('sample/nelyx-testbed-app-2/package.json', 'utf8'),
      ).nelyx,
      { defineConfig } = await import('../../sdk/dist/runtime/config.js');
    assert.equal(
      JSON.stringify(exports.defineConfig(configuration)),
      JSON.stringify(defineConfig(configuration)),
    );
  },
);

test(
  'runner V8/JSC compiler selection is explicit and preserves the default Hermes transform',
  { timeout },
  () => {
    const { createRunnerConfig } = load('../../sdk/tooling/metro/src/runner-config.cjs'),
      runnerRoot = path.resolve('sample/nelyx-testbed-app-2/windows/runner'),
      options = { target: 'windows', runnerRoot, appRoot: path.resolve(runnerRoot, '../..') };
    const legacy = createRunnerConfig(options),
      hermes = createRunnerConfig({ ...options, javaScriptEngine: 'hermes' }),
      v8 = createRunnerConfig({ ...options, javaScriptEngine: 'v8' });
    assert.equal(legacy.transformer.babelTransformerPath, hermes.transformer.babelTransformerPath);
    assert.equal(
      v8.transformer.babelTransformerPath,
      load.resolve('../../sdk/tooling/metro/src/native-v8-transformer.cjs'),
    );
    const jsc = createRunnerConfig({ ...options, javaScriptEngine: 'jsc' });
    assert.equal(
      jsc.transformer.babelTransformerPath,
      load.resolve('../../sdk/tooling/metro/src/native-jsc-transformer.cjs'),
    );
    assert.notEqual(jsc.transformer.babelTransformerPath, v8.transformer.babelTransformerPath);
    assert.throws(
      () => createRunnerConfig({ ...options, target: 'android', javaScriptEngine: 'jsc' }),
      /Windows cohort/,
    );
    assert.throws(
      () => createRunnerConfig({ ...options, target: 'android', javaScriptEngine: 'v8' }),
      /Windows cohort/,
    );
    assert.throws(
      () => createRunnerConfig({ ...options, javaScriptEngine: 'unknown' }),
      /Choose runner JavaScript engine/,
    );
    assert.throws(
      () =>
        createRunnerConfig(
          { ...options, javaScriptEngine: 'v8' },
          { transformer: { babelTransformerPath: 'caller-transformer.cjs' } },
        ),
      /configure custom Babel plugins/,
    );
  },
);

test(
  'V8 compiler executes native fields, inheritance and private/static initialization',
  { timeout },
  () => {
    const transformer = load('../../sdk/tooling/metro/src/native-v8-transformer.cjs'),
      projectRoot = path.resolve('sample/nelyx-testbed-app-2/windows/runner');
    const source =
      'class Base {constructor(...args){this.args=args} set value(v){throw Error("field used inherited setter")}} class Derived extends Base {value=7; #secret=3; callback=(amount=0)=>this.read()+amount; static ready; static {this.ready=11} constructor(...args){super(...args);this.target=new.target} read(){return this.value+this.#secret}} export function probe(){const value=new Derived(19,23),callback=value.callback;return [callback(),Derived.ready,value.target===Derived,Object.hasOwn(value,"value"),value.args[0]+value.args[1]]}';
    const transformed = transformer.transform({
      src: source,
      filename: path.join(projectRoot, 'v8-class-probe.js'),
      options: {
        projectRoot,
        dev: false,
        hot: false,
        platform: 'windows',
        enableBabelRuntime: true,
        experimentalImportSupport: false,
      },
    });
    const output = babel.transformFromAstSync(transformed.ast, source, {
      babelrc: false,
      configFile: false,
    }).code;
    assert.match(output, /class Derived extends Base/);
    assert.doesNotMatch(output, /_callSuper|_createClass|_inherits/);
    const exports = {};
    vm.runInNewContext(output, { exports, require: (specifier) => load(specifier) }, { timeout });
    assert.deepEqual(Array.from(exports.probe()), [10, 11, true, true, 42]);
    for (const filename of [
      path.resolve('Nelyx/dist/framework/widgets/framework.js'),
      path.resolve('Nelyx/dist/framework/widgets/navigation.js'),
      path.resolve('Nelyx/dist/ui/system-color.js'),
      load.resolve('@react-native/js-polyfills/error-guard.js'),
    ]) {
      const result = transformer.transform({
        src: fs.readFileSync(filename, 'utf8'),
        filename,
        options: {
          projectRoot,
          dev: false,
          hot: false,
          platform: 'windows',
          enableBabelRuntime: true,
          experimentalImportSupport: false,
        },
      });
      assert(result.ast?.program.body.length);
    }
  },
);

test(
  'V8 ES2022 target preserves lexical scopes, iterator close and native async generators',
  { timeout },
  async () => {
    const transformer = load('../../sdk/tooling/metro/src/native-v8-transformer.cjs'),
      projectRoot = path.resolve('sample/nelyx-testbed-app-2/windows/runner'),
      cohort = createRequire(path.join(projectRoot, 'package.json'));
    const source =
      'export function probe(){const closures=[];for(const value of [2,3])closures.push(()=>value);let tdz=false;try{void later}catch(error){tdz=error.name==="ReferenceError"}const later=1;let closed=false;function* values(){try{yield 7;yield 8}finally{closed=true}}const [first]=values();const input={a:4,b:5};const {a,...rest}=input;let calls=0;const target={get v(){calls++;return null},set v(value){calls+=value}};target.v??=2;return [closures[0](),closures[1](),tdz,first,closed,a,{...rest}.b,calls,target?.missing??11]} export async function* sequence(){yield await Promise.resolve(4);yield 5}';
    for (const dev of [false, true]) {
      const result = transformer.transform({
        src: source,
        filename: path.join(projectRoot, 'native-es2022-probe.js'),
        options: { projectRoot, dev, hot: false, platform: 'windows', enableBabelRuntime: true },
      });
      const output = cohort('@babel/core').transformFromAstSync(result.ast, source, {
        babelrc: false,
        configFile: false,
      }).code;
      assert.match(output, /for \(const value/);
      assert.match(output, /async function\* sequence/);
      assert.doesNotMatch(output, /_asyncToGenerator|_slicedToArray|_toConsumableArray|_loop\b/);
      const exports = {};
      vm.runInNewContext(output, { exports, require: cohort }, { timeout });
      assert.deepEqual(Array.from(exports.probe()), [2, 3, true, 7, true, 4, 5, 3, 11]);
      const values = [];
      for await (const value of exports.sequence()) values.push(value);
      assert.deepEqual(values, [4, 5]);
    }
  },
);

test(
  'V8 composition keeps consumer Babel overrides, native class semantics and dev refresh in the owning cohort',
  { timeout },
  () => {
    const transformer = load('../../sdk/tooling/metro/src/native-v8-transformer.cjs'),
      runner = path.resolve('sample/nelyx-testbed-app-2/windows/runner');
    const cohort = createRequire(path.join(runner, 'package.json')),
      babel = cohort('@babel/core');
    const directory = fs.mkdtempSync(path.join(runner, '.nelyx-v8-babel-'));
    try {
      fs.writeFileSync(path.join(directory, 'package.json'), '{"private":true}\n');
      const plugin = path.join(directory, 'consumer-plugin.cjs');
      fs.writeFileSync(
        plugin,
        'module.exports=()=>({visitor:{StringLiteral(p){if(p.node.value==="consumer-alias")p.node.value="preserved"}}});\n',
      );
      fs.writeFileSync(
        path.join(directory, 'babel.config.cjs'),
        'module.exports={...require(' +
          JSON.stringify(cohort.resolve('@nelyx/metro/babel-config')) +
          '),overrides:[{test:/probe/,plugins:[' +
          JSON.stringify(plugin) +
          ']}]};\n',
      );
      const source =
        'class Base {constructor(...args){this.args=args} set value(v){throw Error("inherited setter")}} class Derived extends Base {value=7;#secret=3;callback=()=>this.value+this.#secret;static ready;static {this.ready=11}static branded(value){return #secret in value}constructor(...args){super(...args);this.target=new.target}} export function probe(){const value=new Derived(2,3),callback=value.callback;return [callback(),Derived.ready,value.target===Derived,Object.hasOwn(value,"value"),value.args.join(","),"consumer-alias",Derived.branded(value),Derived.branded({})]}';
      for (const dev of [false, true]) {
        const transformed = transformer.transform({
          src: source,
          filename: path.join(directory, 'probe.js'),
          options: {
            projectRoot: directory,
            dev,
            hot: false,
            platform: 'windows',
            enableBabelRuntime: true,
            experimentalImportSupport: false,
          },
        });
        const output = babel.transformFromAstSync(transformed.ast, source, {
          babelrc: false,
          configFile: false,
        }).code;
        assert.match(output, /class Derived extends Base/);
        assert.doesNotMatch(output, /_callSuper|_createClass|_inherits/);
        const exports = {};
        vm.runInNewContext(output, { exports, require: cohort }, { timeout });
        assert.deepEqual(Array.from(exports.probe()), [
          10,
          11,
          true,
          true,
          '2,3',
          'preserved',
          true,
          false,
        ]);
      }
      const jsx =
        'import * as React from "react";export function Consumer(){return <React.Fragment/>}';
      const transformed = transformer.transform({
        src: jsx,
        filename: path.join(directory, 'probe.tsx'),
        options: {
          projectRoot: directory,
          dev: true,
          hot: true,
          platform: 'windows',
          enableBabelRuntime: true,
          experimentalImportSupport: false,
        },
      });
      assert.match(
        babel.transformFromAstSync(transformed.ast, jsx, { babelrc: false, configFile: false })
          .code,
        /\$RefreshReg\$/,
      );
      assert.throws(
        () =>
          transformer.transform({
            src: '',
            filename: path.join(directory, 'probe.js'),
            options: { projectRoot: directory, platform: 'android' },
          }),
        /Windows V8 cohort/,
      );
      fs.rmSync(path.join(directory, 'babel.config.cjs'));
      const fallback = transformer.transform({
        src: 'export class Native {value=7}',
        filename: path.join(directory, 'fallback.js'),
        options: {
          projectRoot: directory,
          dev: false,
          platform: 'windows',
          unstable_transformProfile: 'hermes-stable',
        },
      });
      assert.match(
        babel.transformFromAstSync(fallback.ast, '', { babelrc: false, configFile: false }).code,
        /class Native/,
      );
      const nested = path.join(directory, 'nested');
      fs.mkdirSync(nested);
      fs.writeFileSync(
        path.join(nested, '.babelrc.cjs'),
        'module.exports={plugins:[' + JSON.stringify(plugin) + ']};\n',
      );
      const augmented = transformer.transform({
        src: 'export class Flow {value:number=7;label="consumer-alias"}',
        filename: path.join(nested, 'probe.js'),
        options: { projectRoot: directory, dev: false, platform: 'windows' },
      });
      const augmentedCode = babel.transformFromAstSync(augmented.ast, '', {
        babelrc: false,
        configFile: false,
      }).code;
      assert.match(augmentedCode, /class Flow/);
      assert.match(augmentedCode, /preserved/);
      assert.doesNotMatch(augmentedCode, /value: number/);
    } finally {
      assert.equal(path.dirname(directory), runner);
      assert(path.basename(directory).startsWith('.nelyx-v8-babel-'));
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  },
);
test(
  'native Babel lowers actual ES2022 Core initialization and preserves palette factories/cache in dev and release',
  { timeout },
  () => {
    const filename = path.resolve('Nelyx/dist/ui/system-color.js'),
      source = fs.readFileSync(filename, 'utf8');
    for (const dev of [true, false]) {
      const result = babel.transformSync(source, {
        ...config,
        filename,
        babelrc: false,
        configFile: false,
        presets: [[config.presets[0], { dev, disableImportExportTransform: false }]],
      });
      assert(result?.code);
      const exports = {},
        provider = {
          color: (brightness, name) => {
            assert.equal(brightness, 'light');
            assert.equal(name, 'AccentColor');
            return 0xff112233;
          },
        };
      vm.runInNewContext(
        result.code,
        {
          exports,
          require: (specifier) => {
            if (specifier.startsWith('@babel/runtime/helpers/')) return load(specifier);
            assert.equal(specifier, './system-color-provider.js');
            return { currentSystemColorProvider: () => provider };
          },
        },
        { timeout },
      );
      assert.equal(exports.SystemColor.light.brightness, 'light');
      assert.equal(exports.SystemColor.dark.brightness, 'dark');
      assert(Object.isFrozen(exports.SystemColor.light));
      assert.equal(exports.SystemColor.light.accentColor.value, 0xff112233);
      assert.equal(exports.SystemColor.light.accentColor, exports.SystemColor.light.accentColor);
      assert.equal(exports.SystemColor.platformProvidesSystemColors, true);
    }
  },
);
test(
  'actual RN Metro transformer loads the common cjs config once for Flow polyfills and ES2022 product code',
  { timeout },
  () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-native-babel-'));
    try {
      fs.writeFileSync(
        path.join(directory, 'babel.config.cjs'),
        'module.exports=require(' +
          JSON.stringify(load.resolve('../../sdk/tooling/metro/src/babel-config.cjs')) +
          ');\n',
      );
      const transformer = load('@react-native/metro-babel-transformer');
      for (const filename of [
        path.resolve('Nelyx/dist/ui/system-color.js'),
        load.resolve('@react-native/js-polyfills/error-guard.js'),
      ]) {
        const result = transformer.transform({
          filename,
          src: fs.readFileSync(filename, 'utf8'),
          options: {
            projectRoot: directory,
            dev: true,
            hot: false,
            platform: 'android',
            hermesParser: false,
            enableBabelRCLookup: true,
            enableBabelRuntime: true,
            experimentalImportSupport: false,
          },
        });
        assert(result.ast?.program.body.length);
      }
    } finally {
      assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
      assert(path.basename(directory).startsWith('nelyx-native-babel-'));
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  },
);
