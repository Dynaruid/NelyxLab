// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
import {inspectRnwJsiPal} from '../../sdk/tooling/cli/src/rnw-jsi-pal.mjs';
import {createRuntimeInventory} from '../../sdk/tooling/static-aot/src/runtime-inventory.mjs';
import {createExecutionPlan,bindNativeCoverage,verifyFrontendPlan} from '../../sdk/tooling/static-aot/src/execution-plan.mjs';
import {compileWindowsStaticAot} from '../../sdk/tooling/cli/src/windows-static-aot.mjs';
import {verifyWindowsStaticHermes,windowsCompilerEnvironment} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {nativeCohort} from '../../sdk/dist/runtime/cohorts.js';
const timeout=1_200_000,hash=value=>createHash('sha256').update(value).digest('hex');
test('the exact RNW JSI script initializes once as a native unit through direct and prepared Node-API requests',{timeout,skip:!process.env.NELYX_STATIC_HERMES_INPUTS},async t=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-rnw-pal-'));
  try{
    const checked=verifyWindowsStaticHermes(process.env.NELYX_STATIC_HERMES_INPUTS),env=windowsCompilerEnvironment(),runner=path.resolve('sample/nelyx-testbed-app-2/windows/runner'),pal=inspectRnwJsiPal(runner);
    const text="requestPal();const pal=__jsi_pal,fn=()=>7;pal.setHostFunctionId(fn,19);requestPreparedPal();if(__jsi_pal!==pal||pal.getHostFunctionId(fn)!==19)throw Error('RNW symbol/owner reset');globalThis.unitVerify=()=>{const a=__nelyxStaticHermesAudit();if(!a.rnwPalNative||!a.internalJavaScriptNative||a.sourcePreparations||a.sourceExecutions||a.bytecodeExecutions||a.blockedFallbacks||__nelyxStaticHermes.unitsInitialized!==3)throw Error('RNW native audit differs');};";
    const typed='globalThis.unusedTypedUnit=true;',source=path.join(folder,'root.js'),typedSource=path.join(folder,'typed.ts');fs.writeFileSync(source,text);fs.writeFileSync(typedSource,typed);fs.writeFileSync(path.join(folder,'index.windows.rnw-pal.js'),pal.source);
    const record={id:'root.js',metroId:0,role:'prepend',owner:{name:'fixture',version:'1',root:'.',manifestSha256:hash('owner'),license:'MIT'},source:text,emitted:text,sourceFile:'root.js',dialect:'javascript',dependencies:[]};
    const inventory=createRuntimeInventory({identity:{},entry:record.id,modules:[record],sourceMapModules:[record.id]}),partition={typePolicy:{sha256:hash('policy'),decisions:[]},bindings:[],graph:{sha256:hash('graph')},irSha256:hash('ir'),sourceSha256:hash(typed)};
    const executionPlan=createExecutionPlan({inventory,records:[record],spans:[{id:record.id,offset:0,end:text.length}],code:text},partition,'',[pal]);
    const hermesDirectory=path.join(process.env.USERPROFILE,'.nuget/packages/microsoft.javascript.hermes/0.0.0-2604.21001-94aa5e1d'),output=path.join(folder,'NelyxApp.aot.dll');
    const compiled=await compileWindowsStaticAot({toolchain:checked.directory,source,typedSource,partitionSha256:partition.irSha256,output,hermesDirectory,cohort:nativeCohort('windows'),signal:t.signal,diagnosticMap:{...partition,executionPlan}});
    const linked=bindNativeCoverage(executionPlan,compiled.build,compiled);assert(linked.summary.wholeAppNativeAot);verifyFrontendPlan(linked);assert.equal(linked.modules.find(module=>module.nativeUnit==='nelyx_rnw_pal').originals.filter(body=>body.kind!=='module-initializer').length,3);
    fs.copyFileSync(path.join(checked.directory,'build/API/hermes_shared/hermes.dll'),path.join(folder,'hermes.dll'));fs.copyFileSync(path.join(hermesDirectory,'build/native/win32/x64/hermes-icu.dll'),path.join(folder,'hermes-icu.dll'));
    const run=(file,args)=>{const result=spawnSync(file,args,{cwd:folder,env,encoding:'utf8',windowsHide:true,timeout,maxBuffer:2*1024**2});assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);return result.stdout+result.stderr;};
    const include=path.join(hermesDirectory,'build/native/include'),executable=path.join(folder,'admission.exe');
    run('cl.exe',['/nologo','/std:c++20','/EHsc','/MD','/O2','/DNDEBUG','/I'+include,'/I'+path.join(include,'node-api'),'/I'+path.resolve('Nelyx/sdk/native/windows'),'/Fe'+executable,'/Fo'+path.join(folder,'admission.obj'),path.join(import.meta.dirname,'windows-typed-hermes-admission.cpp'),'/link',path.join(checked.directory,'build/API/hermes_shared/hermes.lib')]);
    assert.match(run(executable,['pal']),/PASS-typed-native-admission mode=pal/);
    const image=fs.readFileSync(output),patched=Buffer.from(image),needle=Buffer.from('sh_export_nelyx_rnw_pal'),at=patched.indexOf(needle);assert(at>=0);patched.write('sh_export_nelyx_rnw_pXX',at);fs.writeFileSync(output,patched);
    assert.match(run(executable,['missing-rnw-pal']),/Native RNW JSI manager export missing/);fs.writeFileSync(output,image);
    console.log('RNW_NATIVE_PAL '+JSON.stringify({sourceSha256:pal.sourceSha256,originalSha256:pal.originalSha256,units:compiled.unitOrder,coverage:linked.summary,sameVM:true,direct:true,prepared:true,symbolOwnerRetained:true}));
  }finally{assert.equal(path.dirname(folder),fs.realpathSync(os.tmpdir()));assert(!fs.lstatSync(folder).isSymbolicLink());fs.rmSync(folder,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
