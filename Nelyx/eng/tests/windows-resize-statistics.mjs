// SPDX-License-Identifier: BSD-3-Clause
export function resizeDistribution(values){
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);
  return {n:sorted.length,p50:sorted[Math.ceil(sorted.length*.5)-1]??null,p95:sorted[Math.ceil(sorted.length*.95)-1]??null,max:sorted.at(-1)??null};
}
export function resizeStatistics(interval,entries){
  const {began,ended}=interval,duration=ended-began;
  const same=(a,b)=>a.slice(1,5).every((v,i)=>v===b[i+1]);
  const changes=rows=>rows.filter((r,i)=>r[0]>began&&r[0]<ended&&(!i||!same(r,rows[i-1])));
  const frequency=rows=>{
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
  const pairs=(from,to)=>entries.filter(e=>e.stage===from).flatMap(e=>{
    const end=entries.find(v=>v.stage===to&&v.surfaceGeneration===e.surfaceGeneration&&v.view===e.view&&v.nativeTimestamp>=e.nativeTimestamp);
    return end?[end.nativeTimestamp-e.nativeTimestamp]:[];
  });
  return {clockDomain:'native-QPC-ms; capture timestamps reported separately',requestedHz:interval.requestedHz,
    injected:injected.length,injectedHz:injected.length>1?(injected.length-1)*1000/(injected.at(-1)[0]-injected[0][0]):0,
    processedSizing:processed.length,processedSizingHz:processed.length*1000/duration,
    geometry:frequency(geometry),surface:frequency(entries.filter(e=>e.stage===2).map(e=>[e.nativeTimestamp,e.width,e.height,e.surfaceGeneration,0])),
    displayed:interval.captureEnabled?frequency(interval.displayed??[]):null,
    inputToGeometryMs:resizeDistribution(latency),inputLatencyScope:'matching injected tag AND proposed/actual outer rect; unmatched excluded',
    // The tail includes the production DwmFlush barrier and local return work.
    stagesMs:{arrange:resizeDistribution(pairs(14,15)),prepareAfterArrange:resizeDistribution(pairs(15,8)),preGeometryClock:resizeDistribution(entries.filter(e=>e.stage===13).map(e=>e.height/1000)),winuiCommit:resizeDistribution(pairs(9,16)),nativeCommitCompletion:resizeDistribution(pairs(16,17)),commitTail:resizeDistribution(pairs(17,18)),requestToAdmission:resizeDistribution(pairs(6,7)),producerAndQueue:resizeDistribution(pairs(0,1)),copyAndRetirement:resizeDistribution(pairs(1,12))}};
}
