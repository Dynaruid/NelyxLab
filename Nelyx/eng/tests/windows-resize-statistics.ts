// SPDX-License-Identifier: BSD-3-Clause
// Shared by Node and the typed native fixture; appended without its exports.
export interface ResizeCpuEvent {
  readonly stage:number;readonly nativeTimestamp:number;readonly view:number;
  readonly surfaceGeneration:number;readonly viewportGeneration:number;
  readonly ownerGeneration:number;readonly contextGeneration:number;readonly frameSequence:number;
}
export interface ResizeTraceEvent extends ResizeCpuEvent {readonly width:number;readonly height:number}
export interface ResizeInterval {
  readonly began:number;readonly ended:number;readonly requestedHz?:number;
  readonly injected?:readonly (readonly number[])[];readonly processed?:readonly (readonly number[])[];
  readonly geometry?:readonly (readonly number[])[];readonly displayed?:readonly (readonly number[])[];
  readonly captureEnabled?:boolean;
}
export function resizeDistribution(values:readonly number[]){
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  return {n:sorted.length,p50:sorted[Math.ceil(sorted.length*.5)-1]??null,p95:sorted[Math.ceil(sorted.length*.95)-1]??null,max:sorted.at(-1)??null};
}
/** Optional fixture spans use direct native QPC samples, never JS performance.now(). */
export function resizeCpuStatistics(entries:readonly ResizeTraceEvent[],events:readonly ResizeCpuEvent[]){
  const valid=(event:ResizeCpuEvent)=>Number.isFinite(event.nativeTimestamp)&&(['view','surfaceGeneration','viewportGeneration','ownerGeneration','contextGeneration'] as const).every(key=>Number.isSafeInteger(event[key])&&event[key]>0)&&Number.isSafeInteger(event.frameSequence)&&event.frameSequence>=0;
  const samples=events.filter(valid),scope=(a:ResizeCpuEvent,b:ResizeCpuEvent)=>a.view===b.view&&a.surfaceGeneration===b.surfaceGeneration;
  const epoch=(a:ResizeCpuEvent,b:ResizeCpuEvent)=>scope(a,b)&&a.viewportGeneration===b.viewportGeneration&&a.ownerGeneration===b.ownerGeneration&&a.contextGeneration===b.contextGeneration,frame=(a:ResizeCpuEvent,b:ResizeCpuEvent)=>epoch(a,b)&&a.frameSequence===b.frameSequence;
  const spans=(start:number,end:number,observations:readonly ResizeCpuEvent[]=samples)=>{
    const pending:ResizeCpuEvent[]=[],values:number[]=[];
    for(const event of observations){if(event.stage===start)pending.push(event);else if(event.stage===end){let index=pending.length-1;while(index>=0&&!frame(pending[index],event))index--;if(index>=0){const began=pending.splice(index,1)[0];if(event.nativeTimestamp>=began.nativeTimestamp)values.push(event.nativeTimestamp-began.nativeTimestamp);}}}
    return resizeDistribution(values);
  };
  const forward=(from:readonly ResizeCpuEvent[],start:number,to:readonly ResizeCpuEvent[],end:number,match=scope)=>resizeDistribution(from.filter(event=>event.stage===start).flatMap(event=>{const next=to.find(value=>value.stage===end&&match(event,value)&&value.nativeTimestamp>=event.nativeTimestamp);return next?[next.nativeTimestamp-event.nativeTimestamp]:[];}));
  const buildEnds=samples.filter(event=>event.stage===26&&samples.some(start=>start.stage===25&&frame(start,event)&&start.nativeTimestamp<=event.nativeTimestamp));
  const firstBuilds=[...new Set(samples.filter(event=>event.stage===20).flatMap(event=>{const build=samples.find(value=>value.stage===25&&epoch(event,value)&&value.nativeTimestamp>=event.nativeTimestamp);return build?[build]:[];}))];
  const resized=samples.filter(build=>build.stage===25&&entries.some(event=>event.stage===12&&frame(build,event)&&event.nativeTimestamp>=build.nativeTimestamp)),resizeEvents=samples.filter(event=>resized.some(build=>frame(build,event)));
  return {clockDomain:'native-QPC-ms; direct host samples',events:samples.length,invalidEvents:events.length-samples.length,
    coverage:{metrics:samples.filter(event=>event.stage===20).length,newFrameRequests:samples.filter(event=>event.stage===22).length,metricsWithPendingFrame:samples.filter(event=>event.stage===23).length,builds:samples.filter(event=>event.stage===25).length,firstBuilds:firstBuilds.length,firstBuildPrepared:firstBuilds.filter(build=>resized.includes(build)).length},
    requestToCoreMetrics:forward(entries,6,samples,20),metricsToBuild:forward(samples,20,samples,25,epoch),frameRequestToBuild:forward(samples,22,samples,25,epoch),
    metricsToCopyRetired:forward(samples,20,entries,12,epoch),buildEndToNativeSubmit:forward(buildEnds,26,entries,0,frame),
    resizeFrames:{scope:'exact native prepared-copy frames; not presentation receipts',n:resized.length,build:spans(25,26,resizeEvents),layout:spans(27,28,resizeEvents),recordPaint:spans(29,30,resizeEvents),semantics:spans(31,32,resizeEvents),compose:spans(33,34,resizeEvents),capture:spans(35,36,resizeEvents),buildEndToNativeSubmit:forward(buildEnds.filter(event=>resized.some(build=>frame(build,event))),26,entries,0,frame)},
    coreMetrics:spans(20,21),build:spans(25,26),layout:spans(27,28),recordPaint:spans(29,30),semantics:spans(31,32),compose:spans(33,34),capture:spans(35,36)};
}
export function resizeStatistics(interval:ResizeInterval,entries:readonly ResizeTraceEvent[],cpuEvents:readonly ResizeCpuEvent[]=[]){
  const {began,ended}=interval,duration=ended-began;
  const same=(a:readonly number[],b:readonly number[])=>a.slice(1,5).every((v,i)=>v===b[i+1]);
  const changes=(rows:readonly (readonly number[])[])=>rows.filter((r,i)=>r[0]>began&&r[0]<ended&&(!i||!same(r,rows[i-1])));
  const frequency=(rows:readonly (readonly number[])[])=>{
    const rowsDuring=changes(rows),times=[began,...rowsDuring.map(r=>r[0]),ended];
    return {changes:rowsDuring.length,fps:rowsDuring.length*1000/duration,intervalMs:resizeDistribution(times.slice(1).map((t,i)=>t-times[i]))};
  };
  const injected=interval.injected??[],processed=interval.processed??[],geometry=interval.geometry??[];
  const latency=[];
  for(let i=0;i<processed.length;i++){
    const input=injected.find(row=>row[5]===processed[i][5]&&same(row,processed[i]));
    const actual=geometry.find(row=>row[0]>=processed[i][0]&&row[0]<(processed[i+1]?.[0]??ended)&&same(row,processed[i]));
    if(input&&actual&&actual[0]>=input[0])latency.push(actual[0]-input[0]);
  }
  const pairs=(from:number,to:number)=>entries.filter(e=>e.stage===from).flatMap(e=>{
    const end=entries.find(v=>v.stage===to&&v.surfaceGeneration===e.surfaceGeneration&&v.view===e.view&&v.nativeTimestamp>=e.nativeTimestamp);
    return end?[end.nativeTimestamp-e.nativeTimestamp]:[];
  });
  return {clockDomain:'native-QPC-ms; capture timestamps reported separately',requestedHz:interval.requestedHz,
    injected:injected.length,injectedHz:injected.length>1?(injected.length-1)*1000/(injected.at(-1)![0]-injected[0][0]):0,
    processedSizing:processed.length,processedSizingHz:processed.length*1000/duration,
    geometry:frequency(geometry),surface:frequency(entries.filter(e=>e.stage===2).map(e=>[e.nativeTimestamp,e.width,e.height,e.surfaceGeneration,0])),
    displayed:interval.captureEnabled?frequency(interval.displayed??[]):null,
    inputToGeometryMs:resizeDistribution(latency),inputLatencyScope:'matching injected tag AND proposed/actual outer rect; unmatched excluded',
    cpu:cpuEvents.length?resizeCpuStatistics(entries,cpuEvents):null,
    // The tail includes the production DwmFlush barrier and local return work.
    stagesMs:{arrange:resizeDistribution(pairs(14,15)),prepareAfterArrange:resizeDistribution(pairs(15,8)),preGeometryClock:resizeDistribution(entries.filter(e=>e.stage===13).map(e=>e.height/1000)),winuiCommit:resizeDistribution(pairs(9,16)),nativeCommitCompletion:resizeDistribution(pairs(16,17)),commitTail:resizeDistribution(pairs(17,18)),requestToAdmission:resizeDistribution(pairs(6,7)),producerAndQueue:resizeDistribution(pairs(0,1)),copyAndRetirement:resizeDistribution(pairs(1,12))}};
}
