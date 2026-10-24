// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {verifyWindowsStaticHermes,windowsCompilerEnvironment} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {windowsTypedHermesPolicy} from '../../sdk/tooling/cli/src/windows-typed-hermes-policy.mjs';import {windowsHermesPolicy} from '../../sdk/tooling/cli/src/windows-hermes-policy.mjs';import {nativeCohort} from '../../sdk/dist/runtime/cohorts.js';
const timeout=1_200_000;
test('same-revision standalone VM initializes typed and untyped units in order without interpreter reentry',{timeout,skip:process.platform!=='win32'||!process.env.NELYX_STATIC_HERMES_INPUTS},()=>{
  const toolchain=verifyWindowsStaticHermes(process.env.NELYX_STATIC_HERMES_INPUTS),env=windowsCompilerEnvironment(),folder=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-typed-units-'));
  const run=(file,args,expected=0)=>{const r=spawnSync(file,args,{cwd:folder,env,encoding:'utf8',windowsHide:true,timeout,maxBuffer:4*1024**2});assert.ifError(r.error);assert.equal(r.status,expected,(r.stdout??'')+(r.stderr??''));return r.stdout+r.stderr;};
  try{
    const objects=[],include=path.join(toolchain.directory,'source/include'),config=path.join(toolchain.directory,'build/lib/config'),library=path.join(toolchain.directory,'build/lib/hermesvm.lib');
    run('cmake',['--build',path.join(toolchain.directory,'build'),'--target','hermesvm','--parallel','6']);
    assert(fs.existsSync(library),'Pinned standalone hermesvm target unavailable; it is not the product Node-API runtime');
    const cohort=nativeCohort('windows'),compiler=path.join(toolchain.directory,'build/bin/shermes.exe');
    const sources=[
      ['typed_leaf',windowsTypedHermesPolicy(cohort).flags,'function square(x:number):number{return x*x;} function checked(x):number{return square(x);} function relay(fn,x):number{return fn(x);} function identity(value){return value;} globalThis.typedChecked=checked;globalThis.typedRelay=relay;globalThis.typedIdentity=identity;'],
      ['untyped_root',windowsHermesPolicy('optimized',cohort).flags,"if(typeof typedChecked!=='function')throw Error('typed leaf must initialize first');let getters=0;const object={get value(){return ++getters;}};class Private{#value=7;read(){return this.#value;}}const privateObject=new Private();if(typedIdentity(object)!==object||typedIdentity(privateObject)!==privateObject||typedIdentity(privateObject).read()!==7)throw Error('identity split');if(typedRelay(value=>value.value,object)!==1||getters!==1)throw Error('getter/callback order');const error=Error('sentinel');let caught=false;try{typedRelay(()=>{throw error;},object);}catch(value){caught=value===error;}if(!caught)throw Error('exception identity');let invalid=false;try{typedChecked('3');}catch(value){invalid=value instanceof TypeError;}if(!invalid)throw Error('checked boundary');globalThis.unitPrivate=privateObject;globalThis.unitClosure=x=>typedChecked(x)+privateObject.read();globalThis.unitPromise=0;Promise.resolve().then(()=>unitPromise++);"],
      ['verify_roots',windowsHermesPolicy('optimized',cohort).flags,"if(unitPromise!==1||unitPrivate.read()!==7||unitClosure(5)!==32||typedIdentity(unitPrivate)!==unitPrivate)throw Error('roots lost across GC or microtask did not drain');"],
    ];
    for(const [unit,flags,source] of sources){const input=path.join(folder,unit+'.ts'),c=path.join(folder,unit+'.c'),object=path.join(folder,unit+'.obj');fs.writeFileSync(input,source);
      run(compiler,[...flags,'-emit-c','-exported-unit='+unit,'-o',c,input]);run(path.join(process.env.ProgramFiles,'LLVM/bin/clang.exe'),['-c',c,'-o',object,'-O3','-DNDEBUG','-DSTATIC_HERMES','-fno-strict-aliasing','-fno-strict-overflow','-fms-runtime-lib=dll','-I'+include,'-I'+config]);objects.push(object);
    }
    const image=path.join(folder,'TypedUnits.dll');run('link.exe',['/DLL','/NOLOGO','/OUT:'+image,...objects,library,...sources.map(([unit])=>'/EXPORT:sh_export_'+unit)]);
    fs.copyFileSync(path.join(toolchain.directory,'build/lib/hermesvm.dll'),path.join(folder,'hermesvm.dll'));
    const executable=path.join(folder,'units.exe');run(path.join(process.env.ProgramFiles,'LLVM/bin/clang-cl.exe'),['/nologo','/std:c++20','/EHsc','/MD','/O2','/DNDEBUG','/I'+include,'/I'+config,'/I'+path.join(toolchain.directory,'source/API'),'/I'+path.join(toolchain.directory,'source/public'),'/I'+path.join(toolchain.directory,'source/API/jsi'),'/Fe'+executable,'/Fo'+path.join(folder,'units.obj'),path.join(import.meta.dirname,'windows-typed-hermes-units.cpp'),'/link',library,path.join(toolchain.directory,'build/jsi/jsi.lib')]);
    assert.match(run(executable,['ordered']),/PASS-typed-untyped-units/);assert.match(run(executable,['reversed'],3),/initialization rejected/);assert.match(run(executable,['missing'],3),/unit export missing/);
    console.log('TYPED_UNITS_PROTOTYPE '+JSON.stringify({toolchain:toolchain.sha256,standaloneRuntime:createHash('sha256').update(fs.readFileSync(path.join(folder,'hermesvm.dll'))).digest('hex'),nodeApiHybrid:'notVerified'}));
  }finally{assert.equal(path.dirname(fs.realpathSync(folder)),fs.realpathSync(os.tmpdir()));assert(path.basename(folder).startsWith('nelyx-typed-units-'));assert(!fs.lstatSync(folder).isSymbolicLink());fs.rmSync(folder,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
