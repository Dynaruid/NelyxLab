// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';

/** Validate delivered work before treating native timings as samples. Surface
 * completion deliberately does not imply display or physical input evidence. */
export function continuousScrollResult(output,{engine,hermesMode,diagnostic,nativeInstrumented=false,input='os',bindings=[],catalog='bounded',catalogs,childPolicy='legacy'}){
 assert(['legacy','bounded','observed-budget'].includes(childPolicy));
 assert(input==='os'||input==='queued'&&diagnostic,'SDK queue diagnostics cannot qualify OS performance');
 assert(['full','bounded'].includes(catalog)&&!(catalog==='full'&&input==='queued'));
 assert.doesNotMatch(output,/ANIMATION_JS ERROR|ANIMATION_REACT_ERROR|watchdog/);
 for(const marker of ['continuous-scroll PASS','closed views=0 consumers=0 gpuDrained=1 inputRetired=1'])assert(output.includes(marker),'Missing '+marker);
 const records=prefix=>output.split('\n').filter(line=>line.startsWith(prefix)).map(line=>JSON.parse(line.slice(prefix.length)));
 const phases=records('ANIMATION_JS CONTINUOUS ');
 // Keep the opening brace and phase key when parsing the metrics stream.
 const samples=output.split('\n').filter(line=>line.startsWith('ANIMATION_JS {"phase"')).map(line=>JSON.parse(line.slice('ANIMATION_JS '.length)));
 const names=['list-retained','list-cold','list-revisit','list-fast',...['material-0',...(phases.some(value=>value.name.startsWith('material-1-'))?['material-1']:[]),'cupertino-0'].flatMap(name=>['cold','revisit','fast'].map(phase=>name+'-'+phase))];
 assert.deepEqual(phases.map(value=>value.name),names,'Missing, duplicate or reordered continuous phase');
 assert.deepEqual(samples.map(value=>value.phase),names,'Missing runtime phase metrics');
 const sends=records('ANIMATION_WHEEL_SEND '),native=records('ANIMATION_STAGES ');
 assert.equal(sends.length,phases.length,'Missing injection accounting');
 const distribution=(value,required=true)=>{assert(Number.isSafeInteger(value?.n)&&value.n>=(required?1:0));if(value.n){assert(['sum','p50','p95','p99','max'].every(key=>Number.isFinite(value[key])&&value[key]>=0));assert(value.p50<=value.p95&&value.p95<=value.p99&&value.p99<=value.max);}};
 for(let i=0;i<phases.length;i++){
  const phase=phases[i],sample=samples[i],retained=phase.name==='list-retained';
  assert.equal(sample.engine,engine,'Actual VM differs from selected engine');assert.equal(sample.mode,'research-engine');
  assert.equal(sample.trace,diagnostic);assert.equal(sample.diagnostic,diagnostic);assert.equal(sample.semanticsUpdateInterval,50);
  assert.equal(sample.childPolicy??'legacy',childPolicy,'Runtime child policy differs from its result label');
  if(childPolicy==='legacy')assert(sample.childBudget==null,'G6 legacy workload unexpectedly enabled a bounded owner');
  else{
   const budget=sample.childBudget;assert(budget&&budget.trackedElements>0,'Policy experiment did not reach an actual bounded owner');
   for(const key of ['optionalChildren','optionalElements','peakOptionalElements','atomicElementOverruns','retainedHits','preparedPasses','preparedChildren','preparationHits','preparationMisses','cancelledCandidates'])assert(Number.isSafeInteger(budget[key])&&budget[key]>=0);
   assert(budget.optionalChildren<=16&&budget.optionalElements<=2048&&budget.peakOptionalElements>=budget.optionalElements);
   assert(budget.peakOptionalElements<=2048||budget.atomicElementOverruns>0,'Unreported atomic Element overrun');
   assert.equal(budget.automaticPreparation,'unavailable','This Windows host advertises no observed deadline');assert.equal(budget.preparedPasses,0,'Unsupported Windows clock started preparation');
  }
  const full=catalog==='full'&&!phase.name.startsWith('list-'),requested=full?phase.requestedCount:retained?48:240;
  assert.equal(phase.catalogScope,catalog);assert.equal(phase.injection,full?'until-edge':'fixed');assert.equal(phase.maximumInjected,full?8192:requested);
  assert(Number.isSafeInteger(requested)&&requested>0&&requested<=phase.maximumInjected);assert.equal(phase.requestedCount,requested);assert(Number.isSafeInteger(phase.requestedDelta)&&phase.requestedDelta!==0&&Math.abs(phase.requestedDelta)<=120);
  assert(Number.isSafeInteger(phase.received)&&phase.received>0&&phase.received<=requested);if(input==='queued')assert.equal(phase.received,requested);
  assert.equal(phase.appliedInputs+phase.unchangedInputs,phase.received);
  assert(Math.abs(phase.absoluteDistance-requested*Math.abs(phase.requestedDelta)*.4)<.001,'Wheel distance was lost or duplicated');
  assert(Math.abs(phase.netDistance-(retained?0:-requested*phase.requestedDelta*.4))<.001,'Wheel direction or reversal changed');
  const delivery=phase.delivery;assert.equal(delivery?.queueCalls,phase.received);assert.equal(delivery.nativeSequenceRegressions,0);
  assert(Number.isSafeInteger(delivery.queueHighWater)&&delivery.queueHighWater>=0&&delivery.queueHighWater<=256);
  if(input==='os'){
   assert(Number.isSafeInteger(delivery.firstNativeSequence)&&delivery.firstNativeSequence>0&&Number.isSafeInteger(delivery.lastNativeSequence));
   assert.equal(delivery.lastNativeSequence-delivery.firstNativeSequence+1,phase.received,'An emitted native packet is missing');
  }
  assert.equal(sends[i].count,requested);assert.equal(sends[i].requestedMs,phase.requestedIntervalMs);assert.equal(sends[i].mode,input==='queued'?'queued':full?'os-stream':retained?'os-sweep':'os');
  assert.equal(sends[i].policy,'high-resolution-relative-start-completion-v1','Old or unknown wheel pacing cannot qualify');
  assert(['p50Ms','p95Ms','maxMs'].every(key=>Number.isFinite(sends[i][key])&&sends[i][key]>0),'Missing actual wheel completion intervals');
  assert(sends[i].p50Ms<=sends[i].p95Ms&&sends[i].p95Ms<=sends[i].maxMs,'Wheel interval quantiles are inconsistent');
  if(nativeInstrumented&&input==='os'){
   const stages=native.find(value=>value.phase===phase.name)?.stages;assert(stages,'Missing native ingress counters');
   assert.equal(stages['Input.wheelCallback']?.n,phase.received);
   assert.equal(stages['Input.nativeWheelAbsoluteDelta']?.n,phase.received);
   assert(Math.abs(stages['Input.nativeWheelAbsoluteDelta'].sum-phase.absoluteDistance)<.001);
   assert(Math.abs(stages['Input.nativeWheelNetDelta']?.sum-phase.netDistance)<.001);
   assert(!stages['Input.wheelStateRejected']&&!stages['Input.wheelGeometryRejected'],'Native ingress rejected an injected event');
  }
  assert(Number.isSafeInteger(phase.appliedInputs)&&phase.appliedInputs>=0&&Number.isSafeInteger(phase.unchangedInputs)&&phase.unchangedInputs>=0);
  assert.equal(phase.requestedIntervalMs,phase.name.endsWith('-fast')?4:16);
  for(const value of [phase.cpu,phase.entryCpu,phase.retainedCpu])distribution(value,value===phase.cpu);
  for(const value of [phase.oldestInputToSurface,phase.latestInputToSurface]){distribution(value,phase.appliedInputs>0);assert(value.n<=phase.appliedInputs);}
  assert(Number.isFinite(phase.viewport)&&phase.viewport>0&&Number.isFinite(phase.elapsedMs)&&phase.elapsedMs>0);
  assert(Number.isSafeInteger(phase.mounts)&&phase.mounts>=0&&Number.isSafeInteger(phase.unmounts)&&phase.unmounts>=0);
  if(retained){assert.equal(phase.mounts,0);assert.equal(phase.unmounts,0);}
  distribution(phase.itemCreateBuildFirstLayout,phase.name==='list-cold');
  assert(Number.isSafeInteger(phase.createdRows)&&phase.createdRows===phase.itemCreateBuildFirstLayout.n);assert(Number.isSafeInteger(phase.createdElements)&&phase.createdElements>=0);
  if(phase.name==='list-cold'){assert(phase.mounts>0&&phase.entryCpu.n>0);assert(phase.maximum-phase.minimum+.01>=5*phase.viewport);assert.equal(phase.createdElements,phase.mounts,'Per-item timing missed created Elements');assert(phase.createdRows>=phase.entryCpu.n);}
  if(full){
   const coverage=phase.coverage;assert(coverage?.reachedEdge,'Full catalog did not reach its edge');assert.equal(coverage.direction,phase.name.endsWith('-revisit')?'reverse':'forward');
   assert(Array.isArray(coverage.expectedIds)&&coverage.expectedIds.length>0&&new Set(coverage.expectedIds).size===coverage.expectedIds.length);assert(Array.isArray(coverage.seenIds)&&new Set(coverage.seenIds).size===coverage.seenIds.length);assert(coverage.seenIds.every(id=>coverage.expectedIds.includes(id)));
   const cold=phases.find(value=>value.name===phase.name.replace(/-(cold|revisit|fast)$/,'-cold'));assert.deepEqual(coverage.expectedIds,cold.coverage.expectedIds,'Catalog membership changed between phases');
   if(!phase.name.endsWith('-fast'))assert.deepEqual([...coverage.seenIds].sort(),[...coverage.expectedIds].sort(),'Catalog sections were never visible');
  }
  assert.equal(phase.displayed,'unobserved');assert.equal(phase.physicalTrackpad,'notVerified');
 }
 if(childPolicy!=='legacy')assert(samples.find(value=>value.phase==='list-revisit').childBudget.retainedHits>0,'The native policy experiment never reused a retained row');
 if(catalog==='full')for(const name of ['material','cupertino']){
  assert(Array.isArray(catalogs?.[name])&&catalogs[name].length>0,'Expected product catalog required');
  const ids=phases.filter(value=>value.name.startsWith(name+'-')&&value.name.endsWith('-cold')).flatMap(value=>value.coverage.expectedIds);assert.deepEqual(ids.sort(),[...catalogs[name]].sort(),'Missing or duplicate product sections, including planned');
 }
 if(hermesMode==='static-aot'){
  assert(output.includes('AOT_NATIVE initialized=true'));
  const [audit]=records('ANIMATION_JS AOT_AUDIT ');assert(audit,'Missing native fallback audit');
  assert(audit.rnwPalNative&&audit.internalJavaScriptNative&&audit.nativeStarted&&!audit.sourcePreparations&&!audit.sourceExecutions&&!audit.bytecodeExecutions&&!audit.blockedFallbacks&&!audit.jitEnabled&&!audit.evalEnabled);
  const [calls]=records('ANIMATION_JS TYPED_EXECUTION ');assert(calls,'Missing actual specialized body counters');
  for(const {globalName}of bindings)assert(Number.isSafeInteger(calls[globalName])&&calls[globalName]>=0);
  assert(bindings.length>0&&bindings.some(({globalName})=>calls[globalName]>0),'No selected product body executed');
 }
 const [memory]=records('ANIMATION_MEMORY ');assert(memory&&['workingSetBytes','peakWorkingSetBytes','privateBytes'].every(key=>Number.isSafeInteger(memory[key])&&memory[key]>0),'Missing native process memory');
 return {phases,metrics:samples,pacing:sends,memory};
}
