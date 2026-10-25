// SPDX-License-Identifier: BSD-3-Clause
export const nativeMemoryLimits=Object.freeze({privateBytes:1024**3,vulkanBytes:512*1024**2,privateTailSpan:8*1024**2,privateTailGrowth:1024**2,vulkanTailSpan:1024**2,vulkanTailGrowth:64*1024,allocationTailSpan:2});

/** A bounded ListView observation, never whole-product or driver residency acceptance. */
export function verifyNativeMemoryCycles(points,workloads,{pid,mode,cycles}){
  const check=(value,message)=>{if(!value)throw Error('Native memory observation: '+message);},integer=value=>Number.isSafeInteger(value)&&value>=0;
  check(integer(pid)&&pid>0&&pid<=0xffffffff&&['bytecode','static-aot'].includes(mode)&&integer(cycles)&&cycles>=3&&cycles<=30,'invalid owned process/mode/count');
  check(Array.isArray(points)&&points.length===cycles+1&&Array.isArray(workloads)&&workloads.length===cycles,'missing or duplicate observation/workload');
  const first=points[0],metrics=['physicalWidth','physicalHeight','dpi','viewportGeneration','surfaceGeneration','focusChanges','keyboardMessages'];
  for(const [cycle,point]of points.entries()){
    check(point.schema===1&&point.scope==='process-private-commit-and-vulkan-allocations'&&point.cycle===cycle&&point.pid===pid&&point.mode===mode,'foreign or reordered observation');
    check(point.returnedToGallery===true&&point.foreground===true&&point.windowFocused===true&&point.performanceAccepted===false&&point.physicalInputAccepted==='notVerified'&&point.displayed==='unobserved','wrong route/focus/evidence scope');
    check(metrics.every(key=>integer(point[key])&&point[key]===first[key])&&['physicalWidth','physicalHeight','dpi','viewportGeneration','surfaceGeneration'].every(key=>point[key]>0),'changed viewport or desktop input boundary');
    check(['privateBytes','workingSetBytes','peakPrivateBytes','vulkanAllocationCount','vulkanAllocationBytes'].every(key=>integer(point[key])&&point[key]>0)&&point.peakPrivateBytes>=point.privateBytes,'missing actual memory counters');
    check(point.privateBytes<=nativeMemoryLimits.privateBytes&&point.peakPrivateBytes<=nativeMemoryLimits.privateBytes&&point.vulkanAllocationBytes<=nativeMemoryLimits.vulkanBytes,'memory cap exceeded');
    check(['inputReceived','inputDelivered','inputAccepted','inputRejected'].every(key=>integer(point[key]))&&point.inputDelivered===point.inputReceived&&point.inputAccepted+point.inputRejected===point.inputDelivered,'pending or inconsistent native input');
    check(['wheelReceived','wheelRawAbsolute','wheelForeign'].every(key=>integer(point[key]))&&Number.isSafeInteger(point.wheelRawNet)&&Number.isFinite(point.wheelDeliveredY)&&Number.isFinite(point.wheelDeliveredAbsoluteY),'missing native wheel volume');
    const delivered=point.wheelReceived-first.wheelReceived;
    check(point.wheelForeign===0&&point.wheelRawNet===first.wheelRawNet&&point.wheelRawAbsolute-first.wheelRawAbsolute===cycle*3840&&Math.abs(point.wheelDeliveredY-first.wheelDeliveredY)<.001&&Math.abs(point.wheelDeliveredAbsoluteY-first.wheelDeliveredAbsoluteY-cycle*1536)<.001,'changed signed/absolute native wheel volume');
    check(point.inputRejected===first.inputRejected&&point.inputReceived-first.inputReceived===delivered&&point.inputAccepted-first.inputAccepted===delivered&&delivered>=cycle*2&&delivered<=cycle*32,'missing, rejected or foreign wheel delivery');
    if(cycle)check(point.wheelReceived-points[cycle-1].wheelReceived>=2&&point.wheelReceived-points[cycle-1].wheelReceived<=32,'invalid coalesced native wheel count');
    if(cycle){const work=workloads[cycle-1];check(work.cycle===cycle&&work.pid===pid&&['cold','revisit','last','first','returnedToGallery'].every(key=>work[key]===true)&&work.wheelPackets===32&&work.wheelRawNet===0&&work.wheelRawAbsolute===3840,'incomplete actual product workload');}
  }
  const tail=points.slice(-3),last=tail[2],band=(key,span,growth)=>{const values=tail.map(point=>point[key]),min=Math.min(...values),max=Math.max(...values);check(max-min<=span&&last[key]-tail[0][key]<=growth,'no bounded '+key+' tail');return {min,max,span:max-min,growth:last[key]-tail[0][key],last:last[key]};};
  const privateCommit=band('privateBytes',nativeMemoryLimits.privateTailSpan,nativeMemoryLimits.privateTailGrowth),vulkanAllocations=band('vulkanAllocationBytes',nativeMemoryLimits.vulkanTailSpan,nativeMemoryLimits.vulkanTailGrowth),vulkanCount=band('vulkanAllocationCount',nativeMemoryLimits.allocationTailSpan,0);
  return {scope:'owned process private commit and Vulkan allocator/import ownership after actual ListView routes',cycles,stableTail:3,wheelPackets:cycles*32,privateCommit,vulkanAllocations,vulkanCount,limits:nativeMemoryLimits,privateProcessMemory:'PASS-scoped',vulkanAllocatorMemory:'PASS-scoped',gpuDriverResidency:'notVerified',wholeH4Accepted:false,performanceAccepted:false,physicalInputAccepted:'notVerified',displayed:'unobserved'};
}

/** Validate cause data, without equating address-space types to PrivateUsage. */
export function verifyNativeMemoryRegions(records,{pid,cycles}){
  const check=(value,message)=>{if(!value)throw Error('Native address-space observation: '+message);},integer=value=>Number.isSafeInteger(value)&&value>=0;
  check(integer(pid)&&pid>0&&pid<=0xffffffff&&integer(cycles)&&cycles>=3&&cycles<=30,'invalid owner/count');
  check(Array.isArray(records)&&records.length===cycles+1,'missing or duplicate scan');
  const fields=['scanMs','queries','allocationBases','privateCommittedBytes','privateReservedBytes','imageCommittedBytes','mappedCommittedBytes','otherCommittedBytes','privateBeforeBytes','privateAfterBytes','newBases','missingBases','grownBases','shrunkBases','newBaseCommittedBytes','missingBaseCommittedBytes','sameBaseAddedBytes','sameBaseReleasedBytes'];
  for(const [cycle,row]of records.entries()){
    check(row.schema===1&&row.scope==='external-non-atomic-address-space'&&row.pid===pid&&row.cycle===cycle&&row.complete===true&&row.atomic===false&&row.copyOnWritePrivatePages==='notClassified'&&row.allocationOwner==='unknown','wrong owner/order/scope');
    check(fields.every(key=>integer(row[key]))&&row.scanMs<=2000&&row.queries>0&&row.queries<=65536&&row.allocationBases>0&&row.allocationBases<=row.queries&&row.privateCommittedBytes>0&&row.privateBeforeBytes>0&&row.privateAfterBytes>0,'invalid scan counters or bounds');
    if(!cycle)check(['newBases','missingBases','grownBases','shrunkBases','newBaseCommittedBytes','missingBaseCommittedBytes','sameBaseAddedBytes','sameBaseReleasedBytes'].every(key=>row[key]===0),'baseline reports a preceding allocation');
    else{const previous=records[cycle-1];check(row.allocationBases-previous.allocationBases===row.newBases-row.missingBases&&row.missingBases<=previous.allocationBases&&row.newBases+row.grownBases+row.shrunkBases<=row.allocationBases,'inconsistent allocation-base counts');check(row.privateCommittedBytes-previous.privateCommittedBytes===row.newBaseCommittedBytes-row.missingBaseCommittedBytes+row.sameBaseAddedBytes-row.sameBaseReleasedBytes,'lost committed-byte changes');}
    check(Array.isArray(row.largest)&&row.largest.length<=6&&row.largest.length<=row.newBases+row.missingBases+row.grownBases+row.shrunkBases,'unbounded changed-region details');
    const volume=row.newBaseCommittedBytes+row.missingBaseCommittedBytes+row.sameBaseAddedBytes+row.sameBaseReleasedBytes;check(!volume===!row.largest.length,'missing or invented changed-region detail');
    let magnitude=Infinity;for(const entry of row.largest){const delta=entry.committedDelta,size=Math.abs(delta);check(Number.isSafeInteger(delta)&&delta!==0&&size<=magnitude&&integer(entry.committedBytes)&&integer(entry.reservedBytes)&&integer(entry.allocationProtect)&&entry.allocationProtect<=0xffffffff&&typeof entry.sameBase==='boolean','invalid changed-region detail');magnitude=size;
      const counter=entry.sameBase?(delta>0?'sameBaseAddedBytes':'sameBaseReleasedBytes'):(delta>0?'newBaseCommittedBytes':'missingBaseCommittedBytes');check(size<=row[counter]&&(entry.sameBase||size===entry.committedBytes)&&(delta<0||size<=entry.committedBytes),'changed-region detail exceeds its aggregate');
    }
  }
  return {scope:'external non-atomic address-space cause data',observations:records.length,privateUsageEquivalent:false,allocationStacks:'unobserved',allocationLifetime:'unproven',wholeH4Accepted:false,performanceAccepted:false};
}
