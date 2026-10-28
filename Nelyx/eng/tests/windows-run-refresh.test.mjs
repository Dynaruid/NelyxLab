// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {packageBuildInputs,windowsBuildInputs} from '../../sdk/tooling/cli/src/windows-build-inputs.mjs';
import {prepareWindowsRun} from '../../sdk/tooling/cli/src/windows-run-preparation.mjs';
import {refreshSampleWindowsSdk,runSampleWindows} from '../run-sample-windows.mjs';
const timeout=1_200_000;
test('repository Windows runner carries the same SDK build-input contract as the starter template',{timeout},()=>{
 const template=fs.readFileSync(new URL('../../sdk/tooling/cli/templates/nelyx-app/windows/runner/build.mjs',import.meta.url),'utf8');
 const runner=fs.readFileSync(new URL('../../../sample/nelyx-testbed-app-2/windows/runner/build.mjs',import.meta.url),'utf8');
 assert.equal(runner,template,'Updating SDK build acknowledgement must update the existing sample runner as well as future applications');
});
function temporary(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-run-refresh-'));return {root,close(){assert.equal(path.dirname(root),fs.realpathSync(os.tmpdir()));assert(path.basename(root).startsWith('nelyx-run-refresh-'));fs.rmSync(root,{recursive:true,force:true});}};}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);}
function json(file,value){write(file,JSON.stringify(value));}
function workspace(){
 const temp=temporary(),{root}=temp,app=path.join(root,'sample app'),source=path.join(root,'sdk'),runner=path.join(app,'windows/runner'),installed=path.join(runner,'node_modules/@nelyx/sdk');
 json(path.join(root,'package.json'),{workspaces:['sdk']});json(path.join(source,'package.json'),{name:'@nelyx/sdk',version:'1.0.0',files:['src','dist','native'],scripts:{build:'emit'}});json(path.join(runner,'package.json'),{dependencies:{'@nelyx/sdk':'file:local.tgz'}});
 json(path.join(source,'tsconfig.build.json'),{compilerOptions:{rootDir:'src',outDir:'dist'},include:['src/**/*.ts']});
 write(path.join(source,'src/input.ts'),'export const value=1;');write(path.join(source,'native/windows/Input.h'),'#define VALUE 1');
 const emit=()=>{for(const name of fs.readdirSync(path.join(source,'src'))){const text=fs.readFileSync(path.join(source,'src',name),'utf8'),js=name.replace(/\.ts$/,'.js');write(path.join(source,'dist',js),text);json(path.join(source,'dist',js+'.map'),{version:3,sources:['../src/'+name],sourcesContent:[text]});}};
 emit();fs.cpSync(source,installed,{recursive:true});return {...temp,app,source,runner,installed,emit,install(){fs.cpSync(source,installed,{recursive:true});}};
}

test('Windows SDK identity detects source, emitted and header changes at the same version and timestamp',{timeout},()=>{
 const f=workspace();try{
  const original=windowsBuildInputs(f.runner);assert.equal(packageBuildInputs(f.source),packageBuildInputs(f.installed));
  for(const relative of ['src/input.ts','dist/input.js','native/windows/Input.h']){
   const file=path.join(f.installed,relative),before=fs.readFileSync(file),stat=fs.statSync(file);fs.writeFileSync(file,Buffer.from(before.toString().replace('1','2')));fs.utimesSync(file,stat.atime,stat.mtime);
   assert.notEqual(windowsBuildInputs(f.runner),original,relative);fs.writeFileSync(file,before);assert.equal(windowsBuildInputs(f.runner),original);
  }
  write(path.join(f.installed,'src/new.ts'),'new');assert.notEqual(windowsBuildInputs(f.runner),original);fs.unlinkSync(path.join(f.installed,'src/new.ts'));assert.equal(windowsBuildInputs(f.runner),original);
  fs.unlinkSync(path.join(f.installed,'native/windows/Input.h'));assert.notEqual(windowsBuildInputs(f.runner),original);
 }finally{f.close();}
});

test('sample run compiles stale SDK source, supplies, installs, then skips all steps when unchanged',{timeout},async()=>{
 const f=workspace(),calls=[];try{
  const options={run:async(command,args,options)=>{calls.push({command,args,options});if(args.includes('build'))f.emit();if(args.includes('install'))f.install();},report(){}};
  assert.deepEqual((await refreshSampleWindowsSdk(f,options)).changed,[]);assert.equal(calls.length,0);
  write(path.join(f.source,'src/input.ts'),'export const value=2;');
  assert.deepEqual((await refreshSampleWindowsSdk(f,options)).changed,['@nelyx/sdk']);assert.equal(calls.length,3);
  assert(calls[0].args.includes('build'));assert(calls[1].args.includes('prepare:sample'));assert.equal(calls[1].options.env.NELYX_PREPARE_PACKAGES,'sdk');assert(calls[1].args.includes(f.app));assert(calls[2].args.includes(f.runner));assert(calls[2].args.includes('install'));
  assert.equal(packageBuildInputs(f.installed),packageBuildInputs(f.source));calls.length=0;
  await refreshSampleWindowsSdk(f,options);assert.equal(calls.length,0);
  write(path.join(f.source,'native/windows/Input.h'),'#define VALUE 3');await refreshSampleWindowsSdk(f,options);assert.equal(calls.length,2,'A native-header change resupplies without recompiling unchanged TypeScript');
  calls.length=0;write(path.join(f.source,'src/new.ts'),'export const added=1;');await refreshSampleWindowsSdk(f,options);assert.equal(calls.length,3,'A new unreferenced TypeScript module must be emitted before supply');assert(fs.existsSync(path.join(f.installed,'dist/new.js')));
 }finally{f.close();}
});

test('a failed SDK compile or install stops run before launching a stale application',{timeout},async()=>{
 const f=workspace();try{
  write(path.join(f.source,'src/input.ts'),'export const value=2;');let launches=0;
  await assert.rejects(runSampleWindows(f,{refresh:options=>refreshSampleWindowsSdk(options,{run:async()=>{throw Error('compile failed');},report(){}}),launch:async()=>{launches++;}}),/compile failed/);assert.equal(launches,0);
  await assert.rejects(runSampleWindows(f,{refresh:options=>refreshSampleWindowsSdk(options,{run:async(_cmd,args)=>{if(args.includes('build'))f.emit();if(args.includes('install'))throw Error('install failed');},report(){}}),launch:async()=>{launches++;}}),/install failed/);assert.equal(launches,0);
 }finally{f.close();}
});

test('sample run reloads the installed CLI after refresh and forwards native arguments unchanged',{timeout},async()=>{
 const calls=[],root=path.resolve('workspace with spaces'),app=path.join(root,'sample app'),args=['--','argument with spaces'];
 await runSampleWindows({root,app,arguments:args},{refresh:async()=>calls.push('refresh'),launch:async(cli,argv)=>calls.push({cli,argv})});
 assert.equal(calls[0],'refresh');assert.equal(calls[1].cli,path.join(app,'windows/runner/node_modules/@nelyx/cli/src/main.mjs'));assert.deepEqual(calls[1].argv,['run','--app',app,'--target','windows',...args]);
 await runSampleWindows({root,app,arguments:['--package','chosen package']},{refresh:async()=>assert.fail('Explicit package must not resupply SDK'),launch:async()=>{}});
 let refreshed=false;await runSampleWindows({root,app,arguments:['--','--package','native argument']},{refresh:async()=>{refreshed=true;},launch:async()=>{}});assert(refreshed,'Native arguments cannot disable SDK refresh');
});

function packageFixture(manifest){let current={directory:'package',manifest:{...manifest}},inputs='new';const calls=[];return {calls,get current(){return current;},set inputs(value){inputs=value;},ports:{packageFor:()=>current,readInputs:()=>inputs,build:async options=>{calls.push(options);current={...current,manifest:{...current.manifest,sdkInputsSha256:inputs}};}}};}
for(const manifest of [
 {cohort:{engine:'hermes'},configuration:'Release',hermesExecutionMode:'static-aot',hermesCompilerProfile:'optimized'},
 {cohort:{engine:'hermes'},configuration:'Debug',hermesExecutionMode:'bytecode',hermesCompilerProfile:'debug'},
 {cohort:{engine:'jsc'},configuration:'Release',jscExecutionMode:'interpreter'},
 {cohort:{engine:'v8'},configuration:'Release'},
])test(`default run rebuilds changed SDK and preserves ${JSON.stringify(manifest)}`,{timeout},async()=>{
 const f=packageFixture({...manifest,sdkInputsSha256:'old'}),result=await prepareWindowsRun({app:'app'},f.ports);
 assert.equal(result.manifest.sdkInputsSha256,'new');assert.equal(f.calls.length,1);const options=f.calls[0];assert.equal(options.engine,manifest.cohort.engine);assert.equal(options.configuration,manifest.configuration);assert.equal(options.hermesMode,manifest.hermesExecutionMode??'bytecode');
 if(manifest.cohort.engine==='hermes')assert.equal(options.hermesProfile,manifest.hermesCompilerProfile);else assert(!Object.hasOwn(options,'hermesProfile'));
 if(manifest.cohort.engine==='jsc')assert.equal(options.jscMode,'interpreter');
 await prepareWindowsRun({app:'app'},f.ports);assert.equal(f.calls.length,1,'Unchanged run launches the existing package without compiling again');
});

test('legacy packages rebuild once; explicit packages never follow SDK changes',{timeout},async()=>{
 const manifest={cohort:{engine:'hermes'},configuration:'Release',hermesExecutionMode:'static-aot',hermesCompilerProfile:'optimized'},f=packageFixture(manifest);
 await prepareWindowsRun({app:'app',directory:'selected'}, {...f.ports,readInputs:()=>assert.fail('Explicit package must not inspect installed SDK')});assert.equal(f.calls.length,0);
 await prepareWindowsRun({app:'app'},f.ports);assert.equal(f.calls.length,1);
 await assert.rejects(prepareWindowsRun({app:'app',directory:'selected',hermesMode:'bytecode'},f.ports),/different Hermes execution mode/);
});

test('failed or stale rebuilds cannot return the old executable for launch',{timeout},async()=>{
 const f=packageFixture({cohort:{engine:'hermes'},configuration:'Release',hermesExecutionMode:'static-aot',hermesCompilerProfile:'optimized'});
 await assert.rejects(prepareWindowsRun({app:'app'},{...f.ports,build:async()=>{throw Error('build failed');}}),/build failed/);
 await assert.rejects(prepareWindowsRun({app:'app'},{...f.ports,build:async()=>{}}),/did not capture/);
});
