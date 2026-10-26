// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import path from 'node:path';import fs from 'node:fs';import os from 'node:os';
import {assertNativeRuntimeGraph,buildNativeApplication,nativeWindowsOperation,packNativeApplication,verifyNativePackage} from '../../sdk/tooling/cli/src/windows-native-runner.mjs';
import {execute} from '../../sdk/tooling/cli/src/commands.mjs';
import {startWindowsProcess} from '../../sdk/tooling/cli/src/windows-process.mjs';
import {buildNativeHost} from '../build-native-hermes.mjs';
const timeout=1_200_000;

test('prepare refreshes recorded supplier hashes while build and doctor reject the stale locator',{timeout},async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-native-prepare-'));
  try{
    fs.writeFileSync(path.join(folder,'package.json'),'{"name":"native-prepare-fixture","private":true}');
    const parent=path.join(folder,'.nelyx/native-windows');fs.mkdirSync(parent,{recursive:true});const nativeInputs=path.join(folder,'vendor.json'),engineInputs=path.join(folder,'engine');fs.writeFileSync(nativeInputs,'{}');
    fs.writeFileSync(path.join(parent,'inputs.json'),JSON.stringify({schema:'nelyx.native-hermes-inputs/v1',nativeInputs,nativeInputsSha256:'0'.repeat(64),engineInputs,engineInputsSha256:'0'.repeat(64)}));
    const options={app:folder,engineInputs,nativeInputs};
    const doctor=await nativeWindowsOperation('doctor',options);assert.equal(doctor.nativeInputs,'notVerified');assert.match(doctor.reason,/prepared inputs changed/);
    await assert.rejects(nativeWindowsOperation('build',options),/prepared inputs changed/);
    // Refresh must reach verification of the new provider rather than accept
    // the old hashes or reject them before preparation. This empty app owns no
    // SDK installation, so the real provider rejects it before writing inputs.
    await assert.rejects(nativeWindowsOperation('prepare',options),/Install the SDK and Skia native dependencies/);
    await assert.rejects(nativeWindowsOperation('prepare',{app:folder}),/Install the SDK and Skia native dependencies/);
    assert.equal(fs.readFileSync(nativeInputs,'utf8'),'{}');assert(!fs.existsSync(engineInputs));
    fs.writeFileSync(path.join(parent,'inputs.json'),JSON.stringify({schema:'unknown',nativeInputs,engineInputs}));await assert.rejects(nativeWindowsOperation('prepare',options),/locator schema\/paths differ/);
  }finally{assert.equal(path.dirname(fs.realpathSync(folder)),fs.realpathSync(os.tmpdir()));assert(path.basename(folder).startsWith('nelyx-native-prepare-'));assert(!fs.lstatSync(folder).isSymbolicLink());fs.rmSync(folder,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
test('direct-host graph admission rejects RN families, unresolved edges and code-generation candidates',{timeout},()=>{
  const graph={modules:[{owner:{name:'@nelyx/core'}}],summary:{unresolvedDependencies:0},unresolved:[],evaluationConflicts:[],dynamicCodeCandidates:[]};assert.doesNotThrow(()=>assertNativeRuntimeGraph(graph));
  for(const name of ['react','react-dom','react-reconciler','react-native','react-native-windows','react-native-web','@react-native/assets-registry','@react-native-windows/codegen','@nelyx/skia-rn','yoga','yoga-layout','@microsoft/node-api-jsi'])assert.throws(()=>assertNativeRuntimeGraph({...graph,modules:[{owner:{name}}]}),/Direct host/);
  for(const change of [{modules:[]},{modules:[{}]},{summary:{unresolvedDependencies:1}},{unresolved:['missing']},{evaluationConflicts:['duplicate']},{dynamicCodeCandidates:['eval']}])assert.throws(()=>assertNativeRuntimeGraph({...graph,...change}),/Direct host/);
});
test('native CLI mode and host admission fail before starting a build or accepting another engine',{timeout},async()=>{
  await assert.rejects(buildNativeApplication({app:'missing',mode:'bytecode',hermesMode:'static-aot'}),/Conflicting/);
  await assert.rejects(buildNativeApplication({app:'missing',diagnosticEntry:'fixture.ts'}),/explicit temporary output/);
  for(const options of [{hermesMode:'legacy'},{engine:'v8'},{engine:'jsc'},{configuration:'Debug'},{hermesProfile:'debug'}])await assert.rejects(nativeWindowsOperation('build',{app:'missing',...options}),/Choose|requires/);
  const root=path.resolve(import.meta.dirname,'../../..'),cli=path.join(root,'Nelyx/sdk/tooling/cli/src/main.mjs');
  const result=spawnSync(process.execPath,[cli,'doctor','--app',path.join(root,'sample/nelyx-testbed-app-2'),'--target','windows','--host','native-hermes'],{cwd:root,encoding:'utf8',windowsHide:true,timeout});assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);const doctor=JSON.parse(result.stdout);assert.equal(doctor.host,'native-hermes');assert.equal(doctor.engine,'hermes');assert.equal(doctor.qualification,'experimental');assert.equal(doctor.nativeInputs,'prepared',doctor.reason);
});
test('both delivered native packages round-trip without supplier locators and reject changed images',{timeout,skip:process.platform!=='win32'||process.env.NELYX_NATIVE_PACKAGES!=='1'},async()=>{
  const app=path.resolve(import.meta.dirname,'../../../sample/nelyx-testbed-app-2'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-native-package-'));
  try{
    for(const mode of ['bytecode','static-aot']){
      const directory=path.join(app,'.nelyx/native-windows/current-'+mode),before=verifyNativePackage(directory),output=path.join(temporary,mode+'.zip');await packNativeApplication({app,directory,output});
      const unpacked=path.join(temporary,mode);await execute('powershell.exe',['-NoProfile','-Command',"$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:NELYX_NATIVE_ZIP,$env:NELYX_NATIVE_UNPACKED)"],{env:{...process.env,NELYX_NATIVE_ZIP:output,NELYX_NATIVE_UNPACKED:unpacked},timeout});
      const after=verifyNativePackage(unpacked);assert.deepEqual(after.manifest,before.manifest);assert.equal(after.files,before.files);assert(!fs.existsSync(path.join(unpacked,'inputs.json')));
      fs.appendFileSync(path.join(unpacked,after.manifest.bundle),'changed');assert.throws(()=>verifyNativePackage(unpacked));fs.rmSync(unpacked,{recursive:true,force:true});fs.unlinkSync(output);
    }
  }finally{assert.equal(path.dirname(temporary),fs.realpathSync(os.tmpdir()));assert(!fs.lstatSync(temporary).isSymbolicLink());fs.rmSync(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});

test('native bootstrap preserves falsey and hostile error exits after retiring the real VM',{timeout,skip:process.platform!=='win32'||process.env.NELYX_NATIVE_STARTUP!=='1'},async t=>{
  const app=fs.realpathSync(path.resolve(import.meta.dirname,'../../../sample/nelyx-testbed-app-2'));
  const parent=path.join(app,'.nelyx/native-windows'),temporary=fs.mkdtempSync(path.join(parent,'.startup-fixture-'));
  const controller=new AbortController(),abort=()=>controller.abort(t.signal.reason);
  t.signal.addEventListener('abort',abort,{once:true});let running;
  try{
    // The assets getter is reached after the listener, renderer and platform
    // owners exist. Its falsey rejection must survive their asynchronous close.
    const entry=path.join(temporary,'entry.ts');
    const hostBuild=await buildNativeHost({app,signal:controller.signal});
    for(const [source,message]of [['throw undefined;','undefined'],['const error=new Error("original");Object.defineProperty(error,"stack",{get(){throw 0;}});throw error;','<unprintable>']]){
    fs.writeFileSync(entry,'export function main(){return {definition:{get assets(){'+source+'}}};}\n');
    const built=await buildNativeApplication({app,mode:'bytecode',hostBuild,diagnosticEntry:entry,output:path.join(temporary,'package'),signal:controller.signal});
    let output='',errors='';
    running=startWindowsProcess(built.executable,[built.bundle,built.assetRoot,'bytecode','15000'],{cwd:built.directory,verify:verifyNativePackage,onOutput(chunk,channel){if(channel==='stdout')output+=chunk;else errors+=chunk;}});
    const stop=()=>{void running.stop();};controller.signal.addEventListener('abort',stop,{once:true});
    try{
      if(controller.signal.aborted)stop();const result=await running.completed;
      assert.equal(result.forced,false,JSON.stringify(result));assert.equal(result.error,null);
      assert.equal(result.exitCode,1,output+errors);
      assert(errors.split(/\r?\n/).includes('NELYX_NATIVE_JS_ERROR '+message),errors);
      assert.doesNotMatch(output+errors,/TypeError|NELYX_NATIVE_ERROR|failed to complete its owned shutdown/);
    }finally{controller.signal.removeEventListener('abort',stop);}
    }
  }finally{
    controller.abort();t.signal.removeEventListener('abort',abort);if(running)await running.stop();
    assert.equal(path.dirname(fs.realpathSync(temporary)),parent);assert(path.basename(temporary).startsWith('.startup-fixture-'));assert(!fs.lstatSync(temporary).isSymbolicLink());
    fs.rmSync(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
