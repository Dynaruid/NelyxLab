// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {nativePcReport,nativePcSources} from './windows-pc-results.mjs';
import {compactWindowsSymbols,symbolizeWindowsJavaScript} from './windows-fault-results.mjs';
const timeout=1_200_000;
test('Core failure symbols use the owned Metro map and one-based stack columns without replacing failures',{timeout},()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-js-fault-')),file=path.join(directory,'input-surface.js.map'),root=path.resolve(import.meta.dirname,'../../..');
 try{
  const generated=path.join(directory,'input-surface.js'),output='ANIMATION_JS CORE_FAILURE '+JSON.stringify({causes:[{path:'build.errors[0]',message:'TypeError: undefined is not a function',stack:`TypeError\n    at first (${generated}:1:1)\n    at run (${generated}:2:3)\n    at alien (${path.join(directory,'other.js')}:2:3)\n    at foreign (${path.join(directory,'foreign','input-surface.js')}:2:3)\n    at invalid (${generated}:0:1)`}]});
  assert.deepEqual(symbolizeWindowsJavaScript(output,directory,root),[],'An uninstrumented build has no invented source correspondence');
  fs.writeFileSync(file,JSON.stringify({version:3,sources:['source.ts'],sourcesContent:['const a = 1;\nfunction run() {}'],names:['run'],mappings:'AAAA;EACIA'}));
  const symbols=symbolizeWindowsJavaScript(output,directory,root);assert.equal(symbols.length,1);assert.equal(symbols[0].message,'TypeError: undefined is not a function');assert.equal(symbols[0].path,'build.errors[0]');
  assert.deepEqual(symbols[0].frames,[{generated:{line:1,column:1},source:'source.ts',line:1,column:0,name:null},{generated:{line:2,column:3},source:'source.ts',line:2,column:4,name:'run'}]);
  assert.throws(()=>symbolizeWindowsJavaScript('ANIMATION_JS CORE_FAILURE broken',directory,root),'Malformed diagnostics stay visible to the caller');
 }finally{if(fs.existsSync(file))fs.unlinkSync(file);assert.equal(path.dirname(directory),fs.realpathSync(os.tmpdir()));assert(path.basename(directory).startsWith('nelyx-js-fault-'));fs.rmdirSync(directory);}
});

test('PC symbol summaries retain image-relative addresses and source lines without repeating full paths and signatures',{timeout},()=>{
 const result=compactWindowsSymbols([{module:'hermes.dll',output:JSON.stringify([{Address:'0x101',Symbol:[{FunctionName:'HadesGC::visit<List<Slot>>(Runtime &)',FileName:'C:\\sdk\\source\\lib\\VM\\GC.cpp',Line:7,Column:2}]}])}]);
 assert.equal(result[0].entries[0].rva,257);assert.equal(result[0].entries[0].symbols[0].function,'HadesGC::visit<...>(Runtime &)');assert.equal(result[0].entries[0].symbols[0].file,'lib/VM/GC.cpp');assert.match(result[0].entries[0].symbols[0].signatureSha256,/^[a-f0-9]{64}$/);assert(compactWindowsSymbols([{module:'bad',output:'invalid'}])[0].error);
});
test('PC source metadata reads nested IR and rejects stale or reordered kernels before native compilation',{timeout},()=>{
 const typed={id:'row',module:'generic.ts',name:'row',position:{offset:3}},partition={ir:{schema:'nelyx.typed-partition-ir/v1',functions:[typed]},bindings:[{id:'row'}],executionPlan:{modules:[{sourceFile:'generic.ts',span:{offset:0,end:30},emitted:[],originals:[]}]}};
 assert.deepEqual(nativePcSources(partition).typed,[typed]);assert.equal(nativePcSources(partition).owners[0].unit,'nelyx_app');
 for(const change of [p=>delete p.ir,p=>p.bindings[0].id='wrong',p=>delete p.executionPlan.modules[0].emitted]){const invalid=structuredClone(partition);change(invalid);assert.throws(()=>nativePcSources(invalid));}
});
test('observed PC accounting preserves aliases without multiplying samples or inventing original statements',{timeout},()=>{
 const fn={unit:'nelyx_app',symbol:'body',rva:100,size:20,position:{offset:15,line:1,column:15}},map={schema:'nelyx.native-pc-map/v1',functions:[fn,{...fn,symbol:'folded'}],owners:[{unit:'nelyx_app',sourceFile:'generic-row.ts',span:{offset:10,end:30},emitted:[{inputOffset:10,inputEnd:20,originals:['row']}],originals:[{id:'row',name:'createRow',line:4,column:2}]}]},profile={phase:'list-cold',thread:10,complete:true,samples:5,failed:0,dropped:0,pcs:[{module:'NelyxApp.aot.dll',rva:105,n:2},{module:'NelyxApp.aot.dll',rva:130,n:1},{module:'hermes.dll',rva:2,n:2}]};
 const result=nativePcReport(profile,map);assert.equal(result.matchedAotSamples,2);assert.equal(result.aotOutsideOwnedRanges,1);assert.equal(result.observedSourcePcs.length,1);assert.equal(result.observedSourcePcs[0].functions.length,2);assert.equal(result.observedSourcePcs[0].functions[0].originals[0].name,'createRow');assert.equal(result.modules['hermes.dll'],2);
 const folded=nativePcReport(profile,{...map,functions:Array.from({length:1000},(_,i)=>({...fn,symbol:'folded'+i}))});assert.equal(folded.matchedAotSamples,2);assert.equal(folded.observedSourcePcs[0].functionCount,1000);assert.equal(folded.observedSourcePcs[0].functions.length,4,'Large folded alias sets remain explicit without flooding the transport');
 const split=nativePcReport({...profile,samples:8,pcs:[...profile.pcs,{module:'NelyxApp.aot.dll',rva:110,n:3}]},map);assert.equal(split.matchedAotSamples,5);assert.equal(split.ownedFunctionGroups,1);assert.equal(split.ownedFunctionObservations[0].n,5);assert.equal(split.ownedFunctionObservations[0].pcCount,2);assert.equal(split.ownedFunctionObservations[0].functionCount,2,'Range aggregation must not multiply folded aliases');
 for(const change of [p=>p.complete=false,p=>p.failed=1,p=>p.dropped=1,p=>p.pcs[0].n++,p=>p.pcs[0].rva=-1]){const invalid=structuredClone(profile);change(invalid);assert.throws(()=>nativePcReport(invalid,map));}
 assert.equal(nativePcReport(profile).observedSourcePcs.length,0,'Bytecode PCs do not invent AOT source correspondence');
});
