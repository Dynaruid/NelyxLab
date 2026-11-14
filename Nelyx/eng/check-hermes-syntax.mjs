// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { buildSync, transformSync } from 'esbuild';
import { windowsCompilerEnvironment } from '../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {
  windowsHermesPolicy,
  windowsHermesSyntax,
} from '../sdk/tooling/cli/src/windows-hermes-policy.mjs';
import { windowsHermesSyntaxPolicy } from '../sdk/tooling/cli/src/windows-hermes-syntax.mjs';
import { windowsNativeHermesCohort } from '@nelyx/sdk/runtime/cohorts';
import { textStyleApplyReference } from './text-style-apply-reference.mjs';
import { elementConstructionFixture } from './element-construction-fixture.mjs';
import { layoutEncoderFixture } from './layout-encoder-fixture.mjs';
import { sceneKeyFixture } from './scene-key-fixture.mjs';
import { boxCommandCacheFixture } from './box-command-cache-fixture.mjs';
import { dependencyScopeFixture } from './dependency-scope-fixture.mjs';
import { inheritedAncestorFixture } from './inherited-ancestor-fixture.mjs';
import { privateFieldFixture, privateCoreFixture } from './private-field-fixture.mjs';
import { compileHermesImage } from '../sdk/tooling/cli/src/windows-hermes-image.mjs';
import { verifyNativeHermes } from '../sdk/tooling/cli/src/windows-native-hermes-toolchain.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const parent = path.join(root, '.nelyx');
const temporary = fs.mkdtempSync(path.join(parent, 'hermes-syntax-'));
if (!temporary.startsWith(parent + path.sep)) throw Error('Temporary check escaped its owner');
// Leave cleanup time inside the caller's 20-minute process timeout.
const deadline = Date.now() + 1_170_000;
const hermes = path.join(root, '.nelyx/windows-hermes');
const toolchainOnly = process.argv.includes('--toolchain-only');
const syntaxPolicy = windowsHermesSyntaxPolicy(windowsNativeHermesCohort());
assert.equal(syntaxPolicy.supported['class-field'], true);
assert.equal(syntaxPolicy.supported['class-static-field'], true);
assert.equal(
  windowsHermesSyntax['class-static-field'],
  undefined,
  'Stock RNW static lowering changed',
);
for (const feature of ['class-private-field', 'class-private-brand-check']) {
  assert.equal(syntaxPolicy.supported[feature], true);
  assert.equal(windowsHermesSyntax[feature], undefined, 'Stock RNW private lowering changed');
}
for (const feature of ['class-private-method', 'class-private-accessor'])
  assert.equal(syntaxPolicy.supported[feature], undefined, 'Private member lowering changed');
assert.equal(windowsHermesSyntax['class-field'], undefined, 'Stock RNW syntax changed');
assert.equal(
  windowsHermesSyntaxPolicy({
    engine: 'hermes',
    engineVersion: '1.0.0',
    engineRevision: '94aa5e1d40a4ce99df79d951cbe45310ec40680c',
    bytecodeVersion: 99,
    framework: 'react-native-windows',
    frameworkVersion: '0.83.2',
  }).supported,
  windowsHermesSyntax,
);
assert.throws(() => windowsHermesSyntaxPolicy({}), /policy requires/);
const supply = toolchainOnly
  ? path.join(hermes, 'build/bin')
  : path.join(root, 'Nelyx/engine/dist/windows-app-sdk');
const env = windowsCompilerEnvironment();
const compilerRequire = createRequire(
  path.join(root, 'Nelyx/sdk/tooling/cli/src/engine-v2-runner.mjs'),
);
const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
env[pathKey] =
  (toolchainOnly ? path.join(hermes, 'build/lib') + path.delimiter : '') +
  supply +
  path.delimiter +
  env[pathKey];
const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: temporary,
    env,
    encoding: 'utf8',
    timeout: Math.max(1, deadline - Date.now()),
    windowsHide: true,
  });
  if (result.error || result.status)
    throw Error(`${command}: ${result.error ?? result.status}\n${result.stdout}${result.stderr}`);
  return result.stdout.trim();
};
async function runNativeUnit(source, name) {
  const controller = new AbortController(),
    timer = setTimeout(
      () => controller.abort(Error('Native unit check exceeded the test deadline')),
      Math.max(1, deadline - Date.now()),
    );
  try {
    const checked = verifyNativeHermes(hermes),
      library = path.join(temporary, name + '.dll');
    const build = await compileHermesImage({
      checked,
      env,
      output: library,
      runtimeLibrary: path.join(hermes, 'build/lib/hermesvm.lib'),
      signal: controller.signal,
      units: [
        {
          name: 'nelyx_probe',
          source,
          flags: [
            ...windowsHermesPolicy('optimized', windowsNativeHermesCohort()).flags,
            '-Xes6-block-scoping',
            '-emit-async-break-check',
            '-g1',
          ],
          typed: false,
          requireNumeric: false,
        },
      ],
    });
    return {
      result: run(path.join(temporary, 'check.exe'), ['--native-unit', library]),
      buildMs: build.buildMs,
    };
  } finally {
    clearTimeout(timer);
  }
}
try {
  fs.writeFileSync(
    path.join(temporary, 'check.cpp'),
    `
    #include <hermes/hermes.h>
    #include <jsi/jsi.h>
    #define WIN32_LEAN_AND_MEAN
    #define NOMINMAX
    #include <windows.h>
    #include <filesystem>
    #include <fstream>
    #include <iostream>
    #include <sstream>
    struct OwnedUnitLibrary {
      HMODULE value=nullptr;
      ~OwnedUnitLibrary(){if(value)FreeLibrary(value);}
    };
    int wmain(int argc,wchar_t** argv){OwnedUnitLibrary library;try{
      if(argc!=2&&argc!=3)return 2;
      auto rt=facebook::hermes::makeHermesRuntime(::hermes::vm::RuntimeConfig::Builder().withMicrotaskQueue(true).withES6BlockScoping(true).build());
      if(argc==3){
        if(std::wstring(argv[1])!=L"--native-unit")return 2;
        library.value=LoadLibraryExW(argv[2],nullptr,LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR|LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);
        if(!library.value)throw std::runtime_error("Native unit library load failed: "+std::to_string(GetLastError()));
        const auto factory=reinterpret_cast<SHUnitCreator>(GetProcAddress(library.value,"sh_export_nelyx_probe"));
        if(!factory)throw std::runtime_error("Native unit factory is absent");
        rt->evaluateSHUnit(factory);
      }else{
        std::ifstream file(std::filesystem::path(argv[1]),std::ios::binary);std::stringstream data;data<<file.rdbuf();
        rt->evaluateJavaScript(std::make_shared<facebook::jsi::StringBuffer>(data.str()),"syntax.hbc");
      }
      rt->drainMicrotasks();
      std::cout<<rt->global().getProperty(*rt,"result").getString(*rt).utf8(*rt)<<"\\n";
    }catch(const facebook::jsi::JSError& e){std::cerr<<e.getStack()<<"\\n";return 1;}
    catch(const std::exception& e){std::cerr<<e.what()<<"\\n";return 1;}return 0;}
  `,
  );
  run('cl.exe', [
    '/nologo',
    '/std:c++20',
    '/EHsc',
    '/MD',
    '/O2',
    '/DJSI_USE_HERMES',
    '/DNDEBUG',
    '/I' + path.join(hermes, 'source/API'),
    '/I' + path.join(hermes, 'source/API/jsi'),
    '/I' + path.join(hermes, 'source/public'),
    'check.cpp',
    path.join(hermes, 'build/lib/hermesvm.lib'),
    path.join(hermes, 'build/jsi/jsi.lib'),
    '/Fe:check.exe',
  ]);
  // A small Widget graph cannot qualify module initialization of the real App.
  // This optional probe stops before launchApp, so it requires no native host.
  const applicationInit = process.argv.find((argument) =>
    argument.startsWith('--application-init='),
  );
  if (applicationInit) {
    const application = fs.readFileSync(
      path.resolve(applicationInit.slice('--application-init='.length)),
      'utf8',
    );
    const launch = 'launchApp(app_default);';
    assert.equal(application.split(launch).length, 2, 'Expected exactly one canonical App launch');
    const source = path.join(temporary, 'application-init.js');
    fs.writeFileSync(
      source,
      application.replace(launch, 'globalThis.result="App module initialization PASS";'),
    );
    let failed = false;
    for (const profile of ['debug', 'optimized']) {
      const bytecode = path.join(temporary, 'application-init-' + profile + '.hbc');
      run(path.join(supply, 'hermesc.exe'), [
        ...windowsHermesPolicy(profile, windowsNativeHermesCohort()).flags,
        '-Xes6-block-scoping',
        '-emit-binary',
        '-out',
        bytecode,
        source,
      ]);
      try {
        console.log(profile + ': ' + run(path.join(temporary, 'check.exe'), [bytecode]));
      } catch (error) {
        failed = true;
        console.error(profile + ': ' + error.message);
      }
    }
    assert(!failed, 'The actual App module initialization failed in the pinned VM');
    if (process.argv.includes('--native-unit')) {
      const native = await runNativeUnit(source, 'application-init');
      assert.equal(native.result, 'App module initialization PASS');
      console.log('Pinned upstream native unit: actual App module initialization PASS.', {
        buildMs: native.buildMs,
      });
    }
  }
  const liveNames = Array.from({ length: 650 }, (_, index) => 'live' + index);
  const typescript = compilerRequire('typescript');
  const parameterPropertyFixture = typescript.transpileModule(
    `
    class ParameterFields {
      observed = {own:Object.hasOwn(this,'value'),value:this.value};
      constructor(public value:number) {}
    }
    const parameterFields=new ParameterFields(17);
    check(parameterFields.observed.own && parameterFields.observed.value===undefined && parameterFields.value===17,
      'ES2022 package parameter-property initialization order');
    check(Object.keys(parameterFields).join(',')==='value,observed','parameter-property enumeration order');
  `,
    {
      compilerOptions: {
        target: typescript.ScriptTarget.ES2022,
        useDefineForClassFields: true,
        module: typescript.ModuleKind.None,
      },
    },
  ).outputText;
  const classSpillFixture = `
    globalThis.spillValue=()=>({value:7});
    globalThis.spillObserve=(...values)=>{if(values.length!==650||values.some(value=>value.value!==7))throw Error('Class spill corrupted a live value');};
    (()=>{
      ${liveNames.map((name) => 'const ' + name + '=globalThis.spillValue();').join('\n')}
      const Implicit=diagnostic(class {});
      const Explicit=diagnostic(class {constructor(){}});
      const first=new Implicit(),second=new Explicit();
      check(first.describe()==='value'&&second.describe()==='value','wide-register class constructor/home-object spill');
      const Named=class NamedClass {constructor(value){this.value=value;}static create(value){return new NamedClass(value);}};
      check(typeof Named==='function'&&Named.create(1234).value===1234,'wide-register named class constructor spill');
      globalThis.spillObserve(${liveNames.join(',')});
    })();
    delete globalThis.spillValue;delete globalThis.spillObserve;
  `;
  const fixture = `
    const check=(ok,message)=>{if(!ok)throw Error(message);};
    const notNumber=Number.NaN,negativeZero=-0;
    check(notNumber!==notNumber&&!(notNumber===notNumber)&&Object.is(notNumber,NaN),'NaN equality');
    check(negativeZero===0&&!Object.is(negativeZero,0)&&1/negativeZero===-Infinity,'signed zero');
    check(typeof Intl==='object'&&typeof Intl.DateTimeFormat==='function'&&typeof Intl.NumberFormat==='function','native Intl availability');
    check(new Intl.DateTimeFormat('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(2026,10,15)))==='November 15, 2026','native Intl date formatting');
    const symbol=Symbol('key');let reads=0,setters=0;
    const source=Object.create({inherited:3});
    Object.defineProperties(source,{value:{enumerable:true,get(){++reads;return 7;}},hidden:{value:9},__proto__:{value:null}});
    Object.defineProperty(source,'__proto__',{enumerable:true,value:11});source[symbol]=13;
    const copy={...null,...undefined,...source,value:17};
    check(reads===1&&copy.value===17&&copy[symbol]===13&&!('inherited' in copy)&&!('hidden' in copy),'spread ownership/getters/symbols');
    check(Object.getPrototypeOf(copy)===Object.prototype&&Object.hasOwn(copy,'__proto__')&&copy.__proto__===11,'spread proto safety');
    const {value,...rest}=copy;
    check(value===17&&!Object.hasOwn(rest,'value')&&rest[symbol]===13,'rest exclusions');
    if(globalThis.nativeSyntax)check(Object.hasOwn(rest,'__proto__')&&rest.__proto__===11,'native rest proto safety');
    class Base {set value(v){++setters;}}
    class Child extends Base { value=21; next=this.value+1; static first=23; static next=this.first+1; }
    const child=new Child();const descriptor=Object.getOwnPropertyDescriptor(child,'value');
    check(setters===0&&child.next===22&&Child.next===24&&descriptor.enumerable&&descriptor.writable&&descriptor.configurable,'field define semantics and order');
    ${parameterPropertyFixture}
    (()=>{
    const fieldOrder=[],fieldSymbol=Symbol('field');let keyEvaluations=0,valueEvaluations=0;
    const fieldKey=()=>{++keyEvaluations;fieldOrder.push('key');return fieldSymbol;};
    class FieldBase {
      first=(fieldOrder.push('base-field'),11);
      empty;
      constructor(){fieldOrder.push('base-body');check(!Object.hasOwn(this,'derived'),'derived field visible during base constructor');}
    }
    class FieldChild extends FieldBase {
      derived=(fieldOrder.push('derived-field'),this.first+1);
      [fieldKey()]=++valueEvaluations;
      last=(fieldOrder.push('last'),this.derived+1);
    }
    check(keyEvaluations===1&&valueEvaluations===0&&fieldOrder.join(',')==='key','computed key evaluated at class definition');
    const fieldFirst=new FieldChild(),fieldSecond=new FieldChild();
    check(keyEvaluations===1&&valueEvaluations===2&&fieldFirst[fieldSymbol]===1&&fieldSecond[fieldSymbol]===2,'computed value evaluated per instance');
    check(Object.keys(fieldFirst).join(',')==='first,empty,derived,last'&&Object.hasOwn(fieldFirst,'empty')&&fieldFirst.empty===undefined,'undefined own field and enumeration order');
    check(fieldOrder.join(',')==='key,base-field,base-body,derived-field,last,base-field,base-body,derived-field,last','base/derived field and constructor order');
    const fieldFailure={reason:'initializer'},failedFields=[];let caughtField;
    class FailingFields {first=failedFields.push(1);second=(()=>{throw fieldFailure;})();third=failedFields.push(3);}
    try{new FailingFields();}catch(error){caughtField=error;}
    check(caughtField===fieldFailure&&failedFields.join(',')==='1','field exception identity and short circuit');
    const keyFailure={reason:'key'};let caughtKey,keyValueRan=false;
    try{class BadKey {[(()=>{throw keyFailure;})()]=(keyValueRan=true);}}catch(error){caughtKey=error;}
    check(caughtKey===keyFailure&&!keyValueRan,'computed key exception identity and order');
    if(globalThis.nativeFields){
      class NamedFields {callback=()=>{};['named']=function(){};[fieldSymbol]=()=>{};}
      const namedFields=new NamedFields();
      check(namedFields.callback.name==='callback'&&namedFields.named.name==='named'&&namedFields[fieldSymbol].name==='[field]','anonymous field function names');
    }
    })();
    class Parent {constructor(v){this.v=v;} get doubled(){return this.v*2;} method(){return this.v+1;} static code(){return 31;} }
    const mixin=Type=>class extends Type {method(){return super.method()+2;} get doubled(){return super.doubled+1;}};
    class Mixed extends mixin(Parent) { field=this.method();static code(){return super.code()+1;} }
    const mixed=Reflect.construct(Mixed,[5]);
    check(mixed instanceof Mixed&&mixed instanceof Parent&&mixed.field===8&&mixed.doubled===11&&Mixed.code()===32,'mixin inheritance and Reflect.construct');
    class Entries extends Array {total(){return this.reduce((a,b)=>a+b,0);}}
    class Failure extends Error {code=17;}
    const entries=new Entries(2,3),failure=new Failure('expected');
    check(entries instanceof Array&&entries.total()===5&&failure instanceof Error&&failure.message==='expected'&&failure.code===17,'builtin subclass construction');
    if(globalThis.nativeClasses){
      const targets=[];
      class TargetBase {constructor(value){targets.push(new.target);this.value=value;}}
      class TargetChild extends TargetBase {}
      function AlternateTarget(){}
      const alternate=Reflect.construct(TargetChild,[37],AlternateTarget);
      check(targets[0]===AlternateTarget&&Object.getPrototypeOf(alternate)===AlternateTarget.prototype&&alternate.value===37,'custom new.target through implicit super');
      class ReplacementBase {constructor(value){targets.push(new.target);this.value=value+1;}}
      Object.setPrototypeOf(TargetChild,ReplacementBase);
      const replacement=new TargetChild(41);
      check(targets[1]===TargetChild&&replacement.value===42&&Object.getPrototypeOf(replacement)===TargetChild.prototype,'replacement superclass with original new.target');
      const returned={value:43};
      class ReturnsObject {constructor(){return returned;}}
      class UsesReturnedObject extends ReturnsObject {field=this.value+1;}
      check(new UsesReturnedObject()===returned&&returned.field===44,'super constructor replacement object and field order');
      let denied=false;try{Reflect.apply(TargetBase,TargetBase.prototype,[47]);}catch(error){denied=error instanceof TypeError;}
      check(denied,'native class call without new');
    }
    const diagnostic=Base=>class extends Base { describe(){return 'value';} };
    class First extends diagnostic(class {}) {}
    class Second extends diagnostic(class {}) { constructor(options={}){super();this.options=options;} }
    check(new First().describe()==='value'&&new Second().describe()==='value','anonymous empty mixin bases');
    ${classSpillFixture}
    ${privateFieldFixture()}
    let sum=0;const started=Date.now();
    for(let pass=0;pass<12;++pass) for(let i=0;i<1000;++i){
      const a={a:i,b:2,c:3,d:4,e:5,f:6,g:7,h:8};
      const b={...a,...{i:9},...{j:10},...{k:11},...{l:12},...{m:13},...{n:14},...{o:15}};
      const {a:leading,...tail}=b;sum+=leading+tail.o+new Child().next;
    }
    const elapsedMs=Date.now()-started;
    async function continuations() {
      await globalThis.privateFieldPending;
      const order=[];let reads=0;
      const receiver={base:7,async method(v){await 0;return this.base+v;}};
      const arrow=function(v){return (async()=>{await 0;return this.base+arguments[0];})();};
      check(await receiver.method(5)===12&&await arrow.call(receiver,6)===13,'async receiver/arrow arguments');
      const adopted=await {get then(){++reads;return resolve=>resolve(17);}};
      check(adopted===17&&reads===1,'await thenable adoption');
      async function failure(){try{await Promise.reject(19);}catch(error){order.push(error);}finally{await 0;order.push(23);}return 29;}
      check(await failure()===29&&order.join(',')==='19,23','async catch/finally/return');
      class AsyncBase {async value(){await 0;return 31;}}
      class AsyncChild extends AsyncBase {async value(){return (await super.value())+1;}}
      check(await new AsyncChild().value()===32,'async super');
      let synchronous=true;const pending=(async()=>{await 0;check(!synchronous,'await must suspend');})();
      synchronous=false;await pending;
      const values=await Promise.all([receiver.method(3),receiver.method(4)]);
      check(values.join(',')==='10,11','async concurrent completion');
      globalThis.result=JSON.stringify({sum,elapsedMs,private:globalThis.privateFieldResult});
    }
    continuations();
  `;
  const outputs = {};
  for (const [name, supported] of [
    ['lowered', { bigint: true }],
    ['native', windowsHermesSyntax],
    ...(!process.argv.includes('--babel-classes')
      ? [['instance-fields', syntaxPolicy.supported]]
      : []),
  ]) {
    const code = transformSync(
      'globalThis.nativeSyntax=' +
        String(name !== 'lowered') +
        ';globalThis.nativeFields=' +
        String(name === 'instance-fields') +
        ';globalThis.nativeClasses=' +
        String(!process.argv.includes('--babel-classes')) +
        ';' +
        fixture,
      { target: 'es2015', supported, format: 'iife' },
    ).code;
    if (name !== 'lowered')
      assert(
        !/__spreadValues|__spreadProps|__async/.test(code),
        'Qualified syntax was lowered again',
      );
    if (name === 'instance-fields')
      assert(
        !/__publicField\(this,/.test(code),
        'Instance fields were lowered to per-field helpers',
      );
    const sourceFile = path.join(temporary, name + '.js'),
      bytecode = path.join(temporary, name + '.hbc');
    const lowered = process.argv.includes('--babel-classes')
      ? compilerRequire('@babel/core').transformSync(code, {
          configFile: false,
          babelrc: false,
          plugins: [compilerRequire.resolve('@babel/plugin-transform-classes')],
        })
      : { code };
    fs.writeFileSync(sourceFile, lowered.code);
    for (const profile of process.argv.includes('--debug-classes')
      ? ['debug']
      : ['debug', 'optimized']) {
      run(path.join(supply, 'hermesc.exe'), [
        ...windowsHermesPolicy(profile, windowsNativeHermesCohort()).flags,
        '-Xes6-block-scoping',
        '-emit-binary',
        '-out',
        bytecode,
        sourceFile,
      ]);
      try {
        outputs[name + '/' + profile] = JSON.parse(
          run(path.join(temporary, 'check.exe'), [bytecode]),
        );
      } catch (error) {
        throw Error(name + '/' + profile + ': ' + error.message);
      }
    }
    if (
      name === 'instance-fields' &&
      (process.argv.includes('--native-unit') || process.argv.includes('--native-syntax'))
    ) {
      const native = await runNativeUnit(sourceFile, 'syntax');
      outputs[name + '/native-unit'] = JSON.parse(native.result);
      console.log('Pinned upstream native unit: class/field, numeric and async semantics PASS.', {
        buildMs: native.buildMs,
      });
    }
  }
  for (const result of Object.values(outputs)) {
    assert.equal(result.sum, outputs[Object.keys(outputs)[0]].sum);
    assert.deepEqual(result.private, outputs[Object.keys(outputs)[0]].private);
  }
  console.log(
    'Pinned compiler + VM spread/rest/symbol/getter/proto, async and class field semantics PASS.',
    outputs,
  );
  // Inspect the actual qualified compiler outputs as well as executing HBC.
  // One narrow field fixture bounds output independently of the wide spill test.
  const fieldFile = path.join(temporary, 'field-ir.js');
  fs.writeFileSync(
    fieldFile,
    'class Fields { missing; first=7; next=this.first+1; } globalThis.result=new Fields();',
  );
  const fieldIR = run(path.join(supply, 'hermesc.exe'), [
    '-Og',
    '-Xes6-block-scoping',
    '-dump-ir',
    fieldFile,
  ]);
  const fieldHBC = run(path.join(supply, 'hermesc.exe'), [
    '-O',
    '-Xes6-block-scoping',
    '-dump-bytecode',
    fieldFile,
  ]);
  assert(
    /instance_members_initializer/.test(fieldIR),
    'Native field initializer missing from actual IR',
  );
  assert(
    /DefineOwnProperty|StoreNewOwnProperty|StoreOwnProperty/.test(fieldIR),
    'Own field definitions missing from IR',
  );
  assert(/DefineOwnById/.test(fieldHBC), 'Own field definition missing from actual HBC');
  assert(
    /NewObjectWithBufferAndParent/.test(fieldHBC),
    'Initial field shape missing from actual HBC',
  );
  console.log('Native field IR/HBC PASS.', {
    irInitializers: (fieldIR.match(/instance_members_initializer/g) ?? []).length,
    hbcNamedInitializers: (fieldHBC.match(/instance_members_initializer/g) ?? []).length,
    hbcOwnDefinitions: (fieldHBC.match(/DefineOwnById/g) ?? []).length,
    hbcInitialShapes: (fieldHBC.match(/NewObjectWithBufferAndParent/g) ?? []).length,
  });
  const privateFile = path.join(temporary, 'private-field-ir.js');
  fs.writeFileSync(
    privateFile,
    'class PrivateFields { #value=17; read(){return this.#value;} update(){this.#value++;} static has(value){return #value in value;} } globalThis.result=new PrivateFields();',
  );
  const privateIR = run(path.join(supply, 'hermesc.exe'), [
    '-Og',
    '-Xes6-block-scoping',
    '-dump-ir',
    privateFile,
  ]);
  const privateHBC = run(path.join(supply, 'hermesc.exe'), [
    '-O',
    '-Xes6-block-scoping',
    '-dump-bytecode',
    privateFile,
  ]);
  for (const operation of ['AddOwnPrivateField', 'LoadOwnPrivateField', 'StoreOwnPrivateField'])
    assert(privateIR.includes(operation), 'Missing private IR operation: ' + operation);
  for (const operation of ['AddOwnPrivateBySym', 'GetOwnPrivateBySym', 'PutOwnPrivateBySym'])
    assert(privateHBC.includes(operation), 'Missing private HBC operation: ' + operation);
  assert(!privateHBC.includes('WeakMap'), 'Private field probe still uses a WeakMap');
  console.log('Pinned private field IR/HBC: direct own private add/get/put operations PASS.');
  if (process.argv.includes('--native-unit') || process.argv.includes('--native-syntax')) {
    const source = path.join(temporary, 'layout-encoder.js'),
      bytecode = path.join(temporary, 'layout-encoder.hbc'),
      code = buildSync({
        stdin: {
          resolveDir: root,
          loader: 'ts',
          contents: `import {commands as layoutCommands,protocol as layoutProtocol} from './Nelyx/runtime/engine-client/codec.ts';
            ${layoutEncoderFixture()}
            ${sceneKeyFixture()}
            ${boxCommandCacheFixture()}
            ${dependencyScopeFixture()}
            ${inheritedAncestorFixture()}
            globalThis.result=JSON.stringify({layout:layoutEncoderResult,keys:sceneKeyResult,boxCache:boxCommandCacheResult,dependency:dependencyScopeResult,ancestor:inheritedAncestorResult});`,
        },
        bundle: true,
        write: false,
        format: 'iife',
        target: 'es2015',
        supported: syntaxPolicy.supported,
        logLevel: 'silent',
      }).outputFiles[0].text;
    fs.writeFileSync(source, code);
    let expected;
    for (const profile of ['debug', 'optimized']) {
      run(path.join(supply, 'hermesc.exe'), [
        ...windowsHermesPolicy(profile, windowsNativeHermesCohort()).flags,
        '-Xes6-block-scoping',
        '-emit-binary',
        '-out',
        bytecode,
        source,
      ]);
      const result = JSON.parse(run(path.join(temporary, 'check.exe'), [bytecode]));
      if (expected) assert.deepEqual(result, expected);
      else expected = result;
    }
    const native = await runNativeUnit(source, 'layout-encoder');
    assert.deepEqual(JSON.parse(native.result), expected);
    console.log(
      'Layout/Scene keys/Box cache/Dependency scope: getter/error order, wire, signed zero, full uint32 generations, bounded bodies and provider lookup PASS in debug/optimized HBC and native unit.',
      expected,
    );
  }
  const cachedFixture = buildSync({
    stdin: {
      resolveDir: root,
      loader: 'ts',
      contents: `
    import {ObservationDecodeCache} from './Nelyx/runtime/engine-client/observation-cache.ts';
    import {semanticBody,readSemanticBody} from './Nelyx/runtime/engine-client/semantics.ts';
    import {SceneNode,SceneReference,SceneWriter,sceneConfiguration,retainSceneConfiguration,immutableSceneData,renderBindingConfiguration} from './Nelyx/dist/v2/engine-client/scene.js';
    import {protocol as p} from './Nelyx/dist/v2/engine-client/schema.js';
    import {DateTime} from './packages/material/dist/internal/date/date-time.js';
    import {ownFieldInitializer} from './Nelyx/dist/ui/value-math.js';
    import {SemanticsProperties,sourceSemanticsProperties} from './Nelyx/dist/framework/semantics/semantics.js';
    import {TextStyle} from './Nelyx/dist/framework/painting/text-style.js';
    import {FontWeight,kTextHeightNone} from './Nelyx/dist/ui/typography.js';
    import {invariant} from './Nelyx/dist/foundation/errors.js';
    import {FoundationBuildMode} from './Nelyx/dist/foundation/constants.js';
    import {Rect as PrivateCoreRect} from './Nelyx/dist/ui/rect.js';
    import {Offset as PrivateCoreOffset} from './Nelyx/dist/ui/offset.js';
    import {EdgeInsets as PrivateCoreInsets,EdgeInsetsDirectional as PrivateCoreDirectionalInsets} from './Nelyx/dist/framework/painting/edge-insets.js';
    import {Alignment as PrivateCoreAlignment} from './Nelyx/dist/framework/painting/alignment.js';
    import {DartMap as PrivateCoreDartMap,DartSet as PrivateCoreDartSet} from './Nelyx/dist/foundation/dart-collections.js';
    import {BuildOwner,ComponentElement,StatefulElement,ProxyElement,InheritedElement,State,StatelessWidget,StatefulWidget,InheritedWidget} from './Nelyx/dist/framework/widgets/framework.js';
    import {LayoutBuilder,nativeLayoutBuilderCosts} from './Nelyx/dist/framework/widgets/layout-builder.js';
    import {SizedBox} from './Nelyx/dist/framework/widgets/basic.js';
    import {BoxConstraints} from './Nelyx/dist/framework/rendering/constraints.js';
    import {claimNativeRenderObject} from './Nelyx/dist/framework/rendering/object.js';
    import {FrameScheduler} from './Nelyx/dist/framework/scheduler/scheduler.js';
    import {registerTickerScheduler,unregisterTickerScheduler} from './Nelyx/dist/framework/widgets/ticker-scheduler.js';
    ${elementConstructionFixture()}
    ${textStyleApplyReference()}
    const textBase=new TextStyle({fontSize:17,color:0xff123456,fontWeight:FontWeight.w500,fontFamilyFallback:['a']});
    const expectedText=referenceApply.call(textBase,{color:0xff654321}),sourceText=textBase.apply({color:0xff654321});
    if(JSON.stringify(Object.getOwnPropertyDescriptors(expectedText))!==JSON.stringify(Object.getOwnPropertyDescriptors(sourceText))||Object.getPrototypeOf(sourceText)!==TextStyle.prototype||!Object.isFrozen(sourceText)||sourceText===textBase.apply({color:0xff654321})||sourceText.fontFamilyFallback===textBase.fontFamilyFallback)throw Error('Hermes applied TextStyle construction differs');
    class ExtendedTextStyle extends TextStyle {extra=19;}
    const extendedText=new ExtendedTextStyle({fontSize:13});
    if(extendedText.extra!==19||!Object.isExtensible(extendedText)||Object.getPrototypeOf(extendedText.apply())!==TextStyle.prototype)throw Error('Hermes applied TextStyle subclass differs');
    let textSum=0,textStarted=Date.now();
    for(let i=0;i<2000;++i)textSum+=referenceApply.call(textBase,{color:0xff654321}).fontSize;
    const textConstructorMs=Date.now()-textStarted;textStarted=Date.now();
    for(let i=0;i<2000;++i)textSum-=textBase.apply({color:0xff654321}).fontSize;
    const textSourceMs=Date.now()-textStarted;if(textSum)throw Error('Hermes applied TextStyle result differs');
    const buildOwner=new BuildOwner({},()=>{}),frameScheduler=new FrameScheduler({now:()=>0},()=>{}, {reportError:error=>{throw error;}});
    registerTickerScheduler(buildOwner,frameScheduler);let widgetBuilds=0;
    const layoutElement=new LayoutBuilder(()=>{++widgetBuilds;return SizedBox.shrink();}).createElement();
    layoutElement.mount(undefined,buildOwner);const layoutRender=layoutElement.renderObject;
    claimNativeRenderObject(layoutRender,{},()=>{});const constraints=BoxConstraints.tight({width:100,height:60});
    const answerLayout=()=>{const config=layoutRender.nativeBuilderConfiguration();if(!config.rebuild(config.revision,constraints))throw Error('Hermes native LayoutBuilder refused its input');};
    try{
      answerLayout();layoutElement.children[0].markNeedsBuild();answerLayout();
      if(widgetBuilds!==1||frameScheduler.transientCallbackCount||nativeLayoutBuilderCosts(buildOwner).calls!==2)throw Error('Hermes isolated dirty scope repeated a builder or retained a stale frame');
      layoutElement.markNeedsBuild();answerLayout();if(widgetBuilds!==2||nativeLayoutBuilderCosts(buildOwner).builds!==2)throw Error('Hermes lost its original builder invalidation');
    }finally{layoutElement.unmount();unregisterTickerScheduler(buildOwner);frameScheduler.dispose();buildOwner.dispose();}
    const partCounts={partEncodes:0,partReuses:0},partReference=new SceneReference(),partWriter=new SceneWriter({}, {pollEvents:false,retainedScene:true});let partAction=0;
    const sourcePart=callback=>renderBindingConfiguration(partReference,'box',[],{color:7,layout:{gap:3},semantics:{role:'button',label:'day'},onAction:()=>{partAction=callback;}},undefined,true,partCounts);
    partWriter.adopt(partWriter.records(sourcePart(1)),[]);const partEncoded=partCounts.partEncodes,partReused=partCounts.partReuses;
    const equalParts=partWriter.records(sourcePart(2));
    if(partCounts.partEncodes!==partEncoded||partCounts.partReuses<=partReused||partWriter.diff(equalParts).length)throw Error('Hermes Source field journal repeated encoders or changed bytes');
    partWriter.adopt(equalParts,[]);Array.from(partWriter.accepted.values())[0].node.options.onAction();if(partAction!==2)throw Error('Hermes Source field journal retained its callback');
    const initialize=ownFieldInitializer(['first','second']);
    let fieldSetters=0;class FieldBase {set first(value){++fieldSetters;}}
    class StandardFields extends FieldBase {first;second;constructor(input){super();this.first=input.first;this.second=input.second;}}
    class GroupedFields extends FieldBase {constructor(input){super();initialize(this);this.first=input.first;this.second=input.second;}}
    const fieldReads=[],input={get first(){fieldReads.push('first');return 3;},get second(){fieldReads.push('second');return 7;}};
    const standard=new StandardFields(input),grouped=new GroupedFields(input);
    if(fieldSetters||fieldReads.join(',')!=='first,second,first,second'||JSON.stringify(Object.getOwnPropertyDescriptors(standard))!==JSON.stringify(Object.getOwnPropertyDescriptors(grouped)))throw Error('Batched field definitions changed setters, evaluation order or descriptors');
    let semanticsSetters=0;Object.defineProperty(SemanticsProperties.prototype,'label',{configurable:true,set(value){semanticsSetters++;}});
    try {
      const properties=new SemanticsProperties({label:'day',button:true,selected:false});
      const sourceProperties=sourceSemanticsProperties({label:'day',button:true,selected:false});
      if(JSON.stringify(Object.getOwnPropertyDescriptors(properties))!==JSON.stringify(Object.getOwnPropertyDescriptors(sourceProperties))||Object.getPrototypeOf(properties)!==Object.getPrototypeOf(sourceProperties))throw Error('Hermes Source semantics value layout differs');
      if(semanticsSetters||properties.label!=='day'||!Object.isFrozen(properties)||Object.keys(properties).length!==78)throw Error('Semantics final field layout differs');
      class ExtendedProperties extends SemanticsProperties {extra=13;}
      const derived=new ExtendedProperties({label:'derived'}),descriptor=Object.getOwnPropertyDescriptor(derived,'label');
      if(derived.extra!==13||!Object.isExtensible(derived)||descriptor.writable||descriptor.configurable||!descriptor.enumerable)throw Error('Semantics subclass fields/final descriptors differ');
    }finally{delete SemanticsProperties.prototype.label;}
    const writer=new SceneWriter({}, {pollEvents:false,retainedScene:true});writer.nextSlot=37;
    const desired=writer.records(new SceneNode(new SceneReference(),'stack',[
      new SceneNode(new SceneReference(),'box',[],{layout:{childConstraints:'inherit'},pointerHitTest:'self'}),
      new SceneNode(new SceneReference(),'box',[],{properties:{width:42},color:0xff123456,layout:false}),
    ]));
    const changes=writer.diff(desired),kind=bytes=>new DataView(bytes.buffer,bytes.byteOffset).getUint16(0,true);
    if(changes.filter(bytes=>kind(bytes)===p.commands.properties).length!==1||changes.filter(bytes=>kind(bytes)===p.commands.paint).length!==1)throw Error('Hermes creation default comparison differs');
    const sourceWriter=new SceneWriter({}, {pollEvents:false,retainedScene:true});sourceWriter.nextSlot=51;
    const sourceRef=new SceneReference(),source=options=>{const node=sceneConfiguration(sourceRef,'box',[],options);retainSceneConfiguration(node);return node;};
    sourceWriter.adopt(sourceWriter.records(source({color:0xff123456})),[]);
    const resets=sourceWriter.diff(sourceWriter.records(source({}))),paintReset=resets.find(bytes=>kind(bytes)===p.commands.paint);
    if(!paintReset||new DataView(paintReset.buffer,paintReset.byteOffset).getUint32(8,true)!==sourceRef.currentNode.slot||!sourceWriter.counters.sharedDefaultConfigs)throw Error('Hermes shared default reset lost its destination');
    const mutablePolicy={commands:[{values:[7,11]}]},ownedPolicy=immutableSceneData(mutablePolicy);
    mutablePolicy.commands[0].values[0]=19;
    if(ownedPolicy.commands[0].values[0]!==7||!Object.isFrozen(ownedPolicy.commands[0].values)||immutableSceneData(ownedPolicy)!==ownedPolicy)throw Error('Hermes immutable policy copied a shared value or retained a mutable producer alias');
    let accessorRuns=0,refused=false;try{immutableSceneData({get value(){++accessorRuns;return 1;}});}catch{refused=true;}
    if(!refused||accessorRuns)throw Error('Hermes immutable policy evaluated an accessor');
    const payloadRef=new SceneReference(),payloadWriter=new SceneWriter({}, {pollEvents:false,retainedScene:true});let action=0;
    const initialPayload=sceneConfiguration(payloadRef,'box',[],{layout:{gap:7},onAction:()=>{action=1;}});
    retainSceneConfiguration(initialPayload);payloadWriter.adopt(payloadWriter.records(initialPayload),[]);
    const initialRecord=Array.from(payloadWriter.accepted.values())[0];
    const updatedPayload=sceneConfiguration(payloadRef,'box',[],{layout:{gap:7},onAction:()=>{action=2;}});
    retainSceneConfiguration(updatedPayload,initialPayload);
    const updatedRecords=payloadWriter.records(updatedPayload),updatedRecord=Array.from(updatedRecords.values())[0];
    if(updatedRecord.config!==initialRecord.config||payloadWriter.diff(updatedRecords).length)throw Error('Hermes equal Source payload repeated command configuration');
    payloadWriter.adopt(updatedRecords,[]);Array.from(payloadWriter.accepted.values())[0].node.options.onAction('activate');
    if(action!==2)throw Error('Hermes payload reuse retained an old callback');
    const date=new DateTime(2024,2,29),dateCopy=date.toDate();dateCopy.setTime(0);
    if(date.year!==2024||date.month!==2||date.day!==29||!DateTime.fromMillisecondsSinceEpoch(date.millisecondsSinceEpoch).equals(date))throw Error('Hermes civil date reader or mutable-copy isolation differs');
    const reference=new SceneReference(),ordinary=new SceneNode(reference,'box'),direct=sceneConfiguration(reference,'box');
    if(!(direct instanceof SceneNode)||Object.getPrototypeOf(direct)!==Object.getPrototypeOf(ordinary)||JSON.stringify(Object.getOwnPropertyDescriptors(direct))!==JSON.stringify(Object.getOwnPropertyDescriptors(ordinary)))throw Error('Source configuration differs from public constructor');
    let setterCalls=0;Object.defineProperty(SceneNode.prototype,'editorFlags',{configurable:true,set(value){++setterCalls;}});
    try{if(new SceneNode(reference,'box').editorFlags!==0||setterCalls)throw Error('Public field definition invoked an inherited setter');if(sceneConfiguration(reference,'box').editorFlags!==0||setterCalls)throw Error('Source field definition invoked an inherited setter');}finally{delete SceneNode.prototype.editorFlags;}
    let beginScene=Date.now(),sceneSum=0;
    for(let i=0;i<2000;++i)sceneSum+=new SceneNode(reference,'box').maximumLength;
    const sceneConstructorMs=Date.now()-beginScene;beginScene=Date.now();
    for(let i=0;i<2000;++i)sceneSum-=sceneConfiguration(reference,'box').maximumLength;
    const sceneConfigurationMs=Date.now()-beginScene;if(sceneSum)throw Error('Source configuration values differ');
    const bodies=Array.from({length:512},(_,i)=>semanticBody({role:'button',label:'Day '+i}));
    const cache=new ObservationDecodeCache();let plainSum=0,cachedSum=0;
    let begin=Date.now();
    for(let frame=0;frame<20;++frame)for(let i=0;i<bodies.length;++i)plainSum+=readSemanticBody(bodies[i]).label.length;
    const plainMs=Date.now()-begin;begin=Date.now();
    for(let frame=0;frame<20;++frame)for(let i=0;i<bodies.length;++i)cachedSum+=cache.read('view1/'+i,bodies[i],readSemanticBody).label.length;
    const cachedMs=Date.now()-begin;
    if(plainSum!==cachedSum||cache.counters.hits!==19*512)throw Error('Observation decode cache differs');
    ${privateCoreFixture()}
    globalThis.result=JSON.stringify({plainMs,cachedMs,hits:cache.counters.hits,bytes:cache.byteLength,sceneConstructorMs,sceneConfigurationMs,textConstructorMs,textSourceMs,partEncodes:partCounts.partEncodes,partReuses:partCounts.partReuses,privateCore:globalThis.privateCoreResult});
  `,
    },
    bundle: true,
    write: false,
    platform: 'neutral',
    format: 'iife',
    tsconfigRaw: { compilerOptions: { useDefineForClassFields: true } },
    target: 'es2015',
    supported: syntaxPolicy.supported,
    logLevel: 'silent',
  }).outputFiles[0].text;
  const cacheSource = path.join(temporary, 'observation.js'),
    cacheBytecode = path.join(temporary, 'observation.hbc');
  fs.writeFileSync(
    cacheSource,
    process.argv.includes('--babel-classes')
      ? compilerRequire('@babel/core').transformSync(cachedFixture, {
          configFile: false,
          babelrc: false,
          plugins: [compilerRequire.resolve('@babel/plugin-transform-classes')],
        }).code
      : cachedFixture,
  );
  run(path.join(supply, 'hermesc.exe'), [
    ...windowsHermesPolicy(
      process.argv.includes('--debug-classes') ? 'debug' : 'optimized',
      windowsNativeHermesCohort(),
    ).flags,
    '-Xes6-block-scoping',
    '-emit-binary',
    '-out',
    cacheBytecode,
    cacheSource,
  ]);
  const bytecodeResult = JSON.parse(run(path.join(temporary, 'check.exe'), [cacheBytecode]));
  console.log('Pinned VM unchanged observation decode comparison PASS.', bytecodeResult);
  if (process.argv.includes('--native-unit') && !applicationInit) {
    const native = await runNativeUnit(cacheSource, 'probe'),
      nativeResult = JSON.parse(native.result);
    for (const key of ['hits', 'bytes', 'partEncodes', 'partReuses'])
      assert.equal(nativeResult[key], bytecodeResult[key], 'Native unit result differs: ' + key);
    assert.deepEqual(nativeResult.privateCore, bytecodeResult.privateCore);
    console.log(
      'Pinned upstream native unit: same VM, constructor/Source semantics and observation/scene result PASS.',
      { nativeResult, buildMs: native.buildMs },
    );
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
