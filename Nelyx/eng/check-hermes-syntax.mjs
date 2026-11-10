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
import { nativeCohort } from '@nelyx/sdk/runtime/cohorts';
const root = path.resolve(import.meta.dirname, '../..');
const parent = path.join(root, '.nelyx');
const temporary = fs.mkdtempSync(path.join(parent, 'hermes-syntax-'));
if (!temporary.startsWith(parent + path.sep)) throw Error('Temporary check escaped its owner');
const hermes = path.join(root, '.nelyx/windows-hermes');
const supply = path.join(root, 'Nelyx/engine/dist/windows-app-sdk');
const env = windowsCompilerEnvironment();
const compilerRequire = createRequire(
  path.join(root, 'Nelyx/sdk/tooling/cli/src/engine-v2-runner.mjs'),
);
const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
env[pathKey] = supply + path.delimiter + env[pathKey];
const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: temporary,
    env,
    encoding: 'utf8',
    timeout: 1200000,
    windowsHide: true,
  });
  if (result.error || result.status)
    throw Error(`${command}: ${result.error ?? result.status}\n${result.stdout}${result.stderr}`);
  return result.stdout.trim();
};
try {
  fs.writeFileSync(
    path.join(temporary, 'check.cpp'),
    `
    #include <hermes/hermes.h>
    #include <jsi/jsi.h>
    #include <fstream>
    #include <iostream>
    #include <sstream>
    int main(int argc,char** argv){try{
      if(argc!=2)return 2;
      auto rt=facebook::hermes::makeHermesRuntime();
      std::ifstream file(argv[1],std::ios::binary);std::stringstream data;data<<file.rdbuf();
      rt->evaluateJavaScript(std::make_shared<facebook::jsi::StringBuffer>(data.str()),"syntax.hbc");
      std::cout<<rt->global().getProperty(*rt,"result").getString(*rt).utf8(*rt)<<"\\n";
    }catch(const std::exception& e){std::cerr<<e.what()<<"\\n";return 1;}return 0;}
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
  const fixture = `
    const check=(ok,message)=>{if(!ok)throw Error(message);};
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
    class Parent {constructor(v){this.v=v;} get doubled(){return this.v*2;} method(){return this.v+1;} static code(){return 31;} }
    const mixin=Type=>class extends Type {method(){return super.method()+2;} get doubled(){return super.doubled+1;}};
    class Mixed extends mixin(Parent) { field=this.method();static code(){return super.code()+1;} }
    const mixed=Reflect.construct(Mixed,[5]);
    check(mixed instanceof Mixed&&mixed instanceof Parent&&mixed.field===8&&mixed.doubled===11&&Mixed.code()===32,'mixin inheritance and Reflect.construct');
    class Entries extends Array {total(){return this.reduce((a,b)=>a+b,0);}}
    class Failure extends Error {code=17;}
    const entries=new Entries(2,3),failure=new Failure('expected');
    check(entries instanceof Array&&entries.total()===5&&failure instanceof Error&&failure.message==='expected'&&failure.code===17,'builtin subclass construction');
    const diagnostic=Base=>class extends Base { describe(){return 'value';} };
    class First extends diagnostic(class {}) {}
    class Second extends diagnostic(class {}) { constructor(options={}){super();this.options=options;} }
    check(new First().describe()==='value'&&new Second().describe()==='value','anonymous empty mixin bases');
    let sum=0;const started=Date.now();
    for(let pass=0;pass<12;++pass) for(let i=0;i<1000;++i){
      const a={a:i,b:2,c:3,d:4,e:5,f:6,g:7,h:8};
      const b={...a,...{i:9},...{j:10},...{k:11},...{l:12},...{m:13},...{n:14},...{o:15}};
      const {a:leading,...tail}=b;sum+=leading+tail.o+new Child().next;
    }
    globalThis.result=JSON.stringify({sum,elapsedMs:Date.now()-started});
  `;
  const outputs = {};
  for (const [name, supported] of [
    ['lowered', { bigint: true }],
    ['native', windowsHermesSyntax],
  ]) {
    const code = transformSync(
      'globalThis.nativeSyntax=' + String(name === 'native') + ';' + fixture,
      { target: 'es2015', supported, format: 'iife' },
    ).code;
    if (name === 'native')
      assert(!/__spreadValues|__spreadProps/.test(code), 'Qualified syntax was lowered again');
    const sourceFile = path.join(temporary, name + '.js'),
      bytecode = path.join(temporary, name + '.hbc');
    const lowered = compilerRequire('@babel/core').transformSync(code, {
      configFile: false,
      babelrc: false,
      plugins: [compilerRequire.resolve('@babel/plugin-transform-classes')],
    });
    fs.writeFileSync(sourceFile, lowered.code);
    run(path.join(supply, 'hermesc.exe'), [
      ...windowsHermesPolicy('optimized', nativeCohort('windows')).flags,
      '-Xes6-block-scoping',
      '-emit-binary',
      '-out',
      bytecode,
      sourceFile,
    ]);
    outputs[name] = JSON.parse(run(path.join(temporary, 'check.exe'), [bytecode]));
  }
  assert.equal(outputs.native.sum, outputs.lowered.sum);
  console.log(
    'Pinned compiler + VM spread/rest/symbol/getter/proto and class field semantics PASS.',
    outputs,
  );
  const cachedFixture = buildSync({
    stdin: {
      resolveDir: root,
      loader: 'ts',
      contents: `
    import {ObservationDecodeCache} from './Nelyx/runtime/engine-client/observation-cache.ts';
    import {semanticBody,readSemanticBody} from './Nelyx/runtime/engine-client/semantics.ts';
    const bodies=Array.from({length:512},(_,i)=>semanticBody({role:'button',label:'Day '+i}));
    const cache=new ObservationDecodeCache();let plainSum=0,cachedSum=0;
    let begin=Date.now();
    for(let frame=0;frame<20;++frame)for(let i=0;i<bodies.length;++i)plainSum+=readSemanticBody(bodies[i]).label.length;
    const plainMs=Date.now()-begin;begin=Date.now();
    for(let frame=0;frame<20;++frame)for(let i=0;i<bodies.length;++i)cachedSum+=cache.read('view1/'+i,bodies[i],readSemanticBody).label.length;
    const cachedMs=Date.now()-begin;
    if(plainSum!==cachedSum||cache.counters.hits!==19*512)throw Error('Observation decode cache differs');
    globalThis.result=JSON.stringify({plainMs,cachedMs,hits:cache.counters.hits,bytes:cache.byteLength});
  `,
    },
    bundle: true,
    write: false,
    platform: 'neutral',
    format: 'iife',
    target: 'es2015',
    supported: windowsHermesSyntax,
    logLevel: 'silent',
  }).outputFiles[0].text;
  const cacheSource = path.join(temporary, 'observation.js'),
    cacheBytecode = path.join(temporary, 'observation.hbc');
  fs.writeFileSync(
    cacheSource,
    compilerRequire('@babel/core').transformSync(cachedFixture, {
      configFile: false,
      babelrc: false,
      plugins: [compilerRequire.resolve('@babel/plugin-transform-classes')],
    }).code,
  );
  run(path.join(supply, 'hermesc.exe'), [
    ...windowsHermesPolicy('optimized', nativeCohort('windows')).flags,
    '-Xes6-block-scoping',
    '-emit-binary',
    '-out',
    cacheBytecode,
    cacheSource,
  ]);
  console.log(
    'Pinned VM unchanged observation decode comparison PASS.',
    JSON.parse(run(path.join(temporary, 'check.exe'), [cacheBytecode])),
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
