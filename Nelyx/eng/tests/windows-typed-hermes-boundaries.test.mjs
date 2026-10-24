// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {verifyWindowsStaticHermes,windowsCompilerEnvironment} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {compileHermesImage} from '../../sdk/tooling/cli/src/windows-hermes-image.mjs';
import {windowsTypedHermesPolicy} from '../../sdk/tooling/cli/src/windows-typed-hermes-policy.mjs';import {nativeCohort} from '../../sdk/dist/runtime/cohorts.js';
const timeout=1_200_000;
// These are diagnostic exclusions, not positive product compatibility tests.
// Each unsafe caller runs in a fresh process, with fault dialogs disabled.
test('pinned Flow compilation does not qualify unchecked JS record or array boundaries',{timeout,skip:process.platform!=='win32'||!process.env.NELYX_STATIC_HERMES_INPUTS},async()=>{
  const checked=verifyWindowsStaticHermes(process.env.NELYX_STATIC_HERMES_INPUTS),env=windowsCompilerEnvironment(),flags=windowsTypedHermesPolicy(nativeCohort('windows'),'flow').flags;
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-typed-boundaries-'));
  const execute=(file,args)=>{const value=spawnSync(file,args,{cwd:folder,env,encoding:'utf8',windowsHide:true,timeout,maxBuffer:4*1024**2});assert.ifError(value.error);return value;};
  const succeed=(file,args)=>{const value=execute(file,args);assert.equal(value.status,0,(value.stdout??'')+(value.stderr??''));return value.stdout;};
  try{
    const supplier=path.join(process.env.USERPROFILE,'.nuget/packages/microsoft.javascript.hermes/0.0.0-2604.21001-94aa5e1d'),include=path.join(supplier,'build/native/include'),executable=path.join(folder,'probe.exe');
    fs.copyFileSync(path.join(checked.directory,'build/API/hermes_shared/hermes.dll'),path.join(folder,'hermes.dll'));
    fs.copyFileSync(path.join(supplier,'build/native/win32/x64/hermes-icu.dll'),path.join(folder,'hermes-icu.dll'));
    succeed('cl.exe',['/nologo','/std:c++20','/EHsc','/MD','/O2','/DNDEBUG','/I'+include,'/I'+path.join(include,'node-api'),'/Fe'+executable,'/Fo'+path.join(folder,'probe.obj'),path.join(import.meta.dirname,'windows-typed-hermes-probe.cpp'),'/link',path.join(checked.directory,'build/API/hermes_shared/hermes.lib')]);
    const source=path.join(folder,'input.js'),script=path.join(folder,'check.js');
    const probe=expression=>{fs.writeFileSync(script,'(()=>{try{return JSON.stringify({value:'+expression+'});}catch(error){return JSON.stringify({error:error.name});}})()');const result=execute(executable,[script]);return {...result,value:result.status===0?JSON.parse(result.stdout.trim().slice('TYPED_PROBE_RESULT '.length)):null};};
    fs.writeFileSync(source,'type P={|a:number,b:number|};function sum(p:P):number{return p.a+p.b;}function checked(p):number{return sum(p);}globalThis.flow=checked;');
    const ir=succeed(path.join(checked.directory,'build/bin/shermes.exe'),[...flags,'-dump-ir',source]);assert.match(ir,/FAddInst/);assert.match(ir,/CheckedTypeCastInst \(:object\)/);
    await compileHermesImage({checked,env,units:[{name:'nelyx_app',source,flags,typed:true}],output:path.join(folder,'NelyxApp.aot.dll')});
    assert.deepEqual(probe('flow({a:1,b:2})').value,{value:3});assert.deepEqual(probe('flow({b:2,a:1})').value,{value:3});
    const getter=probe('(()=>{let reads=0;const value=flow({get a(){reads++;return 1},get b(){reads++;return 2}});return {value,reads};})()');
    assert(getter.status!==0||JSON.stringify(getter.value)!=='{"value":{"value":3,"reads":2}}','Requalify a changed getter bridge instead of silently accepting a wider type subset');
    const wrong=probe("flow({a:'1',b:2})");assert.notEqual(wrong.value?.error,'TypeError','Requalify the changed per-field checking contract');
    fs.writeFileSync(source,'function first(p:Array<number>):number{return p[0];}function checked(p):number{return first(p);}globalThis.flow=checked;');
    await compileHermesImage({checked,env,units:[{name:'nelyx_app',source,flags,typed:true}],output:path.join(folder,'NelyxApp.aot.dll')});
    const array=probe('flow([3])');assert(array.status!==0||array.value?.value!==3,'Requalify a changed ordinary-array bridge instead of expanding the product subset');
    console.log('TYPED_FLOW_BOUNDARIES '+JSON.stringify({qualification:'blocked',getterExit:getter.status,getterResult:getter.value,wrongField:wrong.value,arrayExit:array.status,scope:'same-VM Node-API diagnostic; product keeps checked dynamic receivers and excludes record/array lowering'}));
  }finally{assert.equal(path.dirname(folder),fs.realpathSync(os.tmpdir()));assert(!fs.lstatSync(folder).isSymbolicLink());fs.rmSync(folder,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
