// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {selectV8Phase,nativeV8PhaseObservations,compactV8CodeMap,v8EmbeddedCodeMap,symbolizeV8NativeOffsets,attributeV8NativeCallers,profileSamplesBySource} from './windows-v8-profile.mjs';
const timeout=1_200_000;

test('source totals distinguish JavaScript self or nearest-caller input without losing unmapped samples',{timeout},()=>{
 const rows=new Map([[JSON.stringify({name:'layout',source:'render.js',line:1}),3],[JSON.stringify({name:'paint',source:'render.js',line:5}),2],[JSON.stringify({name:'submit',source:'renderer.js',line:2}),4],[JSON.stringify('unmapped function'),1]]);
 assert.deepEqual(profileSamplesBySource(rows),{totalSamples:10,sources:[{source:'render.js',samples:5},{source:'renderer.js',samples:4},{source:'unmapped',samples:1}]});
 assert.throws(()=>profileSamplesBySource([[JSON.stringify('invalid'),-1]]),/sample counts/);
 assert.throws(()=>profileSamplesBySource([[JSON.stringify('a'),Number.MAX_SAFE_INTEGER],[JSON.stringify('b'),1]]),/overflow/);
});
test('native caller joins preserve exact-function provenance, missing JS callers and complete sample accounting',{timeout},()=>{
 const offsets=[{offset:10,samples:3},{offset:11,samples:2},{offset:20,samples:1},{offset:30,samples:1}],symbols=[{Offset:10,Name:'Lookup',Tag:5,Size:12,Displacement:0},{Offset:11,Name:'Lookup',Tag:5,Size:12,Displacement:1},{Offset:20,Name:'NearestOnly',Tag:10,Size:0,Displacement:1},{Offset:30,Name:null,Tag:0,Size:0,Displacement:0}],caller={name:'layout',source:'text.js',line:42},callers=[{offset:10,samples:2,caller},{offset:10,samples:1,caller:null},{offset:11,samples:2,caller},{offset:20,samples:1,caller},{offset:30,samples:1,caller:null}];
 const result=attributeV8NativeCallers({offsets,symbols,callers});assert.equal(result.callerTotalSamples,7);assert.equal(result.functionCallerSamples,5);assert.equal(result.functionWithJsCallerSamples,4);assert.equal(result.functionWithoutJsCallerSamples,1);assert.equal(result.nearestSymbolCallerSamples,1);assert.equal(result.unresolvedCallerSamples,1);assert.deepEqual(result.functionCallers.map(row=>[row.caller,row.samples]),[[caller,4],[null,1]]);assert(result.functionCallers.every(row=>row.nativeFunction.name==='Lookup'));assert(!JSON.stringify(result).includes('offset'));
 assert.throws(()=>attributeV8NativeCallers({offsets,symbols,callers:callers.slice(1)}),/lost samples/);assert.throws(()=>attributeV8NativeCallers({offsets,symbols,callers:[...callers,callers[0]]}),/excessive/);assert.throws(()=>attributeV8NativeCallers({offsets,symbols:[...symbols,symbols[0]],callers}),/Repeated/);
});

test('optional pinned PDB decodes the public flag ABI and rejects foreign image/extent',{timeout,skip:process.platform!=='win32'||!process.env.NELYX_TEST_V8_PDB_IMAGE},()=>{
 const options={image:process.env.NELYX_TEST_V8_PDB_IMAGE,imageSha256:'106b7a596430f3de3d51c02534b31ad2c85c7df205fbdd803459ec7f26e9f250',moduleBytes:33824768,offsets:[{offset:0x23330,samples:2},{offset:0x23331,samples:1}]};
 const result=symbolizeV8NativeOffsets(options);assert.equal(result.Guid,'4198a213-96a1-ef01-4c4c-44205044422e');assert.equal(result.Age,1);assert.equal(result.resolvedFunctionSamples,3);assert.equal(result.nearestSymbolSamples,0);assert.equal(result.unresolvedSamples,0);assert.equal(result.top[0].name,'v8_jsi_set_v8_flags');assert(result.top[0].exactFunction);
 assert.throws(()=>symbolizeV8NativeOffsets({...options,imageSha256:'0'.repeat(64)}),/sampled V8 supplier/);
 assert.throws(()=>symbolizeV8NativeOffsets({...options,moduleBytes:options.moduleBytes+1}),/shared-library range differs/);
});

test('embedded DLL builtins resolve at native offsets while holes and conflicting regions remain unassigned',{timeout},()=>{
 const rows=[String.raw`shared-library,C:\temp\v8jsi.dll,0x1000,0x2000,0`, 'code-creation,Builtin,2,1,0x1100,16,LoadIC','code-creation,BytecodeHandler,3,2,0x1120,8,LdaNamedProperty','code-creation,Builtin,2,3,0x3000,16,OtherImage'];
 const map=v8EmbeddedCodeMap(rows.join('\n'));assert.equal(map.entries,2);assert.equal(map.moduleBytes,4096);assert.equal(map.find(0x100).name,'LoadIC');assert.equal(map.find(0x10f).name,'LoadIC');assert.equal(map.find(0x110),undefined);assert.equal(map.find(0x120).name,'LdaNamedProperty');assert.equal(map.find(-1),undefined);assert.equal(map.find(0x1000),undefined);
 const conflict=v8EmbeddedCodeMap([...rows,'code-creation,Builtin,2,4,0x1108,8,Alias'].join('\n'));assert.equal(conflict.find(0x10a),undefined);
 const alias=v8EmbeddedCodeMap([...rows,'code-creation,Builtin,2,4,0x1100,16,Alias'].join('\n'));assert.equal(alias.find(0x100),undefined);
 assert.throws(()=>v8EmbeddedCodeMap(''),/one pinned V8 library/);
});
test('CPU processing omits source payloads and preserves function/shared-info relocation',{timeout},()=>{
 const retained=['v8-version,13,6,233,0','shared-library,v8.dll,0x100,0x200','code-creation,JS,9,100,0x110,8,method','code-move,0x110,0x120','sfi-move,0x130,0x140','code-delete,0x150','tick,0x120,101,0,0,0'];
 const output=compactV8CodeMap([...retained,'script-source,1,program.js,source payload','code-source-info,0x120,expanded positions'].join('\n'));assert(output.endsWith('\n'),'V8 processor requires the final record delimiter');assert.deepEqual(output.trimEnd().split('\n'),retained);
});
test('VM phase selection keeps code movement while excluding samples from other work',{timeout},()=>{
 const log=['v8-version,13,6,233,0','code-creation,JS,9,100,0x10,8,nelyxProfilePhaseMarker_list_entry_revisit_begin nelyx.profile/list-entry-revisit/begin:1:1','tick,0x10,99,0,0,0',...Array.from({length:10},(_,i)=>'tick,0x10,'+(101+i)+',0,0,0'),'code-move,0x10,0x20','code-creation,JS,9,200,0x30,8,nelyxProfilePhaseMarker_list_entry_revisit_end nelyx.profile/list-entry-revisit/end:1:1','tick,0x30,201,0,0,0'].join('\n');
 const selected=selectV8Phase(log,'list-entry-revisit');assert.equal(selected.ticks,10);assert(selected.log.includes('code-move,0x10,0x20'));assert(!selected.log.includes('0x10,99,'));assert(!selected.log.includes('0x30,201,'));assert.equal(selected.version,'13.6.233');
 assert.throws(()=>selectV8Phase(log+'\n'+log,'list-entry-revisit'),/one compiled V8 phase marker/);
});
test('native GC observations preserve startup separation and exact phase/memory boundaries',{timeout},()=>{
 const mark=(phase,begin,time)=>'ANIMATION_V8_PHASE '+JSON.stringify({phase,begin,nativeMs:time,workingSetBytes:123,peakWorkingSetBytes:456,privateBytes:789});
 const gc='[1:0x2] 10 ms: pause=2.5 gc=s allocated=800 start_object_size=5000 end_object_size=4200 start_memory_size=8000 end_memory_size=9000';
 const output=[gc+mark('list-warm',true,1),mark('list-warm',false,2),mark('list-entry-revisit',true,3)+gc+mark('list-entry-revisit',false,4)].join('\n');
 const observed=nativeV8PhaseObservations(output);assert.equal(observed.totalGcEvents,2);assert.equal(observed.phases.get('list-warm').gc.length,0);const event=observed.phases.get('list-entry-revisit').gc[0];assert.equal(event.pauseMs,2.5);assert.equal(event.heapObjectBytesBefore,5000);assert.equal(event.heapMemoryBytesAfter,9000);assert.equal(observed.phases.get('list-entry-revisit').end.privateBytes,789);
 assert.throws(()=>nativeV8PhaseObservations(output+'\n'+mark('orphan',false,5)),/Mismatched/);
 assert.throws(()=>nativeV8PhaseObservations(gc+'\n'+mark('open',true,1)),/Unclosed/);
});
