// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {verifyWindowsStaticHermes, windowsCompilerEnvironment} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {compileHermesImage} from '../../sdk/tooling/cli/src/windows-hermes-image.mjs';
import {windowsTypedHermesPolicy} from '../../sdk/tooling/cli/src/windows-typed-hermes-policy.mjs';
import {nativeCohort} from '../../sdk/dist/runtime/cohorts.js';

const timeout = 1_200_000;
// Single-operation helpers investigate a safe representation. They do not
// lower product classes, import a type graph, or qualify whole-app coverage.
test('checked dynamic property operations preserve ordinary JS objects and arrays in the pinned same-VM native image', {timeout, skip: process.platform !== 'win32' || !process.env.NELYX_STATIC_HERMES_INPUTS}, async () => {
  const checked = verifyWindowsStaticHermes(process.env.NELYX_STATIC_HERMES_INPUTS), env = windowsCompilerEnvironment();
  const flags = windowsTypedHermesPolicy(nativeCohort('windows'), 'flow').flags;
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-runtime-gate-'));
  const run = (file, args) => {
    const result = spawnSync(file, args, {cwd: folder, env, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 4 * 1024 ** 2});
    assert.ifError(result.error); assert.equal(result.status, 0, result.stdout + result.stderr); return result.stdout;
  };
  try {
    const source = path.join(folder, 'operations.js');
    fs.writeFileSync(source, `
      function read(value:any,key:any):any {return value[key];}
      function write(value:any,key:any,next:any):any {value[key]=next; return value;}
      function scalar(value:any,key:any):number {return value[key];}
      function invoke(callback:any,receiver:any,value:number):number {return callback.call(receiver,value);}
      globalThis.operations={read,write,scalar,invoke};
    `);
    const ir = run(path.join(checked.directory, 'build/bin/shermes.exe'), [...flags, '-dump-ir', source]);
    assert.match(ir, /function read\([^\n]+typed/);
    assert.match(ir, /LoadPropertyInst/); assert.match(ir, /StorePropertyStrictInst/);
    assert.match(ir, /CheckedTypeCastInst \(:number\)/);
    await compileHermesImage({checked, env, units: [{name: 'nelyx_app', source, flags, typed: true}], output: path.join(folder, 'NelyxApp.aot.dll')});
    const supplier = path.join(process.env.USERPROFILE, '.nuget/packages/microsoft.javascript.hermes/0.0.0-2604.21001-94aa5e1d');
    const include = path.join(supplier, 'build/native/include'), executable = path.join(folder, 'probe.exe');
    fs.copyFileSync(path.join(checked.directory, 'build/API/hermes_shared/hermes.dll'), path.join(folder, 'hermes.dll'));
    fs.copyFileSync(path.join(supplier, 'build/native/win32/x64/hermes-icu.dll'), path.join(folder, 'hermes-icu.dll'));
    run('cl.exe', ['/nologo', '/std:c++20', '/EHsc', '/MD', '/O2', '/DNDEBUG', '/I' + include, '/I' + path.join(include, 'node-api'), '/Fe' + executable, '/Fo' + path.join(folder, 'probe.obj'), path.join(import.meta.dirname, 'windows-typed-hermes-probe.cpp'), '/link', path.join(checked.directory, 'build/API/hermes_shared/hermes.lib')]);
    const script = path.join(folder, 'check.js');
    fs.writeFileSync(script, `JSON.stringify((()=>{
      const {read,write,scalar,invoke}=operations;
      const assert=(value,message)=>{if(!value)throw Error(message);};
      const events=[], object={get x(){events.push('get');return 3;},set x(v){events.push('set:'+v);}};
      assert(scalar(object,'x')===3,'getter scalar');
      assert(write(object,'x',4)===object,'write identity');
      assert(JSON.stringify(events)==='["get","set:4"]','getter/setter order');
      const proxy=new Proxy({x:7},{get(target,key,receiver){events.push('proxy');return Reflect.get(target,key,receiver);}});
      assert(scalar(proxy,'x')===7&&events[2]==='proxy','Proxy dispatch');
      const array=[1,,3],alias=array;
      assert(read(array,1)===undefined&&!(1 in array),'array hole');
      assert(read(array,99)===undefined,'array out of bounds');
      assert(write(array,4,5)===alias&&array.length===5&&!(3 in array)&&array[4]===5,'array alias/length');
      write(array,'length',1); assert(array.length===1&&alias[4]===undefined,'array truncate');
      const error={};let same=false;
      try{read({get x(){throw error;}},'x');}catch(e){same=e===error;}
      assert(same,'exception identity');
      let checked=false;try{scalar({x:'3'},'x');}catch(e){checked=e instanceof TypeError;}assert(checked,'checked scalar');
      assert(invoke(function(n){return this.x+n;},{x:5},2)===7,'callback this');
      let depth=0;const recursive={get x(){return depth++===0?scalar(recursive,'x')+1:10;}};
      assert(scalar(recursive,'x')===11,'reentry');
      const buffer=new ArrayBuffer(16),view=new Uint8Array(buffer,4,4);view[0]=9;
      assert(read(view,0)===9&&read(new Uint8Array(buffer),4)===9,'buffer view alias');
      let finalizer=0;const original={get x(){try{throw error;}finally{finalizer++;}}};
      try{scalar(original,'x');}catch(e){assert(e===error,'finally exception');}assert(finalizer===1,'finally count');
      gc();assert(scalar(proxy,'x')===7,'GC roots');
      return {status:'PASS',scope:'checked dynamic single-operation prototype',wholeAppNativeAot:false};
    })())`);
    const output = run(executable, [script]); assert.match(output, /"status":"PASS"/);
    console.log('TYPED_RUNTIME_REPRESENTATION ' + output.trim().slice('TYPED_PROBE_RESULT '.length));
  } finally {
    assert.equal(path.dirname(folder), fs.realpathSync(os.tmpdir())); assert(!fs.lstatSync(folder).isSymbolicLink());
    fs.rmSync(folder, {recursive: true, force: true, maxRetries: 10, retryDelay: 100});
  }
});
