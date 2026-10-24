// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
import {windowsStaticHermesPin,verifyWindowsStaticHermes,compileWindowsStaticHermes,windowsCompilerEnvironment,patchStaticHermesRuntime} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {buildWindows,prepareWindows} from '../../sdk/tooling/cli/src/windows-runner.mjs';
import {nativeCohort} from '../../sdk/dist/runtime/cohorts.js';
const timeout=1_200_000,root=path.resolve(import.meta.dirname,'../../..');
const hermesDirectory=path.join(process.env.USERPROFILE??'','.nuget/packages/microsoft.javascript.hermes/0.0.0-2604.21001-94aa5e1d');
test('Static Hermes supplier hook is bounded to the owning pinned RuntimeWrapper',{timeout},()=>{
  const block='    std::string sourceURLStr = sourceURL ? sourceURL : "";\n    facebook::hermes::IHermesRootAPI *api = getHermesRootAPI();\n    bool isBytecode = api->isHermesBytecode(buffer->data(), buffer->size());\n';
  const source='#include <werapi.h>\n    config.withMicrotaskQueue(explicitMicrotasks_);\n    if (isInspectable_) {\n      compileFlags_.debug = true;\n    }\n  napi_status runScriptBuffer(\n'+block+'  napi_status createPreparedScript(\n'+block+'  napi_status deletePreparedScript(\n    if (hermesPrep->bytecodeBuffer()) {\n';
  const patched=patchStaticHermesRuntime(source);assert.match(patched,/install\(\*hermesJsiRuntime_\)/);assert.match(patched,/withEnableEval\(false\)/);assert.equal(patchStaticHermesRuntime(patched),patched);assert.throws(()=>patchStaticHermesRuntime('foreign'),/Pinned Hermes/);
});
test('Static Hermes rejects V8 and Debug options before touching an application',{timeout},async()=>{
  await assert.rejects(buildWindows({app:'unused',engine:'v8',hermesMode:'static-aot'}),/requires/);
  await assert.rejects(buildWindows({app:'unused',engine:'hermes',configuration:'Debug',hermesMode:'static-aot'}),/requires/);
  await assert.rejects(prepareWindows({app:'unused',engine:'v8',hermesMode:'static-aot'}),/requires/);
});
test('Static Hermes native unit shares the real Node-API VM, callbacks, microtasks and GC lifetime',{timeout,skip:process.platform!=='win32'||!process.env.NELYX_STATIC_HERMES_INPUTS},async t=>{
  const toolchain=verifyWindowsStaticHermes(process.env.NELYX_STATIC_HERMES_INPUTS),env=windowsCompilerEnvironment();
  assert(fs.statfsSync(root).bavail*fs.statfsSync(root).bsize>=20*1024**3,'Need 20 GiB before native AOT admission');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-static-hermes-'));
  const run=(file,args,expected=0)=>{const value=spawnSync(file,args,{env,cwd:directory,encoding:'utf8',windowsHide:true,timeout,maxBuffer:2*1024**2});assert.ifError(value.error);assert.equal(value.status,expected,(value.stdout??'')+(value.stderr??''));return value.stdout+value.stderr;};
  try{
    fs.mkdirSync(path.join(directory,'Bundle'));const source=path.join(directory,'Bundle/index.windows.aot.js');
    fs.writeFileSync(source,"globalThis.aotResult=hostAdd(42);globalThis.aotPromise=0;Promise.resolve().then(()=>++aotPromise).then(()=>++aotPromise);let n=0;const o={get value(){return ++n}};globalThis.aotGetter=o.value+o.value;class Box{#value=7;add(x){return this.#value+x}}const box=new Box();globalThis.aotClosure=x=>box.add(x);function evaluate(a,b,m){return 3*a*(1-m)*(1-m)*m+3*b*(1-m)*m*m+m*m*m}function curve(t){let start=0,end=1;for(;;){const m=(start+end)/2,x=evaluate(.4,.2,m);if(Math.abs(t-x)<.001)return evaluate(0,1,m);if(x<t)start=m;else end=m}}globalThis.aotCurve=curve(.5);\n");
    const compiled=await compileWindowsStaticHermes({toolchain:toolchain.directory,source,output:path.join(directory,windowsStaticHermesPin.library),hermesDirectory,cohort:nativeCohort('windows'),signal:t.signal});
    assert(compiled.libraryBytes>0);
    fs.copyFileSync(path.join(toolchain.directory,'build/API/hermes_shared/hermes.dll'),path.join(directory,'hermes.dll'));
    fs.copyFileSync(path.join(hermesDirectory,'build/native/win32/x64/hermes-icu.dll'),path.join(directory,'hermes-icu.dll'));
    const object=path.join(directory,'admission.obj'),executable=path.join(directory,'admission.exe'),include=path.join(hermesDirectory,'build/native/include');
    run('cl.exe',['/nologo','/c','/std:c++20','/EHsc','/MD','/O2','/DNDEBUG','/I'+include,'/I'+path.join(include,'node-api'),'/Fo'+object,path.join(import.meta.dirname,'windows-static-hermes-admission.cpp')]);
    run('link.exe',['/NOLOGO','/OUT:'+executable,object,path.join(toolchain.directory,'build/API/hermes_shared/hermes.lib')]);
    assert.match(run(executable,[]),/PASS-static-hermes-native-admission/);
    fs.renameSync(path.join(directory,windowsStaticHermesPin.library),path.join(directory,'unavailable.dll'));
    assert.match(run(executable,['missing'],3),/native application unavailable/);
    console.log('STATIC_HERMES_ADMISSION '+JSON.stringify({mode:compiled.mode,revision:compiled.revision,runtime:toolchain.manifest.runtimeSha256,libraryBytes:compiled.libraryBytes}));
  }finally{
    assert.equal(path.dirname(fs.realpathSync(directory)),fs.realpathSync(os.tmpdir()));assert(path.basename(directory).startsWith('nelyx-static-hermes-'));fs.rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
