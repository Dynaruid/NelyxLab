// SPDX-License-Identifier: BSD-3-Clause
// W16 continuous-entry qualification. Temporary candidates are execution-owned.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {continuousScrollResult} from './windows-scroll-results.mjs';
import {symbolizeWindowsFault} from './windows-fault-results.mjs';
import {verifyWindowsHermes} from '../../sdk/tooling/cli/src/windows-process.mjs';

const root=path.resolve(import.meta.dirname,'../../..'),runner=path.join(root,'sample/nelyx-testbed-app-2/windows/runner');
const staticLocator=path.join(root,'sample/nelyx-testbed-app-2/.nelyx/windows/static-hermes-inputs.json');
const choice=process.argv[2]??'matrix',runs=Number(process.argv[3]??3);
const diagnostic=process.env.NELYX_SCROLL_DIAGNOSTIC==='1';
const afterDiagnostic=process.env.NELYX_SCROLL_AFTER_DIAGNOSTIC==='1';
const afterPolicy=process.env.NELYX_SCROLL_AFTER_POLICY==='1',childPolicy=process.env.NELYX_SCROLL_CHILD_POLICY??'legacy';
assert(['legacy','bounded','observed-budget'].includes(childPolicy));assert(!afterPolicy||afterDiagnostic,'Policy follow-up reuses the separate diagnostic hosts');
const waitForInput=process.env.NELYX_SCROLL_WAIT_FOR_INPUT==='1';
const selectedMonitor=process.env.NELYX_SCROLL_MONITOR??'primary',diagnosticViewport=process.env.NELYX_SCROLL_DIAGNOSTIC_VIEWPORT??'default';
assert(selectedMonitor==='primary'||/^\d+x\d+@\d+$/.test(selectedMonitor));assert(['default','maximized'].includes(diagnosticViewport));
assert(!afterDiagnostic||!diagnostic,'Choose separate native attribution or a JS-only follow-up after timing');
const input=process.env.NELYX_SCROLL_INPUT??'os';
const catalog=process.env.NELYX_SCROLL_CATALOG??(input==='os'?'full':'bounded');
assert(['full','bounded'].includes(catalog)&&!(catalog==='full'&&input==='queued'),'Full catalog requires OS input');
const catalogs=Object.fromEntries([['material','catalog.ts','demos'],['cupertino','cupertino-catalog.ts','cupertinoDemos']].map(([name,file,exportName])=>{
 const source=fs.readFileSync(path.join(root,'sample/nelyx-testbed-app-2/src',file),'utf8'),body=source.split('export const '+exportName+':')[1]?.split('];')[0];assert(body,'Product catalog declaration missing');
 const ids=[...body.matchAll(/\{id: '([^']+)'/g)].map(match=>match[1]);assert(ids.length&&new Set(ids).size===ids.length);return [name,ids];
}));
assert(['os','queued'].includes(input),'Choose OS input or queued SDK diagnostics');
assert(input==='os'||diagnostic,'Queued SDK input is diagnostic only, never an OS performance sample');
assert(process.platform==='win32'&&['hermes','v8','static-aot','matrix'].includes(choice),'Choose Windows hermes|static-aot|matrix|v8');
assert(Number.isInteger(runs)&&runs>=1&&runs<=3,'Use 1-3 repetitions');
if(diagnostic)assert(['hermes','static-aot','matrix'].includes(choice)&&runs===1,'Diagnostic attribution uses one default-window run per Hermes mode');
const variants=choice==='matrix'?['hermes','static-aot']:[choice],owners=[],candidates=[];
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report=(label,value)=>new Promise((resolve,reject)=>process.stdout.write(label+' '+JSON.stringify(value)+'\n',error=>error?reject(error):resolve()));
const configFile=path.join(runner,'app-config.json'),originalConfig=fs.readFileSync(configFile);
let suppliedConfig;
let child,interrupted=false,inputWaitRejected;
function kill(){if(child?.pid)spawnSync('taskkill.exe',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,timeout:10000,stdio:'ignore'});}
const stop=()=>{interrupted=true;inputWaitRejected?.(Error('Qualification interrupted'));kill();};process.on('SIGINT',stop);process.on('SIGTERM',stop);
async function awaitInputReady(){
 if(!waitForInput)return;
 assert.equal(input,'os','Desktop readiness is only needed for OS wheel input');
 const file=path.join(owners[0].directory,'os-input.ready');assert(!fs.existsSync(file));
 await new Promise((resolve,reject)=>{
  const ready=()=>{if(!fs.existsSync(file))return;cleanup();resolve();},failed=error=>{cleanup();reject(error);};
  const watcher=fs.watch(path.dirname(file),(_event,name)=>{if(String(name)===path.basename(file))ready();});
  const timer=setTimeout(()=>failed(Error('Input readiness timed out')),1_200_000);
  const cleanup=()=>{clearTimeout(timer);watcher.close();inputWaitRejected=undefined;};
  watcher.once('error',failed);inputWaitRejected=failed;
  void report('SCROLL_INPUT_READY',{file,message:'Builds complete. Stop mouse/trackpad use, then create this temporary file to start OS wheel injection.'}).catch(failed);ready();
 });
 assert(!interrupted,'Qualification interrupted');
}
async function prepare(variant,reuse){
 assert(!interrupted,'Qualification interrupted');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-windows-animation-')),tag=String(process.pid)+owners.length;
 const entries=['nelyx-animation-'+tag+'.tsx','nelyx-animation-'+tag+'.cjs','nelyx-animation-main-'+tag+'.tsx'].map(name=>path.join(runner,name));
 assert(entries.every(file=>!fs.existsSync(file)));owners.push({directory,entries});
 const env={...process.env,NELYX_WINDOWS_ANIMATION_DIRECTORY:directory,NELYX_WINDOWS_ANIMATION_TAG:tag,NELYX_ANIMATION_BUILD_ONLY:'1',NELYX_ANIMATION_ENGINE:variant==='v8'?'v8':'hermes',NELYX_ANIMATION_HERMES_MODE:variant==='static-aot'?'static-aot':'bytecode',NELYX_ANIMATION_HERMES_OPT:'optimized',NELYX_ANIMATION_MODE:'research-engine',NELYX_ANIMATION_VIEWPORT:'both',NELYX_ANIMATION_REPETITIONS:'3',NELYX_ANIMATION_SEMANTICS_INTERVAL:'50',NELYX_ANIMATION_WHEEL_INPUT:input==='os'?'1':'queued',NELYX_ANIMATION_WHEEL_INTERVAL_MS:'16',NELYX_ANIMATION_WHEEL_DELTA:'6',NELYX_CONTINUOUS_SCROLL:'1'};
 env.NELYX_CONTINUOUS_CATALOG=catalog;
 env.NELYX_CONTINUOUS_CHILD_POLICY=childPolicy;
 env.NELYX_ANIMATION_MONITOR=selectedMonitor;
 for(const name of ['REUSE_AOT_INPUT','REUSE_CURRENT_INPUT','STARTUP_BASELINE','INLINE_REQUIRES','SAME_FRONTEND','EXPECT_ALLOCATION_FAILURE'])delete env['NELYX_ANIMATION_'+name];
 for(const name of ['ITERATE','TRACE','DIAGNOSTIC','NATIVE_TRACE','NATIVE_CORE_TRACE','ALLOCATIONS','V8_PROFILE','SOURCE','SOURCE_COMPILER','PREFLIGHT_ONLY','FRONTEND_ONLY'])env['NELYX_ANIMATION_'+name]='0';
 const nativeInstrumented=diagnostic||!!reuse;
 env.NELYX_ANIMATION_NATIVE_PC=nativeInstrumented?'1':'0';
 if(nativeInstrumented)env.NELYX_CONTINUOUS_CATALOG='bounded';
 if(nativeInstrumented)for(const name of ['TRACE','DIAGNOSTIC','NATIVE_TRACE','NATIVE_CORE_TRACE'])env['NELYX_ANIMATION_'+name]='1';
 if(reuse){
  assert.equal(variant,reuse.variant);
  const names=['Bundle/input-surface.js','Bundle/input-surface.bundle',...(variant==='static-aot'?['NelyxApp.aot.dll','Bundle/index.windows.typed.ts','Bundle/index.windows.rnw-pal.js','Bundle/native-pc-map.json']:[])];
  env.NELYX_ANIMATION_REUSE_CURRENT_INPUT=JSON.stringify({directory:reuse.directory,engine:reuse.engine,hermesMode:reuse.hermesMode,bindings:reuse.bindings,files:Object.fromEntries(names.map(name=>[name,sha(path.join(reuse.directory,'out',name))]))});
 }
 // Both Hermes modes use the same qualified VM/GC supplier. Lowering and
 // compiler flags are recorded separately; a shared VM is not a shared IR.
 delete env.NELYX_STATIC_HERMES_INPUTS;
 if(variant!=='v8'&&fs.existsSync(staticLocator))env.NELYX_STATIC_HERMES_INPUTS=JSON.parse(fs.readFileSync(staticLocator)).directory;
 if(variant==='static-aot')assert(env.NELYX_STATIC_HERMES_INPUTS,'Prepare the RNW Static Hermes supplier before its comparison; the direct-host VM cannot substitute for it');
 let prepared,parseFailure,tail=[];
 child=spawn(process.execPath,['--test','--test-reporter=spec','--test-timeout=1200000',path.join(import.meta.dirname,'windows-animation.test.mjs')],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const timer=setTimeout(kill,1_200_000);
 const receive=raw=>{try{const line=raw.replace(/\x1b\[[0-9;]*m/g,'').trim().replace(/^# /,'');tail.push(line);if(tail.length>35)tail.shift();if(line.startsWith('ANIMATION_PREPARED '))prepared=JSON.parse(line.slice(19));if(/^(ANIMATION_(BUILD|AOT_COVERAGE|STATIC_HERMES|CONFIG)|STATIC_AOT_COMPILE) /.test(line))console.log(line);}catch(error){parseFailure??=error;kill();}};
 for(const stream of [child.stdout,child.stderr]){let buffer='';stream.setEncoding('utf8');stream.on('data',chunk=>{buffer+=chunk;let at;while((at=buffer.indexOf('\n'))>=0){receive(buffer.slice(0,at));buffer=buffer.slice(at+1);}});stream.on('end',()=>{if(buffer)receive(buffer);});}
 let status;try{status=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});}finally{clearTimeout(timer);child=undefined;}
 if(parseFailure)throw parseFailure;assert.equal(status,0,tail.join('\n'));assert(prepared,'No prepared candidate');assert.equal(prepared.directory,directory);
 assert.equal(prepared.engine,env.NELYX_ANIMATION_ENGINE);assert.equal(prepared.hermesMode,env.NELYX_ANIMATION_HERMES_MODE);
 if(prepared.pcProfiler)assert.equal(prepared.pcProfiler,path.join(directory,'out/ScrollProfile.exe'));
 const artifact=path.join(prepared.bundle,'input-surface.bundle'),vm=path.join(directory,'out/hermes.dll');
 const identity={engine:prepared.engine,mode:prepared.hermesMode,profile:variant==='v8'?'source-js':'optimized',configuration:'Release',entrySha256:sha(artifact),hostSha256:sha(path.join(directory,'out/InputSurface.exe'))};
 if(variant!=='v8'){
  identity.vmSha256=sha(vm);identity.vmSupplier=env.NELYX_STATIC_HERMES_INPUTS?'rnw-static-hermes':'rnw-cohort-hermes';
  if(env.NELYX_STATIC_HERMES_INPUTS)assert.equal(identity.vmSha256,sha(path.join(env.NELYX_STATIC_HERMES_INPUTS,'build/API/hermes_shared/hermes.dll')));else verifyWindowsHermes(path.join(directory,'out'));
  if(variant==='hermes'){assert.equal(fs.readFileSync(artifact).readUInt32LE(8),99);identity.compilerSha256=sha(path.join(process.env.USERPROFILE,'.nuget/packages/microsoft.javascript.hermes/0.0.0-2604.21001-94aa5e1d/tools/native/release/x64/hermes.exe'));}
  else identity.aotSha256=sha(path.join(directory,'out/NelyxApp.aot.dll'));
 }
 console.log('SCROLL_CANDIDATE '+JSON.stringify({variant,sourceSha256:prepared.sourceSha256,...identity}));
 if(reuse){assert.equal(prepared.sourceSha256,reuse.sourceSha256);assert.equal(identity.entrySha256,reuse.identity.entrySha256);if(identity.aotSha256)assert.equal(identity.aotSha256,reuse.identity.aotSha256);}
 const value={...prepared,env,variant,identity,nativeInstrumented};candidates.push(value);return value;
}
async function native(candidate,viewport,runtimeDiagnostic=diagnostic,runtimePolicy=childPolicy){
 assert(!interrupted,'Qualification interrupted');
 const executable=path.join(candidate.directory,'out/InputSurface.exe');
 child=spawn(candidate.pcProfiler??executable,candidate.pcProfiler?[executable,candidate.bundle]:[candidate.bundle],{cwd:path.join(candidate.directory,'out'),env:{...candidate.env,NELYX_CONTINUOUS_CHILD_POLICY:runtimePolicy,NELYX_ANIMATION_VIEWPORT:viewport,NELYX_ANIMATION_TRACE:runtimeDiagnostic?'1':'0',NELYX_ANIMATION_DIAGNOSTIC:runtimeDiagnostic?'1':'0'},windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='',overflow=false;const timer=setTimeout(kill,1_200_000);
 for(const stream of [child.stdout,child.stderr]){stream.setEncoding('utf8');stream.on('data',chunk=>{if(output.length+chunk.length>8*1024**2){overflow=true;kill();return;}output+=chunk;});}
 let status;try{status=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});}finally{clearTimeout(timer);child=undefined;}
 assert(!overflow,'Native output exceeded its bounded buffer');assert(!interrupted,'Qualification interrupted');return {output,status};
}
async function execute(candidate,viewport,run,runtimeDiagnostic=diagnostic,runtimePolicy=childPolicy){
 const result=await native(candidate,viewport,runtimeDiagnostic,runtimePolicy),output=result.output,parseErrors=[];
 const records=prefix=>output.split('\n').filter(line=>line.startsWith(prefix)).flatMap((line,index)=>{try{return [JSON.parse(line.slice(prefix.length))];}catch(error){parseErrors.push({prefix,index,error:String(error).slice(0,200)});return [];}});
 const phases=records('ANIMATION_JS CONTINUOUS ');
 const runCatalog=candidate.env.NELYX_CONTINUOUS_CATALOG;
 const samples=output.split('\n').filter(line=>line.startsWith('ANIMATION_JS {"phase"')).flatMap((line,index)=>{try{return [JSON.parse(line.slice('ANIMATION_JS '.length))];}catch(error){parseErrors.push({prefix:'phase',index,error:String(error).slice(0,200)});return [];}});
 const display=records('ANIMATION_DISPLAY ')[0],viewMetrics=records('ANIMATION_JS view-metrics ')[0];
 await report('SCROLL_RUN',{variant:candidate.variant,run,viewport,diagnostic:runtimeDiagnostic,childPolicy:runtimePolicy,input,catalog:runCatalog,identity:candidate.identity,sourceSha256:candidate.sourceSha256,display,viewMetrics,status:result.status,phases,pacing:records('ANIMATION_WHEEL_SEND '),resources:samples.map(({phase,hermesDelta,hermesMemoryBefore,hermesMemoryAfter,textCache,childBudget})=>({phase,hermesDelta,hermesMemoryBefore,hermesMemoryAfter,textCache,childBudget}))});
 if(runtimeDiagnostic){
  const retainedSpans=new Set(['Sliver.createChild','Sliver.removeChild','Sliver.didStartLayout','Pipeline.flushLayout','Pipeline.flushSemantics','Widgets.flushBuild','Widgets.finalizeTree','Item.createBuildFirstLayout','TextCache.key','TextCache.reuse','TextCache.remember','NativeText.layout','Text.layout','Text.paragraphLayout','Text.buildParagraph','Style.snapshotRun']);
  const top=values=>{const entries=Object.entries(values??{}).sort((a,b)=>(b[1]?.sum??0)-(a[1]?.sum??0)),keep=new Set(entries.slice(0,24).map(([key])=>key));return Object.fromEntries(entries.filter(([key])=>keep.has(key)||retainedSpans.has(key)));};
  const js=samples.map(value=>({phase:value.phase,childBudget:value.childBudget,spans:top(Object.fromEntries(Object.entries(value).filter(([,v])=>v&&typeof v==='object'&&'sum'in v))),exclusive:top(value.exclusive),allocations:Object.fromEntries(Object.entries(value).filter(([key])=>key.startsWith('Allocated.'))),classOwners:value.classOwners,counts:value.counts,hermesDelta:value.hermesDelta}));
  await report('SCROLL_ATTRIBUTION',{variant:candidate.variant,childPolicy:runtimePolicy,scope:'instrumented; excluded from timing acceptance; inclusive spans overlap',nativeInstrumented:candidate.nativeInstrumented,js,native:records('ANIMATION_STAGES '),parseErrors});
 }
 if(result.status!==0||!output.includes('continuous-scroll PASS')||/ANIMATION_JS ERROR|ANIMATION_REACT_ERROR|watchdog/.test(output)||!output.includes('closed views=0 consumers=0 gpuDrained=1 inputRetired=1')){
  const faultPcs=records('ANIMATION_FAULT_PC ');let symbols,symbolError;try{symbols=symbolizeWindowsFault(faultPcs,path.join(candidate.directory,'out'));}catch(error){symbolError=String(error);}
  await report('SCROLL_FAILURE',{variant:candidate.variant,viewport,fatal:records('ANIMATION_FATAL '),faultPcs,symbols,symbolError,causes:output.split('\n').filter(line=>line.includes('CORE_FAILURE ')).slice(0,3).map(line=>line.slice(0,16000)),errors:output.split('\n').filter(line=>/ERROR|watchdog|close-failed|failure|LAST_BOOT|FATAL/.test(line)).slice(-10).map(line=>line.slice(0,1500)),tail:output.split('\n').slice(-5).map(line=>line.slice(0,500)),parseErrors});throw Error('Continuous native qualification failed; see SCROLL_FAILURE');
 }
 assert.equal(parseErrors.length,0,'Corrupted diagnostic records cannot qualify');
 let qualified;try{qualified=continuousScrollResult(output,{...candidate,diagnostic:runtimeDiagnostic,childPolicy:runtimePolicy,input,catalog:runCatalog,catalogs});}
 catch(error){await report('SCROLL_FAILURE',{variant:candidate.variant,viewport,run,diagnostic:runtimeDiagnostic,childPolicy:runtimePolicy,stage:'qualification',error:String(error)});throw error;}
 await report('SCROLL_QUALIFIED',{variant:candidate.variant,run,viewport,diagnostic:runtimeDiagnostic,childPolicy:runtimePolicy,pacingPolicy:qualified.pacing[0].policy,memory:qualified.memory,displayed:'unobserved',physicalInputAccepted:'notVerified'});
}
let primary;
try{
 assert(!variants.includes('static-aot')||fs.existsSync(staticLocator),'Prepare the RNW Static Hermes supplier before its comparison; the direct-host VM cannot substitute for it');
 const inputs=['work17.md','research.md','Nelyx/dist/framework/widgets/sliver.js','sample/nelyx-testbed-app-2/windows/runner/node_modules/@nelyx/core/dist/framework/widgets/sliver.js','sample/nelyx-testbed-app-2/.nelyx/windows/native-inputs.json',...(variants.some(value=>value!=='v8')&&fs.existsSync(staticLocator)?['sample/nelyx-testbed-app-2/.nelyx/windows/static-hermes-inputs.json']:[]),...(variants.includes('v8')?['sample/nelyx-testbed-app-2/.nelyx/windows/v8-inputs.json']:[])];
 for(const file of ['framework/widgets/framework.js','framework/widgets/scroll-delegate.js','framework/rendering/sliver-multi-box-adaptor.js','framework/rendering/sliver-section-list.js','hosting/text-layout-cache.js','ui/text.js','framework/widgets/focus.js','framework/widgets/focus-scope.js','framework/semantics/semantics.js','framework/rendering/semantics-pipeline.js'])inputs.push('Nelyx/dist/'+file,'sample/nelyx-testbed-app-2/windows/runner/node_modules/@nelyx/core/dist/'+file);
 for(const file of ['gallery.ts','cupertino-gallery.ts','gallery-section.ts','catalog.ts','cupertino-catalog.ts','list-view.ts'])inputs.push('sample/nelyx-testbed-app-2/src/'+file);
 inputs.push(...['run-windows-scroll.mjs','windows-animation.test.mjs','windows-animation.tsx','windows-animation.cpp','windows-wheel-pacer.h','windows-scroll-results.mjs'].map(name=>'Nelyx/eng/tests/'+name));
 console.log('SCROLL_INPUTS '+JSON.stringify(Object.fromEntries(inputs.map(file=>[file,sha(path.join(root,file))]))));
 const reference=process.env.NELYX_SCROLL_REFERENCE_CORE_SHA256??sha(path.join(root,inputs[2]));assert(/^[a-f0-9]{64}$/.test(reference));
 assert.equal(reference,sha(path.join(root,inputs[3])),'Supply current Core or name the exact pre-change installed Core hash for a baseline');
 const treeDigest=directory=>{const files=[];function visit(relative){for(const entry of fs.readdirSync(path.join(directory,relative),{withFileTypes:true})){assert(!entry.isSymbolicLink());const name=relative+'/'+entry.name;if(entry.isDirectory())visit(name);else if(entry.isFile())files.push(name);}}visit('src');visit('dist');files.push('package.json');files.sort();const hash=createHash('sha256');for(const file of files)hash.update(file+'\0'+sha(path.join(directory,file))+'\n');return {files:files.length,sha256:hash.digest('hex')};};
 const workspace=treeDigest(path.join(root,'Nelyx')),installed=treeDigest(path.join(runner,'node_modules/@nelyx/core'));
 await report('SCROLL_CORE_SUPPLY',{algorithm:'sorted relative path + NUL + file SHA-256 + LF; src/dist/package.json',workspace,installed});
 const referenceDigest=process.env.NELYX_SCROLL_REFERENCE_CORE_DIGEST??workspace.sha256;assert(/^[a-f0-9]{64}$/.test(referenceDigest));assert.equal(installed.sha256,referenceDigest,'Supply all changed Core owners or name the exact installed baseline tree digest');
 suppliedConfig=Buffer.from(JSON.stringify({...JSON.parse(originalConfig),accessibilityEnabled:true},null,2)+'\n');fs.writeFileSync(configFile,suppliedConfig);
 for(const variant of variants)await prepare(variant);
 await awaitInputReady();
 let timingFailure;
 try{for(let run=1;run<=runs;run++)for(const viewport of diagnostic?[diagnosticViewport]:['default','maximized'])for(const candidate of run%2?candidates:[...candidates].reverse())await execute(candidate,viewport,run);}catch(error){timingFailure=error;await report('SCROLL_TIMING_FAILURE',{error:String(error)});}
 // Preserve the first timing failure, but still diagnose both already-built
 // modes. Reuse compiler output only within this execution; finally owns all
 // temporary hosts and artifacts, including a failed timing candidate.
 if(afterDiagnostic&&!interrupted){
  const originals=[...candidates],instrumented=[];for(const candidate of originals)instrumented.push(await prepare(candidate.variant,candidate));
  const errors=[];for(const candidate of instrumented){try{await execute(candidate,'default',1,true);}catch(error){errors.push(error);if(interrupted)break;}}
  if(afterPolicy&&!interrupted)for(const candidate of instrumented){try{await execute(candidate,'maximized',1,true,'observed-budget');}catch(error){errors.push(error);if(interrupted)break;}}
  if(errors.length)throw new AggregateError(timingFailure?[timingFailure,...errors]:errors,'Diagnostic qualification failed');
 }
 if(timingFailure)throw timingFailure;
}catch(error){primary=error;process.exitCode=1;await report('SCROLL_ABORT',{error:String(error)});}finally{
 process.off('SIGINT',stop);process.off('SIGTERM',stop);
 const errors=[];
 try{if(child){kill();if(child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>child.once('close',resolve));}}catch(error){errors.push(error);}
 for(const {directory,entries}of owners){
  for(const file of entries)try{if(fs.existsSync(file)){assert.equal(path.dirname(file),runner);assert(!fs.lstatSync(file).isSymbolicLink());fs.unlinkSync(file);}}catch(error){errors.push(error);}
  try{assert.equal(path.dirname(directory),fs.realpathSync(os.tmpdir()));assert(path.basename(directory).startsWith('nelyx-windows-animation-'));if(fs.existsSync(directory)){assert(!fs.lstatSync(directory).isSymbolicLink());fs.rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}}catch(error){errors.push(error);}
 }
 try{if(suppliedConfig){assert(fs.readFileSync(configFile).equals(suppliedConfig),'Runner configuration changed during qualification');fs.writeFileSync(configFile,originalConfig);}}catch(error){errors.push(error);}
 if(errors.length)throw new AggregateError(primary?[primary,...errors]:errors,'Scroll qualification cleanup failed');
}
