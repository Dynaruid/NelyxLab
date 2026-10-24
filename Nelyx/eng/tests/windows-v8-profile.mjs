// SPDX-License-Identifier: BSD-3-Clause
// Test-only VM sampling. The one execution-owned log is removed by the caller.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';

export function selectV8Phase(log,phase){
  const lines=log.split(/\r?\n/),marker=boundary=>'nelyxProfilePhaseMarker_'+phase.replaceAll('-','_')+'_'+boundary;
  const timestamp=boundary=>{
    const matches=lines.filter(line=>line.startsWith('code-creation,')&&line.includes(marker(boundary)));
    assert.equal(matches.length,1,'Expected one compiled V8 phase marker: '+marker(boundary)+' found='+matches.length);
    const value=Number(matches[0].split(',')[3]);assert(Number.isFinite(value)&&value>0);return value;
  };
  const beginUs=timestamp('begin'),endUs=timestamp('end');assert(endUs>beginUs,'V8 phase timestamps must increase');
  const times=[];const selected=lines.filter(line=>{if(!line.startsWith('tick,'))return true;const value=Number(line.split(',')[2]);if(value>=beginUs&&value<=endUs){times.push(value);return true;}return false;});
  assert(times.length>8,'Missing native V8 CPU samples inside the marked phase');
  return {log:selected.join('\n'),beginUs,endUs,ticks:times.length,gapsUs:times.slice(1).map((time,index)=>time-times[index]).sort((a,b)=>a-b),version:lines.find(line=>line.startsWith('v8-version,'))?.split(',').slice(1,4).join('.')};
}

export function nativeV8PhaseObservations(output){
  const phases=new Map();let active;let totalGcEvents=0;
  const gc=text=>{if(/\bpause=/.test(text)){
      const fields=Object.fromEntries([...text.matchAll(/\b([a-z_]+)=([^ ]+)/g)].map(match=>[match[1],match[2]]));
      assert(Number.isFinite(Number(fields.pause)),'Invalid native GC pause');totalGcEvents++;
      const before=Number(fields.start_object_size??fields.total_size_before),after=Number(fields.end_object_size??fields.total_size_after);
      assert(Number.isFinite(before)&&Number.isFinite(after),'Native GC object-size counters are missing');
      const memory=key=>fields[key]===undefined?undefined:Number(fields[key]);
      active?.gc.push({kind:fields.gc,pauseMs:Number(fields.pause),allocatedBetweenGcBytes:Number(fields.allocated),heapObjectBytesBefore:before,heapObjectBytesAfter:after,heapMemoryBytesBefore:memory('start_memory_size'),heapMemoryBytesAfter:memory('end_memory_size')});
  }};
  // V8 printf and the host's ostream can share a physical line. Parse markers
  // and their surrounding GC records in stream order, preserving boundaries.
  for(const line of output.split(/\r?\n/)){
    let offset=0;for(const marker of line.matchAll(/ANIMATION_V8_PHASE (\{[^\r\n]*?\})/g)){
      gc(line.slice(offset,marker.index));offset=marker.index+marker[0].length;
      const value=JSON.parse(marker[1]);assert(Number.isFinite(value.nativeMs));
      if(value.begin){assert(!active,'Overlapping native V8 diagnostic phases');assert(!phases.has(value.phase),'Duplicate native V8 phase');active={begin:value,gc:[]};phases.set(value.phase,active);}
      else{assert(active?.begin.phase===value.phase,'Mismatched native V8 diagnostic phase');active.end=value;active=undefined;}
    }gc(line.slice(offset));
  }
  assert(!active,'Unclosed native V8 diagnostic phase');assert(totalGcEvents>0,'Native V8 GC trace did not run');
  return {totalGcEvents,phases};
}

export function compactV8CodeMap(log){
  // Source bodies and expanded source-position tables are not needed for
  // address-to-function lookup. Original locations come from Metro's map.
  const keep=new Set(['v8-version','profiler','shared-library','code-creation','code-move','code-delete','sfi-move','tick']);
  return log.split(/\r?\n/).filter(line=>keep.has(line.split(',',1)[0])).join('\n')+'\n';
}

export function v8EmbeddedCodeMap(log){
  // V8 escapes commas inside fields. Its log is split at literal commas.
  // Node's JsonProfile checks shared-library pages before dynamic entries, so
  // builtins embedded in v8jsi.dll can otherwise be reported as the whole DLL.
  const rows=log.split(/\r?\n/).map(line=>line.split(','));
  const libraries=rows.filter(row=>row[0]==='shared-library'&&/[\\/]v8jsi\.dll$/i.test(row[1]));
  assert.equal(libraries.length,1,'Expected the one pinned V8 library in the CPU log');
  const base=Number(libraries[0][2]),limit=Number(libraries[0][3]);assert(Number.isSafeInteger(base)&&Number.isSafeInteger(limit)&&limit>base);
  const entries=new Map();
  for(const row of rows){
    if(row[0]!=='code-creation')continue;
    const start=Number(row[4]),size=Number(row[5]);
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(size)||size<=0||start<base||start+size>limit)continue;
    entries.set([start,size,row[1],row[6]].join(':'),{start,end:start+size,kind:row[1],name:row[6]});
  }
  const ranges=[...entries.values()];
  return {entries:ranges.length,moduleBytes:limit-base,find(offset){
    if(!Number.isSafeInteger(offset)||offset<0||offset>=limit-base)return;
    const address=base+offset,matches=ranges.filter(entry=>entry.start<=address&&address<entry.end);
    // A hole or conflicting region stays at DLL resolution.
    if(matches.length===1)return {type:'V8EmbeddedCode',kind:matches[0].kind,name:matches[0].name};
  }};
}

/** Exact native function to nearest-JS attribution; no raw sample addresses
 * leave this join, and nearest/unresolved symbols never become function rows. */
export function attributeV8NativeCallers({offsets,symbols,callers}){
  const remaining=new Map(offsets.map(entry=>[entry.offset,entry.samples])),byOffset=new Map(),groups=new Map();assert.equal(remaining.size,offsets.length);
  for(const symbol of symbols){assert(remaining.has(symbol.Offset),'Unrequested PDB caller symbol');assert(!byOffset.has(symbol.Offset),'Repeated PDB caller offset');byOffset.set(symbol.Offset,symbol);}assert.equal(byOffset.size,remaining.size,'PDB caller symbols lost offsets');
  let functionCallerSamples=0,functionWithJsCallerSamples=0,functionWithoutJsCallerSamples=0,nearestSymbolCallerSamples=0,unresolvedCallerSamples=0;
  for(const entry of callers){const count=remaining.get(entry.offset);assert(count!==undefined&&Number.isSafeInteger(entry.samples)&&entry.samples>0&&entry.samples<=count,'Unrequested or excessive native caller samples');remaining.set(entry.offset,count-entry.samples);assert(entry.caller===null||typeof entry.caller==='string'||typeof entry.caller==='object','Invalid nearest JS caller');const symbol=byOffset.get(entry.offset);
    if(!symbol.Name){unresolvedCallerSamples+=entry.samples;continue;}
    const exact=symbol.Tag===5&&symbol.Size>0&&symbol.Displacement>=0&&symbol.Displacement<symbol.Size;if(!exact){nearestSymbolCallerSamples+=entry.samples;continue;}
    functionCallerSamples+=entry.samples;if(entry.caller===null)functionWithoutJsCallerSamples+=entry.samples;else functionWithJsCallerSamples+=entry.samples;
    const key=JSON.stringify({nativeFunction:{name:symbol.Name,tag:symbol.Tag,size:symbol.Size},caller:entry.caller});groups.set(key,(groups.get(key)??0)+entry.samples);
  }
  assert([...remaining.values()].every(value=>value===0),'Native caller attribution lost samples');
  return {callerTotalSamples:offsets.reduce((sum,entry)=>sum+entry.samples,0),functionCallerSamples,functionWithJsCallerSamples,functionWithoutJsCallerSamples,nearestSymbolCallerSamples,unresolvedCallerSamples,functionCallers:[...groups].sort((a,b)=>b[1]-a[1]).slice(0,32).map(([key,samples])=>({...JSON.parse(key),samples}))};
}

export function symbolizeV8NativeOffsets({offsets,moduleBytes,image,imageSha256,callers}){
  assert.equal(process.platform,'win32');assert(/^[a-f0-9]{64}$/.test(imageSha256));
  assert(offsets.length>0&&offsets.length<=16384);for(const entry of offsets)assert(Number.isSafeInteger(entry.offset)&&entry.offset>=0&&entry.offset<moduleBytes&&Number.isSafeInteger(entry.samples)&&entry.samples>0);
  const result=spawnSync('pwsh',['-NoProfile','-NonInteractive','-File',path.join(import.meta.dirname,'windows-v8-symbols.ps1'),'-ImagePath',path.resolve(image),'-ExpectedSha256',imageSha256,'-ExpectedImageSize',String(moduleBytes)],{input:JSON.stringify(offsets),encoding:'utf8',timeout:1_200_000,maxBuffer:4*1024**2,windowsHide:true});
  assert(!result.error,result.error?.message);assert.equal(result.status,0,result.stdout+result.stderr);
  const data=JSON.parse(result.stdout),counts=new Map(offsets.map(entry=>[entry.offset,entry.samples]));assert.equal(data.ImageSize,moduleBytes);assert.equal(data.Symbols.length,offsets.length);
  const groups=new Map();let resolved=0,nearest=0,unresolved=0;
  for(const symbol of data.Symbols){const count=counts.get(symbol.Offset);assert(count,'Unrequested PDB address');counts.delete(symbol.Offset);
    if(!symbol.Name){unresolved+=count;continue;}
    const exact=symbol.Tag===5&&symbol.Size>0&&symbol.Displacement<symbol.Size;if(exact)resolved+=count;else nearest+=count;
    const key=JSON.stringify({name:symbol.Name,tag:symbol.Tag,size:symbol.Size,exactFunction:exact});const value=groups.get(key)??{samples:0,minDisplacement:Infinity,maxDisplacement:0};value.samples+=count;value.minDisplacement=Math.min(value.minDisplacement,symbol.Displacement);value.maxDisplacement=Math.max(value.maxDisplacement,symbol.Displacement);groups.set(key,value);
  }
  assert.equal(counts.size,0,'PDB decoder lost native offsets');
  return {...data,Symbols:undefined,imageSha256,scope:'offline exact image SHA and PE/PDB GUID-age matched; selected V8 DLL leaf samples only',totalSamples:offsets.reduce((sum,entry)=>sum+entry.samples,0),resolvedFunctionSamples:resolved,nearestSymbolSamples:nearest,unresolvedSamples:unresolved,...(callers?attributeV8NativeCallers({offsets,symbols:data.Symbols,callers}):{}),top:[...groups].sort((a,b)=>b[1].samples-a[1].samples).slice(0,28).map(([key,value])=>({...JSON.parse(key),...value}))};
}

export function profileSamplesBySource(samples){
  const sources=new Map();let totalSamples=0;
  for(const [label,count]of samples){assert(Number.isSafeInteger(count)&&count>=0,'Profile sample counts must be nonnegative safe integers');const frame=JSON.parse(label),source=frame&&typeof frame==='object'&&typeof frame.source==='string'?frame.source:'unmapped';sources.set(source,(sources.get(source)??0)+count);totalSamples+=count;assert(Number.isSafeInteger(totalSamples),'Profile sample total overflow');}
  return {totalSamples,sources:[...sources].sort((a,b)=>b[1]-a[1]).slice(0,24).map(([source,samples])=>({source,samples}))};
}

export function summarizeNativeV8Profile({logfile,output,sourceMap,runner,phase='list-entry-revisit',nativeSymbolImage,nativeImageSha256,rawLogText}){
  assert(fs.statSync(logfile).size<=64*1024**2,'Bounded diagnostic V8 log exceeded64MiB');
  const raw=rawLogText??fs.readFileSync(logfile,'utf8');assert(Buffer.byteLength(raw)<=64*1024**2,'Bounded diagnostic V8 source log exceeded64MiB');
  const selected=selectV8Phase(raw,phase),observed=nativeV8PhaseObservations(output),scope=observed.phases.get(phase),embedded=v8EmbeddedCodeMap(selected.log);
  assert(scope?.end,'Missing native phase boundary');
  const nativeSpanUs=(scope.end.nativeMs-scope.begin.nativeMs)*1000;
  assert(Math.abs(nativeSpanUs-(selected.endUs-selected.beginUs))<30000,'V8 and native phase spans disagree; tick time units are unverified');
  // Keep code-map updates in their original order, selecting only phase ticks.
  // No previous/full profile is retained alongside this temporary processor input.
  const compact=compactV8CodeMap(selected.log);fs.writeFileSync(logfile,compact);
  const result=spawnSync(process.execPath,['--prof-process','--preprocess','--windows',logfile],{encoding:'utf8',timeout:1_200_000,maxBuffer:32*1024**2,windowsHide:true});
  assert(!result.error,(result.error?.message??'')+' stdout-head='+result.stdout?.slice(0,1000)+' stderr-tail='+result.stderr?.slice(-1000));assert.equal(result.status,0,result.stderr?.slice(-2000));
  assert(!result.stderr.includes('BROKEN_PROFILE_FILE'),'V8 processor rejected the profile framing: '+result.stderr.slice(-1000));
  let profile;try{profile=JSON.parse(result.stdout);}catch{throw Error('V8 preprocessing did not return JSON: '+result.stdout.slice(0,1000)+' '+result.stderr.slice(-1000));}assert.equal(profile.ticks.length,selected.ticks,'Processor lost selected V8 samples');
  const load=createRequire(path.join(runner,'package.json')),{TraceMap,originalPositionFor}=load('@jridgewell/trace-mapping'),map=new TraceMap(JSON.parse(fs.readFileSync(sourceMap,'utf8')));
  const name=code=>{
    const position=code.name.match(/:(\d+):(\d+)$/);if(!position||Number(position[1])<1||Number(position[2])<1||!code.name.includes('input-surface'))return code.name;
    const original=originalPositionFor(map,{line:Number(position[1]),column:Number(position[2])-1});
    return original.source?{name:code.name.split(' ').slice(0,-1).join(' '),source:original.source,line:original.line}:code.name;
  };
  const self=new Map(),nonJsSelf=new Map(),nonJsCallers=new Map(),nativeOffsets=new Map(),nativeCallerOffsets=new Map(),nearestJs=new Map(),inclusive=new Map(),states={},unknown={leaf:0,stack:0};let jsLeafSamples=0;
  for(const tick of profile.ticks){states[tick.vm]=(states[tick.vm]??0)+1;const seen=new Set();let attributed=false,nearestCaller=null,nativeOffset;
    const leaf=profile.code[tick.s[0]];
    const native=leaf?.type==='SHARED_LIB'&&/v8jsi\.dll$/i.test(leaf.name)?embedded.find(tick.s[1]):undefined;
    if(leaf?.type==='SHARED_LIB'&&/v8jsi\.dll$/i.test(leaf.name)&&!native){const offset=tick.s[1];assert(Number.isSafeInteger(offset)&&offset>=0&&offset<embedded.moduleBytes);nativeOffset=offset;nativeOffsets.set(offset,(nativeOffsets.get(offset)??0)+1);}
    const nativeLabel=leaf&&leaf.type!=='JS'?(native??{type:leaf.type,kind:leaf.kind,name:leaf.name}):undefined;
    if(!leaf)unknown.leaf++;
    else if(nativeLabel){const label=JSON.stringify(nativeLabel);nonJsSelf.set(label,(nonJsSelf.get(label)??0)+1);}
    for(let index=0;index<tick.s.length;index+=2){const code=profile.code[tick.s[index]];if(!code){unknown.stack++;continue;}if(code.type!=='JS')continue;
      const label=JSON.stringify(name(code));if(index===0){self.set(label,(self.get(label)??0)+1);jsLeafSamples++;}if(!attributed){attributed=true;nearestCaller=JSON.parse(label);nearestJs.set(label,(nearestJs.get(label)??0)+1);if(nativeLabel){const joint=JSON.stringify({native:nativeLabel,caller:nearestCaller});nonJsCallers.set(joint,(nonJsCallers.get(joint)??0)+1);}}if(!seen.has(label)){seen.add(label);inclusive.set(label,(inclusive.get(label)??0)+1);}
    }
    if(nativeOffset!==undefined){const key=JSON.stringify({offset:nativeOffset,caller:nearestCaller});nativeCallerOffsets.set(key,(nativeCallerOffsets.get(key)??0)+1);}
  }
  assert(jsLeafSamples>8,'No resolved native V8 JavaScript leaf samples');
  assert.equal(jsLeafSamples+[...nonJsSelf.values()].reduce((sum,value)=>sum+value,0)+unknown.leaf,profile.ticks.length,'V8 leaf attribution must account for every selected sample');
  const top=values=>[...values].sort((a,b)=>b[1]-a[1]).slice(0,24).map(([label,samples])=>({frame:JSON.parse(label),samples}));
  const gc=[...observed.phases].map(([name,value])=>({phase:name,events:value.gc.length,pauseMs:value.gc.reduce((sum,event)=>sum+event.pauseMs,0),maxPauseMs:Math.max(0,...value.gc.map(event=>event.pauseMs)),lastGc:value.gc.at(-1),memory:{begin:value.begin,end:value.end}}));
  const offsets=[...nativeOffsets].map(([offset,samples])=>({offset,samples}));
  const callers=[...nativeCallerOffsets].map(([key,samples])=>({...JSON.parse(key),samples}));
  const nativeSymbols=nativeSymbolImage&&offsets.length?symbolizeV8NativeOffsets({offsets,moduleBytes:embedded.moduleBytes,image:nativeSymbolImage,imageSha256:nativeImageSha256,callers}):undefined;
  return {scope:'diagnostic native V8 VM samples; nearestJs includes native work below its caller; not minimal CPU or display acceptance',phase,engineV8:selected.version,processorV8:process.versions.v8,processorWarnings:result.stderr.split(/\r?\n/).filter(Boolean).slice(0,4),processorBytes:Buffer.byteLength(result.stdout),compactLogBytes:Buffer.byteLength(compact),embeddedCode:{entries:embedded.entries,moduleBytes:embedded.moduleBytes},nativeOffsets:nativeSymbols?undefined:offsets,nativeSymbols,ticks:selected.ticks,jsLeafSamples,unknown,numericVmStates:states,spanMs:(selected.endUs-selected.beginUs)/1000,tickGapsUs:{p50:selected.gapsUs[Math.floor(selected.gapsUs.length*.5)],p95:selected.gapsUs[Math.floor(selected.gapsUs.length*.95)],max:selected.gapsUs.at(-1)},selfBySource:profileSamplesBySource(self),nearestJsBySource:profileSamplesBySource(nearestJs),self:top(self),nonJsSelf:top(nonJsSelf),nonJsCallers:top(nonJsCallers),nearestJs:top(nearestJs),inclusive:top(inclusive),totalGcEvents:observed.totalGcEvents,gc};
}
