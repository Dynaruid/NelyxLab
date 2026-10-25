// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {verifyNativeMemoryCycles,verifyNativeMemoryRegions} from './native-memory-results.mjs';
import {nativeMemoryOptions} from '../run-native-memory.mjs';
const timeout=1_200_000,options={pid:19,mode:'bytecode',cycles:6},MiB=1024**2;
function fixture(){
  const points=Array.from({length:7},(_,cycle)=>({schema:1,scope:'process-private-commit-and-vulkan-allocations',cycle,pid:19,mode:'bytecode',returnedToGallery:true,foreground:true,windowFocused:true,performanceAccepted:false,physicalInputAccepted:'notVerified',displayed:'unobserved',physicalWidth:974,physicalHeight:929,dpi:192,viewportGeneration:1,surfaceGeneration:2,focusChanges:2,keyboardMessages:0,privateBytes:(cycle?140:100)*MiB,workingSetBytes:160*MiB,peakPrivateBytes:180*MiB,vulkanAllocationCount:cycle?32:20,vulkanAllocationBytes:(cycle?64:32)*MiB,inputReceived:2+cycle*32,inputDelivered:2+cycle*32,inputAccepted:2+cycle*32,inputRejected:0,wheelReceived:cycle*32,wheelRawNet:0,wheelRawAbsolute:cycle*3840,wheelForeign:0,wheelDeliveredY:0,wheelDeliveredAbsoluteY:cycle*1536}));
  const workloads=Array.from({length:6},(_,index)=>({cycle:index+1,pid:19,cold:true,revisit:true,last:true,first:true,returnedToGallery:true,wheelPackets:32,wheelRawNet:0,wheelRawAbsolute:3840}));return {points,workloads};
}
test('native memory observation binds actual route/input receipts without claiming memory or driver acceptance',{timeout},()=>{
  const {points,workloads}=fixture(),result=verifyNativeMemoryCycles(points,workloads,options);assert.equal(result.assessment,'observation-only');assert.equal(result.privateProcessMemory,'observed');assert.equal(result.vulkanAllocations.tail.span,0);assert.equal(result.resourceOwnership,'notVerified');assert.equal(result.gpuDriverResidency,'notVerified');assert.equal(result.memoryAccepted,false);assert.equal(result.wholeH4Accepted,false);assert.equal(result.performanceAccepted,false);
  assert.deepEqual(result.privateCommit.values,points.map(point=>point.privateBytes));assert.equal(result.peakPrivateBytes,180*MiB);assert.equal(result.privateCommit.growth,40*MiB);assert.equal(result.privateCommit.tail.growth,0);assert(!('stableTail'in result));assert(!('limits'in result));
  points[4].privateBytes+=MiB;points[6].privateBytes+=MiB/2;assert.doesNotThrow(()=>verifyNativeMemoryCycles(points,workloads,options));
  for(const point of points){point.wheelReceived=point.cycle*16;point.inputReceived=point.inputDelivered=point.inputAccepted=2+point.cycle*16;}assert.doesNotThrow(()=>verifyNativeMemoryCycles(points,workloads,options),'Coalesced packets retain the complete signed/absolute native amount');
});
test('native memory rejects missing owners, incomplete workload, desktop intrusion and deferred or lost input',{timeout},()=>{
  const mutations=[(p,w)=>p.pop(),(p,w)=>w.pop(),p=>p[2].cycle=1,p=>p[2].pid=20,p=>p[2].mode='static-aot',p=>p[2].scope='counter-estimate',p=>p[2].returnedToGallery=false,p=>p[2].windowFocused=false,p=>p[2].physicalWidth++,p=>p[2].viewportGeneration++,p=>p[2].keyboardMessages++,p=>p[2].focusChanges++,p=>p[2].privateBytes=NaN,p=>p[2].vulkanAllocationBytes=-1,p=>p[2].inputDelivered--,p=>p[2].inputReceived++,p=>{p[2].inputAccepted--;p[2].inputRejected++;},(p,w)=>w[2].cold=false,(p,w)=>w[2].revisit=false,(p,w)=>w[2].last=false,(p,w)=>w[2].wheelRawNet=120,(p,w)=>w[2].wheelRawAbsolute=0,p=>p[2].performanceAccepted=true,p=>p[2].displayed='accepted',p=>p[2].wheelRawNet=120,p=>p[2].wheelRawAbsolute--,p=>p[2].wheelForeign++,p=>p[2].wheelDeliveredY=48,p=>p[2].wheelDeliveredAbsoluteY--,p=>p[2].wheelReceived--];
  for(const mutate of mutations){const {points,workloads}=fixture();mutate(points,workloads);assert.throws(()=>verifyNativeMemoryCycles(points,workloads,options));}
});
test('native memory totals and continued growth remain visible without arbitrary caps or a false plateau verdict',{timeout},()=>{
  const {points,workloads}=fixture();
  for(const point of points){point.privateBytes=2*1024*MiB+point.cycle*16*MiB;point.peakPrivateBytes=point.privateBytes+MiB;point.vulkanAllocationBytes=768*MiB+point.cycle*2*MiB;point.vulkanAllocationCount=100+point.cycle*3;}
  const result=verifyNativeMemoryCycles(points,workloads,options);
  assert.equal(result.privateCommit.last,2144*MiB);assert.equal(result.privateCommit.growth,96*MiB);assert.equal(result.privateCommit.tail.growth,32*MiB);assert.equal(result.privateCommit.tail.span,32*MiB);assert.equal(result.peakPrivateBytes,2145*MiB);
  assert.equal(result.vulkanAllocations.last,780*MiB);assert.equal(result.vulkanAllocations.tail.growth,4*MiB);assert.equal(result.vulkanCount.tail.growth,6);assert.equal(result.memoryAccepted,false);assert.equal(result.resourceOwnership,'notVerified');
  for(const point of points){point.vulkanAllocationBytes=0;point.vulkanAllocationCount=0;}
  assert.equal(verifyNativeMemoryCycles(points,workloads,options).vulkanCount.last,0,'A released allocator can legitimately report zero');
});
test('native memory commands bound all modes/windows before opening a product',{timeout},()=>{
  assert.deepEqual(nativeMemoryOptions(['--hermes-mode','both','--viewport','both','--cycles','6']),{mode:'both',viewport:'both',cycles:6});
  for(const args of [['--cycles','31'],['--cycles','2'],['--cycles','3.5'],['--cycles','3','--cycles','4'],['--viewport','unknown'],['--hermes-mode','both','--viewport','both','--cycles','8'],['--unknown','1']])assert.throws(()=>nativeMemoryOptions(args));
});
function regionsFixture(){return Array.from({length:7},(_,cycle)=>({schema:1,scope:'external-non-atomic-address-space',cycle,pid:19,complete:true,atomic:false,copyOnWritePrivatePages:'notClassified',allocationOwner:'unknown',scanMs:12,queries:100,allocationBases:4,privateCommittedBytes:100*MiB+cycle*MiB/4,privateReservedBytes:32*MiB,imageCommittedBytes:64*MiB,mappedCommittedBytes:16*MiB,otherCommittedBytes:0,privateBeforeBytes:120*MiB,privateAfterBytes:121*MiB,newBases:0,missingBases:0,grownBases:cycle?1:0,shrunkBases:0,newBaseCommittedBytes:0,missingBaseCommittedBytes:0,sameBaseAddedBytes:cycle?MiB/4:0,sameBaseReleasedBytes:0,largest:cycle?[{committedDelta:MiB/4,committedBytes:MiB+cycle*MiB/4,reservedBytes:8*MiB,allocationProtect:4,sameBase:true}]:[]}));}
test('external region cause data preserves base changes without becoming private commit, stack or lifetime acceptance',{timeout},()=>{
  const rows=regionsFixture(),result=verifyNativeMemoryRegions(rows,options);assert.equal(result.privateUsageEquivalent,false);assert.equal(result.allocationStacks,'unobserved');assert.equal(result.allocationLifetime,'unproven');assert.equal(result.wholeH4Accepted,false);assert.equal(result.performanceAccepted,false);
  const row=rows[3];row.newBases=1;row.missingBases=1;row.newBaseCommittedBytes=2*MiB;row.missingBaseCommittedBytes=MiB;row.sameBaseAddedBytes=0;row.sameBaseReleasedBytes=3*MiB/4;row.grownBases=0;row.shrunkBases=1;row.largest=[{committedDelta:2*MiB,committedBytes:2*MiB,reservedBytes:0,allocationProtect:4,sameBase:false},{committedDelta:-MiB,committedBytes:MiB,reservedBytes:0,allocationProtect:4,sameBase:false},{committedDelta:-3*MiB/4,committedBytes:MiB,reservedBytes:MiB,allocationProtect:4,sameBase:true}];assert.doesNotThrow(()=>verifyNativeMemoryRegions(rows,options));
});
test('external region cause data rejects incomplete, foreign, atomic and unconserved address-space summaries',{timeout},()=>{
  for(const mutate of [r=>r.pop(),r=>r[2].pid++,r=>r[2].cycle=1,r=>r[2].atomic=true,r=>r[2].complete=false,r=>r[2].copyOnWritePrivatePages='included',r=>r[2].allocationOwner='identified',r=>r[2].scanMs=2001,r=>r[2].queries=65537,r=>r[2].allocationBases++,r=>r[2].newBaseCommittedBytes++,r=>r[0].sameBaseAddedBytes=1,r=>r[2].largest=[],r=>r[2].largest[0].committedDelta++,r=>r[2].largest[0].committedBytes=1,r=>r[2].largest[0].allocationProtect=-1,r=>r[2].privateBeforeBytes=0]){const rows=regionsFixture();mutate(rows);assert.throws(()=>verifyNativeMemoryRegions(rows,options));}
});
test('delivered native memory observers reject unobserved desktop-input counters before creating a window',{timeout,skip:process.platform!=='win32'||process.env.NELYX_NATIVE_PACKAGES!=='1'},()=>{
  for(const mode of ['bytecode','static-aot']){const directory=path.resolve('sample/nelyx-testbed-app-2/.nelyx/native-windows/current-'+mode),manifest=JSON.parse(fs.readFileSync(path.join(directory,'native-package.json'),'utf8'));
    const result=spawnSync(path.join(directory,'NelyxHermesHost.exe'),[path.join(directory,manifest.bundle),path.join(directory,'Assets'),mode,'1000','1000','1000'],{cwd:directory,encoding:'utf8',windowsHide:true,timeout,env:{...process.env,NELYX_NATIVE_MEMORY_PROBE:'1',NELYX_NATIVE_FRAME_TRACE:'0',NELYX_NATIVE_GC_STATS:'0',NELYX_NATIVE_CPU_PROFILE:'0'}}),output=(result.stdout??'')+(result.stderr??'');
    assert.equal(result.error,undefined);assert.equal(result.status,1,output);assert.match(output,/Native memory observation requires NELYX_NATIVE_FRAME_TRACE=1/);assert(!output.includes('NELYX_NATIVE_FIRST_FRAME '));assert(!output.includes('NELYX_NATIVE_MEMORY {'));
  }
});
