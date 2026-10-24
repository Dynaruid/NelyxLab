// SPDX-License-Identifier: BSD-3-Clause
// Build each candidate once; terminate builders before interleaved native runs.
// All output/projects belong to this execution and are removed in finally.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn,spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
import {researchResult,researchFailures,fullRuntimeResult} from './windows-research-results.mjs';
const all=['v8','bytecode','static-aot'],choice=process.argv[2]??'matrix';
if(process.platform!=='win32'||!['matrix','frontend','diagnostic',...all].includes(choice))throw Error('Choose Windows matrix|frontend|diagnostic|'+all.join('|'));
const diagnostic=choice==='diagnostic',variants=choice==='matrix'?all:choice==='frontend'?['bytecode']:diagnostic?['static-aot']:[choice],root=path.resolve(import.meta.dirname,'../../..'),runner=path.join(root,'sample/nelyx-testbed-app-2/windows/runner');
const owners=[],prepared=[],rows=[],viewportMetrics=new Map(),started=performance.now();let child,stopped=false;
const power=spawnSync('powercfg.exe',['/getactivescheme'],{encoding:'utf8',windowsHide:true,timeout:10000}).stdout?.trim();
const kill=()=>{if(child?.pid)spawnSync('taskkill.exe',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore',timeout:10000});};
const stop=()=>{stopped=true;kill();};process.on('SIGINT',stop);process.on('SIGTERM',stop);
const externalBuilders=(process.env.NELYX_RESEARCH_WAIT_PIDS??'').split(',').filter(Boolean).map(Number);
assert(externalBuilders.every(pid=>Number.isSafeInteger(pid)&&pid>0&&pid!==process.pid),'Explicit external builder process IDs required');
async function waitForExternalBuilders(){
  const deadline=performance.now()+1_200_000;let reported=false;
  for(;;){const alive=externalBuilders.filter(pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}});if(!alive.length)return;
    assert(performance.now()<deadline,'External builders did not finish within 20 minutes');assert(!stopped,'Comparison interrupted');
    if(!reported){console.log('RESEARCH_WAIT_BUILDERS '+JSON.stringify({pids:alive,scope:'no measured runs until these owned builders exit'}));reported=true;}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
}
function native(candidate,args,{expectedStatus=0,...options}={}){
  assert(!stopped,'Comparison interrupted');const value=spawnSync(path.join(candidate.directory,'out/InputSurface.exe'),args,{cwd:path.join(candidate.directory,'out'),env:candidate.env,encoding:'utf8',windowsHide:true,timeout:1_200_000,maxBuffer:4*1024*1024,...options});
  if(value.error)throw value.error;const output=(value.stdout??'')+(value.stderr??'');assert.equal(value.status,expectedStatus,output.slice(-14000));return output;
}
async function prepare(variant,index,preflight=false){
  assert(!stopped,'Comparison interrupted');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-windows-animation-')),tag=String(process.pid)+index;
  const entries=['nelyx-animation-'+tag+'.tsx','nelyx-animation-'+tag+'.cjs','nelyx-animation-main-'+tag+'.tsx'].map(name=>path.join(runner,name));
  const owner={directory,entries,entriesAdmitted:false};owners.push(owner);for(const file of entries)assert(!fs.existsSync(file),'Comparison entry already exists');owner.entriesAdmitted=true;
  const engine=variant==='v8'?'v8':'hermes',hermesMode=variant==='static-aot'?'static-aot':'bytecode';
  const env={...process.env,NELYX_WINDOWS_ANIMATION_DIRECTORY:directory,NELYX_WINDOWS_ANIMATION_TAG:tag,NELYX_ANIMATION_BUILD_ONLY:'1',NELYX_ANIMATION_PREFLIGHT_ONLY:preflight?'1':'0',NELYX_ANIMATION_ENGINE:engine,NELYX_ANIMATION_HERMES_MODE:hermesMode,NELYX_ANIMATION_SAME_FRONTEND:variant==='bytecode'?'1':'0',NELYX_ANIMATION_MODE:'research-engine',NELYX_ANIMATION_VIEWPORT:'both',NELYX_ANIMATION_REPETITIONS:'3',NELYX_ANIMATION_ITERATE:'0',NELYX_ANIMATION_TRACE:'0',NELYX_ANIMATION_DIAGNOSTIC:'0',NELYX_ANIMATION_NATIVE_TRACE:'0',NELYX_ANIMATION_NATIVE_CORE_TRACE:'0',NELYX_ANIMATION_ALLOCATIONS:'0',NELYX_ANIMATION_V8_PROFILE:'0',NELYX_ANIMATION_SOURCE:'0',NELYX_ANIMATION_SOURCE_COMPILER:'0'};
  if(diagnostic){for(const name of ['TRACE','NATIVE_TRACE','NATIVE_CORE_TRACE'])env['NELYX_ANIMATION_'+name]='1';env.NELYX_ANIMATION_DIAGNOSTIC='0';}
  delete env.NELYX_ANIMATION_INLINE_REQUIRES;delete env.NELYX_ANIMATION_STARTUP_BASELINE;
  if(engine!=='v8'&&!env.NELYX_STATIC_HERMES_INPUTS)throw Error('Explicit same-VM NELYX_STATIC_HERMES_INPUTS required');
  const builds=[],tail=[];let exported,parseError,expired=false;
  child=spawn(process.execPath,['--test','--test-reporter=spec','--test-timeout=1200000',path.join(import.meta.dirname,'windows-animation.test.mjs')],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  const timer=setTimeout(()=>{expired=true;kill();},1_200_000);
  const receive=raw=>{try{
    const line=raw.replace(/\x1b\[[0-9;]*m/g,'').trim().replace(/^# /,'');if(!line)return;tail.push(line);if(tail.length>40)tail.shift();
    for(const prefix of ['ANIMATION_STATIC_HERMES ','ANIMATION_BUILD ','ANIMATION_REUSED '])if(line.startsWith(prefix)){const value=JSON.parse(line.slice(prefix.length));builds.push(value);console.log('RESEARCH_BUILD '+JSON.stringify({variant,...value}));}
    if(line.startsWith('ANIMATION_AOT_COVERAGE '))console.log('RESEARCH_COVERAGE '+JSON.stringify({variant,...JSON.parse(line.slice('ANIMATION_AOT_COVERAGE '.length))}));
    if(line.startsWith('ANIMATION_PREPARED '))exported=JSON.parse(line.slice(19));
  }catch(error){parseError??=error;kill();}};
  for(const stream of [child.stdout,child.stderr]){let buffer='';stream.setEncoding('utf8');stream.on('data',chunk=>{buffer+=chunk;let at;while((at=buffer.indexOf('\n'))>=0){receive(buffer.slice(0,at));buffer=buffer.slice(at+1);}if(buffer.length>65536)buffer=buffer.slice(-65536);});stream.on('end',()=>{if(buffer)receive(buffer);});}
  let status;try{status=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});}finally{clearTimeout(timer);}
  child=undefined;assert(!expired,'Candidate preparation exceeded 20 minutes');if(parseError)throw parseError;assert.equal(status,0,tail.join('\n'));
  assert(exported,'Candidate did not hand off a prepared native fixture');assert.equal(exported.directory,directory);assert.equal(exported.bundle,path.join(directory,'out/Bundle'));assert.equal(exported.engine,engine);assert.equal(exported.hermesMode,hermesMode);assert(/^[a-f0-9]{64}$/.test(exported.sourceSha256));if(variant==='static-aot')assert(exported.bindings.length>0);else assert.equal(exported.bindings.length,0);
  if(preflight){assert.equal(exported.preflight,true);console.log('RESEARCH_PREFLIGHT '+JSON.stringify({modules:exported.modules,bindings:exported.bindings.length}));return;}assert(!exported.preflight);
  const value={...exported,variant,env,builds};prepared.push(value);console.log('RESEARCH_PREPARED '+JSON.stringify({variant,sourceSha256:value.sourceSha256}));return value;
}
try{
  if(diagnostic){
    console.log('RESEARCH_DIAGNOSTIC_ROOT '+JSON.stringify({pid:process.pid,scope:'instrumented; excluded from timing acceptance'}));
    if(!process.env.NELYX_ANIMATION_REUSE_AOT_INPUT)await prepare('static-aot',1,true);const candidate=await prepare('static-aot',0);candidate.env.NELYX_ANIMATION_VIEWPORT='default';
    const output=native(candidate,[candidate.bundle]);
    console.log('RESEARCH_DIAGNOSTIC_CAPTURE '+JSON.stringify({output}));
    const js=output.split('\n').filter(line=>line.startsWith('ANIMATION_JS {"phase"')).map(line=>JSON.parse(line.slice('ANIMATION_JS '.length)));
    const stages=output.split('\n').filter(line=>line.startsWith('ANIMATION_STAGES ')).map(line=>JSON.parse(line.slice('ANIMATION_STAGES '.length)));
    let row;try{row=researchResult(output,{...candidate,viewport:'default',run:1});}catch(error){console.log('RESEARCH_DIAGNOSTIC_FAILURE '+JSON.stringify({error:String(error),js,stages}));throw error;}
    assert.deepEqual(stages.map(value=>value.phase),row.phases.map(value=>value.phase));
    for(const value of stages){assert(value.stages['Native.publish']?.n>0&&value.stages['NativeCore.frame']?.n>0);assert(!value.stages['NativeCore.cacheFallback']?.n);}
    console.log('RESEARCH_DIAGNOSTIC '+JSON.stringify({scope:'instrumented; excluded from 18-run timing acceptance; stage durations may overlap',sourceSha256:candidate.sourceSha256,builds:candidate.builds,row,js,stages}));
  }else if(choice==='frontend'){
    const candidate=await prepare('bytecode',0);candidate.env.NELYX_ANIMATION_VIEWPORT='default';
    fullRuntimeResult(native(candidate,[candidate.bundle],{env:{...candidate.env,NELYX_ANIMATION_MODE:'full-runtime-regression'}}),{aot:false});
    researchResult(native(candidate,[candidate.bundle]),{...candidate,viewport:'default',run:1});
    console.log('RESEARCH_FRONTEND_PASS '+JSON.stringify({variant:'bytecode',frontend:'native-hermes-es2022',scope:'functional only; no native AOT or timing acceptance'}));
  }else{
  // No measured process is admitted while a compiler/bundler is alive.
  if(variants.includes('static-aot'))await prepare('static-aot',variants.length,true);
  // Exercise the OS input/resize handshake with the inexpensive V8 build
  // before compiling any large native C input. The checker preflight is above.
  const preparationOrder=choice==='matrix'?['v8','bytecode','static-aot']:variants;
  for(let index=0;index<preparationOrder.length;index++){
    const candidate=await prepare(preparationOrder[index],index);
    if(candidate.variant==='static-aot')await waitForExternalBuilders();
    if(candidate.variant==='static-aot'||candidate.variant==='bytecode'){
      candidate.env.NELYX_ANIMATION_VIEWPORT='default';
      fullRuntimeResult(native(candidate,[candidate.bundle],{env:{...candidate.env,NELYX_ANIMATION_MODE:'full-runtime-regression'}}),{aot:candidate.variant==='static-aot'});
      console.log('RESEARCH_FULL_RUNTIME '+JSON.stringify({variant:candidate.variant,material:29,cupertino:20,editingResize:true,lifecycleResizes:6,...(candidate.variant==='static-aot'?{nativeFallbacks:0}:{}),scope:'functional-only; excluded from timing comparison'}));
    }
    if(index===0||candidate.variant==='static-aot'||candidate.variant==='bytecode')for(let probe=1;probe<=1;probe++){
      const viewport='default';candidate.env.NELYX_ANIMATION_VIEWPORT=viewport;
      researchResult(native(candidate,[candidate.bundle]),{...candidate,viewport,run:probe});
      console.log('RESEARCH_NATIVE_PREFLIGHT '+JSON.stringify({variant:candidate.variant,viewport,probe,scope:'functional-only; excluded from timing comparison'}));
    }
  }
  await waitForExternalBuilders();
  for(const candidate of prepared){candidate.env.NELYX_ANIMATION_VIEWPORT='default';researchFailures({directory:candidate.directory,bundle:candidate.bundle,run:(exe,args,options)=>{const {nativeDiagnostics,...rest}=options;assert.equal(exe,path.join(candidate.directory,'out/InputSurface.exe'));return native(candidate,args,rest);}});console.log('RESEARCH_FAILURES '+JSON.stringify({variant:candidate.variant,presentation:2,bundle:2,startupClose:0}));}
  for(let run=1;run<=3;run++)for(const viewport of ['default','maximized']){
    const candidates=prepared,offset=(run-1)%candidates.length,order=[...candidates.slice(offset),...candidates.slice(0,offset)];if(viewport==='maximized')order.reverse();
    for(const candidate of order){candidate.env.NELYX_ANIMATION_VIEWPORT=viewport;const output=native(candidate,[candidate.bundle]),row=researchResult(output,{...candidate,viewport,run});const metrics=JSON.stringify(['logicalWidth','logicalHeight','physicalWidth','physicalHeight','scale'].map(key=>row.metrics[key]));if(viewportMetrics.has(viewport))assert.equal(metrics,viewportMetrics.get(viewport),'All engines must use the same selected viewport');else viewportMetrics.set(viewport,metrics);rows.push({...row,variant:candidate.variant});console.log('RESEARCH_RUN '+JSON.stringify({variant:candidate.variant,...row}));}
  }
  const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
  for(const candidate of prepared){const selected=rows.filter(row=>row.variant===candidate.variant),summaries=[...new Set(selected.map(row=>row.viewport))].map(viewport=>{
    const subset=selected.filter(row=>row.viewport===viewport),phase=(row,name)=>row.phases.find(item=>item.phase===name).cpu;assert.equal(subset.length,3);assert.equal(new Set(subset.map(row=>JSON.stringify(['logicalWidth','logicalHeight','physicalWidth','physicalHeight','scale'].map(key=>row.metrics[key])))).size,1,'The selected viewport changed across runs');
    return {viewport,runs:3,warmP95Ms:median(subset.map(row=>phase(row,'list-warm').p95)),coldP95Ms:median(subset.map(row=>phase(row,'list-entry-cold').p95)),revisitMaxMs:Math.max(...subset.map(row=>phase(row,'list-entry-revisit').max)),routeP95Ms:median(subset.map(row=>phase(row,'route-typed').p95)),inputP95Ms:median(subset.map(row=>row.input.p95)),resizeP95Ms:median(subset.map(row=>row.resize.p95)),peakWorkingSetMiB:median(subset.map(row=>row.memory.peakWorkingSetBytes/1024**2)),maxPeakWorkingSetMiB:Math.max(...subset.map(row=>row.memory.peakWorkingSetBytes/1024**2)),processToSurfaceMs:median(subset.map(row=>row.startup.processToSurfaceMs)),maxProcessToSurfaceMs:Math.max(...subset.map(row=>row.startup.processToSurfaceMs)),typedCalls:subset.map(row=>row.typedCalls)};
  });console.log('RESEARCH_SUMMARY '+JSON.stringify({variant:candidate.variant,frontend:candidate.variant==='v8'?'native-v8-es2022':'native-hermes-es2022',power,cache:'OS file cache uncontrolled',externalLoad:'not controlled',displayed:'unobserved',sourceSha256:candidate.sourceSha256,builds:candidate.builds,summaries}));}
  assert.equal(rows.length,choice==='matrix'?18:6);console.log('RESEARCH_COMPLETE '+JSON.stringify({runs:rows.length,elapsedMs:performance.now()-started,order:rows.map(({variant,viewport,run})=>({variant,viewport,run}))}));
  }
}finally{
  process.off('SIGINT',stop);process.off('SIGTERM',stop);if(child){kill();if(child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>child.once('close',resolve));}
  for(const owner of owners){if(owner.entriesAdmitted)for(const file of owner.entries)if(fs.existsSync(file)){assert.equal(path.dirname(file),runner);assert(!fs.lstatSync(file).isSymbolicLink());fs.unlinkSync(file);}if(fs.existsSync(owner.directory)){assert.equal(path.dirname(owner.directory),fs.realpathSync(os.tmpdir()));assert(path.basename(owner.directory).startsWith('nelyx-windows-animation-'));assert(!fs.lstatSync(owner.directory).isSymbolicLink());fs.rmSync(owner.directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}}
}
