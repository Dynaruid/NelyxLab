// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';

/** Consume stdout in memory; no benchmark log/receipt files are required.
 * A failed attempt stays visible even when later repetitions qualify. */
export function qualifiedScrollRuns(outputs){
 const runs=[],failures=[];
 for(const output of outputs){
  const records=prefix=>output.split('\n').filter(line=>line.startsWith(prefix)).map(line=>JSON.parse(line.slice(prefix.length)));
  const qualified=records('SCROLL_QUALIFIED '),attempts=records('SCROLL_RUN '),aot=records('ANIMATION_STATIC_HERMES ');
  const failed=records('SCROLL_FAILURE '),aborts=records('SCROLL_ABORT ');
  failures.push(...(failed.length?failed.map(value=>({...value,abort:aborts[0]?.error})):aborts));
  for(const run of attempts){
   if(run.diagnostic)continue;
   const matches=qualified.filter(value=>!value.diagnostic&&value.variant===run.variant&&value.viewport===run.viewport&&value.run===run.run);
   assert(matches.length<=1,'Duplicate qualification');
   if(run.status===0&&matches.length===1){
    assert.equal(run.input,'os');assert.equal(run.catalog,'full');
    if(run.variant==='static-aot'){const metadata=aot.find(value=>value.librarySha256===run.identity.aotSha256);assert(metadata,'Missing exact AOT compiler identity');const {toolchainSha256,revision,compilerPolicy,compilerFlags}=metadata;run.aotCompiler={toolchainSha256,revision,compilerPolicy,compilerFlags};}
    runs.push(run);
   }
  }
 }
 return {runs,failures};
}
const median=values=>{assert.equal(values.length,3,'Exactly three qualified repetitions per condition are required');assert(values.every(Number.isFinite));return values.slice().sort((a,b)=>a-b)[1];};
/** G6 compares unchanged product work with retention/preparation disabled.
 * Caller supplies the recorded source hashes, not inferred bundle equality. */
export function compareScrollEngine(before,after,{sourcesBefore,sourcesAfter}){
 assert.deepEqual(sourcesAfter,sourcesBefore,'G6 requires unchanged row/gallery sources');assert(Object.keys(sourcesBefore).length>=6,'Full workload source identity is required');
 const conditions=[];
 for(const variant of ['hermes','static-aot'])for(const viewport of ['default','maximized']){
  const select=data=>data.runs.filter(value=>value.variant===variant&&value.viewport===viewport),a=select(before),b=select(after);
  assert.equal(a.length,3);assert.equal(b.length,3);
  const identity=a[0].identity;for(const run of [...a,...b]){
   assert.equal(run.status,0);assert.equal(run.diagnostic,false);assert.equal(run.catalog,'full');assert.equal(run.input,'os');
   assert.equal(run.childPolicy??'legacy','legacy','G6 requires retention/preparation disabled');
   assert.equal(run.identity.engine,'hermes');assert.equal(run.identity.mode,variant==='hermes'?'bytecode':'static-aot');assert.equal(run.identity.profile,'optimized');assert.equal(run.identity.configuration,'Release');
   assert(identity.vmSha256);assert.equal(run.identity.vmSha256,identity.vmSha256,'VM supply changed');
   if(variant==='hermes'){assert(identity.compilerSha256);assert.equal(run.identity.compilerSha256,identity.compilerSha256,'Bytecode compiler changed');}
   else{assert(a[0].aotCompiler?.toolchainSha256);assert.deepEqual(run.aotCompiler,a[0].aotCompiler,'AOT compiler/policy changed');}
   assert.deepEqual(run.phases.map(value=>value.name),a[0].phases.map(value=>value.name),'Workload phases changed');
   for(let i=0;i<run.phases.length;i++){
    const phase=run.phases[i],reference=a[0].phases[i];
    assert(Number.isFinite(reference.viewport)&&reference.viewport>0,'Actual workload viewport is required');
    assert.equal(phase.viewport,reference.viewport,'Actual workload viewport changed');
    assert.equal(phase.requestedDelta,reference.requestedDelta,'Injected wheel delta changed');
    assert.equal(phase.requestedIntervalMs,reference.requestedIntervalMs,'Injected wheel pacing changed');
   }
  }
  const stats=(values,name,metric)=>median(values.map(run=>{const p=run.phases.find(value=>value.name===name);assert(p);return p[metric].p95;}));
  for(const values of [a,b])for(const run of values){const p=run.phases.find(value=>value.name==='list-cold');assert(p.createdRows>0&&p.createdRows===p.itemCreateBuildFirstLayout.n&&p.createdElements===p.mounts);}
  for(let i=0;i<a[0].phases.length;i++)if(!a[0].phases[i].name.startsWith('list-'))for(const run of [...a,...b])assert.deepEqual(run.phases[i].coverage?.expectedIds,a[0].phases[i].coverage?.expectedIds,'Gallery membership changed');
  const check=(name,metric,maximumRatio)=>{const baseline=stats(a,name,metric),candidate=stats(b,name,metric);assert(baseline>0);return {phase:name,metric,baseline,candidate,ratio:candidate/baseline,accepted:candidate/baseline<=maximumRatio};};
  const checks=[check('list-cold','cpu',.8),check('list-cold','itemCreateBuildFirstLayout',.8),check('list-retained','cpu',1.1),...a[0].phases.filter(p=>!p.name.startsWith('list-')).flatMap(p=>['entryCpu','retainedCpu'].filter(metric=>p[metric]?.n>0).map(metric=>check(p.name,metric,1.1)))];
  conditions.push({variant,viewport,checks,accepted:checks.every(value=>value.accepted)});
 }
 assert.equal(before.runs.length,12);assert.equal(after.runs.length,12);
 return {scope:'G6; median of three per-run p95 values, not pooled percentiles',conditions,g6Accepted:conditions.every(value=>value.accepted),failedAttempts:{before:before.failures.length,after:after.failures.length},engineAccepted:'notVerified',physicalInputAccepted:'notVerified'};
}
