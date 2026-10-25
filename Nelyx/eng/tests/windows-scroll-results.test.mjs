// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {continuousScrollResult} from './windows-scroll-results.mjs';
const timeout=1_200_000;
const options={engine:'hermes',hermesMode:'bytecode',diagnostic:false};
function fixture(){
 const distribution={n:1,sum:8,p50:8,p95:8,p99:8,max:8};
 const names=['list-retained','list-cold','list-revisit','list-fast',...['material-0','material-1','cupertino-0'].flatMap(name=>['cold','revisit','fast'].map(phase=>name+'-'+phase))];
 const phases=names.map(name=>{const count=name==='list-retained'?48:240;return {name,requestedCount:count,requestedDelta:-10,received:count,appliedInputs:count,unchangedInputs:0,absoluteDistance:count*4,netDistance:name==='list-retained'?0:count*4,delivery:{queueCalls:count,queueHighWater:10,firstNativeSequence:1,lastNativeSequence:count,nativeSequenceRegressions:0},requestedIntervalMs:name.endsWith('-fast')?4:16,cpu:{...distribution},entryCpu:{...distribution},retainedCpu:{...distribution},oldestInputToSurface:{...distribution},latestInputToSurface:{...distribution},viewport:160,elapsedMs:1000,mounts:name==='list-retained'?0:20,unmounts:name==='list-retained'?0:20,minimum:0,maximum:880,displayed:'unobserved',physicalTrackpad:'notVerified'};});
 for(const phase of phases)Object.assign(phase,{catalogScope:'bounded',injection:'fixed',maximumInjected:phase.requestedCount,itemCreateBuildFirstLayout:phase.name==='list-retained'?{n:0,sum:0}:{...distribution},createdRows:phase.name==='list-retained'?0:1,createdElements:phase.mounts});
 const metrics=names.map(phase=>({phase,engine:'hermes',mode:'research-engine',trace:false,diagnostic:false,semanticsUpdateInterval:50}));
 const extra=[...phases.map(phase=>'ANIMATION_WHEEL_SEND '+JSON.stringify({mode:phase.name==='list-retained'?'os-sweep':'os',policy:'high-resolution-relative-start-completion-v1',count:phase.requestedCount,requestedMs:phase.requestedIntervalMs,p50Ms:phase.requestedIntervalMs,p95Ms:phase.requestedIntervalMs+.1,maxMs:phase.requestedIntervalMs+.2})),'ANIMATION_JS continuous-scroll PASS','NELYX_WINDOWS_HOST closed views=0 consumers=0 gpuDrained=1 inputRetired=1','ANIMATION_MEMORY {"workingSetBytes":100,"peakWorkingSetBytes":120,"privateBytes":80}'];
 return {phases,metrics,extra,output(){return [...phases.map(value=>'ANIMATION_JS CONTINUOUS '+JSON.stringify(value)),...metrics.map(value=>'ANIMATION_JS '+JSON.stringify(value)),...extra].join('\n');}};
}
test('continuous qualification distinguishes delivered surface work from display evidence',{timeout},()=>{
 const f=fixture(),value=continuousScrollResult(f.output(),options);assert.equal(value.phases.length,13);assert.equal(value.memory.privateBytes,80);
 assert.throws(()=>continuousScrollResult(f.output(),{...options,input:'queued'}),'SDK queue cannot qualify uninstrumented OS timing');
 for(const change of [f=>f.phases.pop(),f=>f.phases[1].appliedInputs--,f=>f.phases[1].maximum=799,f=>f.phases[0].mounts=1,f=>f.metrics[0].engine='v8',f=>f.metrics[0].diagnostic=true,f=>f.metrics[0].semanticsUpdateInterval=0,f=>f.phases[1].cpu.p95=NaN,f=>f.phases[1].displayed='observed',f=>f.extra.push('ANIMATION_JS ERROR hidden'),f=>f.extra.pop()]){const broken=fixture();change(broken);assert.throws(()=>continuousScrollResult(broken.output(),options));}
 // End-of-content packets still count as delivery, with a separate latency set.
 f.phases[4].unchangedInputs=20;f.phases[4].appliedInputs=220;assert.doesNotThrow(()=>continuousScrollResult(f.output(),options));
});

test('wheel qualification requires the current pacing policy and observed completion intervals',{timeout},()=>{
 for(const change of [send=>delete send.policy,send=>send.policy='ordinary-sleep',send=>delete send.p50Ms,send=>send.p95Ms=NaN,send=>send.p50Ms=0,send=>send.p95Ms=1,send=>send.maxMs=1]){
  const f=fixture(),prefix='ANIMATION_WHEEL_SEND ',send=JSON.parse(f.extra[0].slice(prefix.length));change(send);f.extra[0]=prefix+JSON.stringify(send);assert.throws(()=>continuousScrollResult(f.output(),options));
 }
 const valid=continuousScrollResult(fixture().output(),options);assert.equal(valid.pacing.length,13);assert.equal(valid.pacing[0].policy,'high-resolution-relative-start-completion-v1');
});

test('full catalog qualification requires every product section on cold and revisit, including planned',{timeout},()=>{
 const catalogs={material:['ready','planned','editor'],cupertino:['ready','planned']},fullOptions={...options,catalog:'full',catalogs};
 function fullFixture(){const f=fixture();for(const [i,p]of f.phases.entries()){
  p.catalogScope='full';if(p.name.startsWith('list-'))continue;
  Object.assign(p,{injection:'until-edge',maximumInjected:8192,requestedCount:300,received:300,appliedInputs:300,absoluteDistance:1200,netDistance:1200,delivery:{...p.delivery,queueCalls:300,lastNativeSequence:300}});
  const ids=p.name.startsWith('cupertino')?catalogs.cupertino:p.name.startsWith('material-0')?catalogs.material.slice(0,2):catalogs.material.slice(2);
  p.coverage={expectedIds:[...ids],seenIds:[...ids],reachedEdge:true,direction:p.name.endsWith('-revisit')?'reverse':'forward'};
  f.extra[i]='ANIMATION_WHEEL_SEND '+JSON.stringify({...JSON.parse(f.extra[i].slice('ANIMATION_WHEEL_SEND '.length)),mode:'os-stream',count:300,requestedMs:p.requestedIntervalMs});
 }return f;}
 const f=fullFixture();assert.doesNotThrow(()=>continuousScrollResult(f.output(),fullOptions));
 for(const change of [f=>f.phases[4].coverage.seenIds.pop(),f=>f.phases[5].coverage.seenIds.pop(),f=>f.phases[4].coverage.reachedEdge=false,f=>f.phases[4].requestedCount=8193,f=>f.phases[1].createdElements--,f=>f.phases[1].itemCreateBuildFirstLayout.n=0,f=>{for(const p of f.phases.filter(p=>p.name.startsWith('material-0')))p.coverage.expectedIds.pop(),p.coverage.seenIds.pop();}]){
  const broken=fullFixture();change(broken);assert.throws(()=>continuousScrollResult(broken.output(),fullOptions));
 }
 f.phases[6].coverage.seenIds=[];assert.doesNotThrow(()=>continuousScrollResult(f.output(),fullOptions),'Fast phase may skip painted sections while preserving delivery');
 assert.throws(()=>continuousScrollResult(f.output(),{...fullOptions,input:'queued',diagnostic:true}));
});

test('OS packet aggregation requires conserved absolute/net distance and every emitted native sequence',{timeout},()=>{
 const f=fixture(),fast=f.phases[3];fast.received--;fast.appliedInputs--;fast.delivery.queueCalls--;fast.delivery.lastNativeSequence--;
 assert.doesNotThrow(()=>continuousScrollResult(f.output(),options));
 for(const change of [p=>p.absoluteDistance-=4,p=>p.netDistance-=4,p=>p.delivery.lastNativeSequence++,p=>p.delivery.nativeSequenceRegressions++,p=>p.delivery.queueCalls++,p=>p.requestedCount--,p=>p.requestedDelta=0]){
  const before=structuredClone(fast);change(fast);assert.throws(()=>continuousScrollResult(f.output(),options));Object.assign(fast,before);
 }
 const nativeOptions={...options,nativeInstrumented:true};
 assert.throws(()=>continuousScrollResult(f.output(),nativeOptions),'Native attribution must include actual callback/delta counters');
 for(const p of f.phases)f.extra.push('ANIMATION_STAGES '+JSON.stringify({phase:p.name,stages:{'Input.wheelCallback':{n:p.received},'Input.nativeWheelAbsoluteDelta':{n:p.received,sum:p.absoluteDistance},'Input.nativeWheelNetDelta':{n:p.received,sum:p.netDistance}}}));
 assert.doesNotThrow(()=>continuousScrollResult(f.output(),nativeOptions));
 f.extra[f.extra.length-1]=f.extra.at(-1).replace('"sum":960','"sum":956');assert.throws(()=>continuousScrollResult(f.output(),nativeOptions));
});
test('native policy results require actual reuse, shared bounds and no fabricated Windows preparation',{timeout},()=>{
 function policyFixture(){const f=fixture();for(const value of f.metrics)Object.assign(value,{childPolicy:'observed-budget',childBudget:{trackedElements:20,optionalChildren:8,optionalElements:160,peakOptionalElements:160,atomicElementOverruns:0,retainedHits:2,preparedPasses:0,preparedChildren:0,preparationHits:0,preparationMisses:0,cancelledCandidates:1,automaticPreparation:'unavailable'}});return f;}
 const policyOptions={...options,childPolicy:'observed-budget'},f=policyFixture();assert.doesNotThrow(()=>continuousScrollResult(f.output(),policyOptions));assert.throws(()=>continuousScrollResult(f.output(),options),'An on result cannot masquerade as an off measurement');
 for(const change of [f=>f.metrics[0].childPolicy='legacy',f=>delete f.metrics[0].childBudget,f=>f.metrics[0].childBudget.optionalChildren=17,f=>f.metrics[0].childBudget.optionalElements=2049,f=>f.metrics[0].childBudget.preparedPasses=1,f=>f.metrics[0].childBudget.automaticPreparation='available',f=>f.metrics[2].childBudget.retainedHits=0]){const broken=policyFixture();change(broken);assert.throws(()=>continuousScrollResult(broken.output(),policyOptions));}
});

test('Static Hermes qualification requires executed native bodies and a zero-fallback audit',{timeout},()=>{
 const f=fixture(),audit={rnwPalNative:true,internalJavaScriptNative:true,nativeStarted:true,sourcePreparations:0,sourceExecutions:0,bytecodeExecutions:0,blockedFallbacks:0,jitEnabled:false,evalEnabled:false};
 const nativeOptions={...options,hermesMode:'static-aot',bindings:[{globalName:'selected'}]};
 f.extra.push('ANIMATION_JS AOT_NATIVE initialized=true','ANIMATION_JS TYPED_EXECUTION {"selected":2}');
 const output=()=>f.output()+'\nANIMATION_JS AOT_AUDIT '+JSON.stringify(audit);
 assert.doesNotThrow(()=>continuousScrollResult(output(),nativeOptions));
 for(const key of ['sourcePreparations','sourceExecutions','bytecodeExecutions','blockedFallbacks']){audit[key]=1;assert.throws(()=>continuousScrollResult(output(),nativeOptions));audit[key]=0;}
 assert.throws(()=>continuousScrollResult(output(),{...nativeOptions,bindings:[{globalName:'missing'}]}));
 f.extra[f.extra.length-1]='ANIMATION_JS TYPED_EXECUTION {"selected":0}';assert.throws(()=>continuousScrollResult(output(),nativeOptions));
});
