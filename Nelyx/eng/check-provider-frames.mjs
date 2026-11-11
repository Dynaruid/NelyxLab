// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Provider frame checks exceeded 20 minutes');
}, 1200000);
const stackTraceLimit = Error.stackTraceLimit;
try {
  Error.stackTraceLimit = 0;
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import {pathToFileURL} from 'node:url';import path from 'node:path';
      import {ProviderFrames} from './Nelyx/engine/platform/web/provider-frames.ts';
      import {ProviderBudget} from './Nelyx/engine/platform/web/memory.ts';
      import {exchange,forgetHeapReport,owner,sessionOwner} from './Nelyx/engine/platform/web/common.ts';
      import {ObservationStream} from './Nelyx/runtime/engine-client/observation-stream.ts';
      import {commands as c,body,packet,response,transaction,protocol as p} from './Nelyx/runtime/engine-client/codec.ts';
      const factory=(await import(pathToFileURL(path.resolve(process.argv[2]??'Nelyx/engine/dist/single-worker/engine.mjs')).href)).default;
      const module=await factory();
      const create=()=>({engine:module._nelyx_wasm_open(1,1,p.schema,p.capabilities.protocol),document:0n,transaction:0n,clock:0});
      const call=(model,op,data?,id=0n)=>response(exchange(module,model.engine,packet(op,owner,data,id)));
      const ok=(model,op,data?)=>{const result=call(model,op,data);assert.equal(result.status,p.statuses.ok,'Core opcode '+op);return result;};
      const paint=color=>[{kind:'shape',color,shape:{kind:'rrect',radii:Array(8).fill(0),strokeWidth:0,strokeColor:0,strokeAlign:0}}];
      const projection=node=>Object.fromEntries(Object.entries(node).filter(([key])=>!['semantics','semanticTraversal','semanticGeometry','list','layoutBuilder'].includes(key)).map(([key,value])=>[key,key==='flags'?value&~p.nodeFlags.semanticsBlocked:value]));
      for(const count of [64,2048]){
        const actual=create(),oracle=create(),models=[actual,oracle],budget=new ProviderBudget(module,actual.engine,2),frames=new ProviderFrames(module,actual.engine,budget),appStream=new ObservationStream();
        const leases=[],acquisitions=[];
        const root={slot:1,generation:1},children=Array.from({length:count},(_,i)=>({slot:i+2,generation:1})),target=children.at(-1);
        const commit=changes=>{for(const model of models){const result=response(exchange(module,model.engine,transaction(owner,++model.transaction,model.document,changes)));assert.equal(result.status,p.statuses.accepted);model.document=result.document;}};
        const advance=()=>{for(const model of models){for(let step=0;step<256;++step){const state=ok(model,p.opcodes.contentStep,body(8,v=>v.setUint32(0,p.limits.contentPerStep,true)));if(!state.preparation||state.preparationReady)break;assert(!state.measureRequest&&!state.layoutBuildPending,'Unexpected provider dependency');if(step===255)throw Error('Content fixture did not finish');}ok(model,p.opcodes.tick,body(8,v=>v.setFloat64(0,++model.clock,true)));}};
        const finish=(model,frame,failed=false)=>{const data=body(24,v=>{v.setBigUint64(0,frame.submission,true);v.setBigUint64(8,frame.device,true);v.setUint32(20,failed?1:0,true);});ok(model,p.opcodes.releaseFrame,data);if(!failed)ok(model,p.opcodes.publish,data);};
        const compare=()=>{const acquired=frames.acquire();leases.push(acquired);acquisitions.push([actual,acquired.frame]);const full=ok(oracle,p.opcodes.takeFrame);acquisitions.push([oracle,full]);assert.equal(acquired.frame.status,p.statuses.ok);assert.deepEqual(acquired.frame.nodes.map(projection),full.nodes.map(projection),'Provider delta differs from full eager frame');return {acquired,full};};
        const publish=pair=>{finish(actual,pair.acquired.frame);finish(oracle,pair.full);pair.acquired.release();};
        const inspect=()=>ok(actual,p.opcodes.inspect,body(4,v=>v.setUint32(0,p.inspectionFlags.stateOnly,true)));
        try {
          for(const model of models){ok(model,p.opcodes.openView);ok(model,p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,2n,true);v.setFloat64(8,320,true);v.setFloat64(16,240,true);v.setFloat64(24,1,true);}));}
          const initial=[c.create(root,'stack'),c.properties(root,{width:320,height:240}),...children.flatMap((node,i)=>[c.create(node,'box',0,{parent:root,index:i}),c.properties(node,{x:i%8,y:i%6,width:20,height:20})]),c.nativePaint(target,paint(0xff123456)),c.semantics(target,{role:'button',label:'original'})];
          for(let offset=0;offset<initial.length;offset+=1024)commit(initial.slice(offset,offset+1024));
          advance();const first=compare();assert(first.acquired.frame.observation.full);assert.equal(first.acquired.frame.nodes.length,count+1);
          finish(actual,first.acquired.frame);finish(oracle,first.full);
          const oldTarget=first.acquired.frame.nodes.at(-1),oldPaint=oldTarget.nativePaint;
          const appRead=()=>response(exchange(module,actual.engine,packet(p.opcodes.semanticsSnapshot,owner,body(16,v=>{v.setUint32(0,p.inspectionFlags.appObservationDelta,true);v.setBigUint64(8,appStream.version,true);}))),{observationStream:appStream});
          assert.equal(appRead().nodes.find(n=>n.node.slot===target.slot).semantics.label,'original');const appVersion=appStream.version;
          commit([c.paint(target,0xff654321),c.nativePaint(target,paint(0xff654321)),c.semantics(target,{role:'button',label:'updated'})]);advance();const changed=compare();
          assert(!changed.acquired.frame.observation.full);assert(changed.acquired.frame.observation.rowVisits<=2,'Small paint update serialized unrelated rows');assert(changed.acquired.frame.observation.changedRows<=2);
          assert.equal(changed.acquired.frame.nodes[1],first.acquired.frame.nodes[1],'Unchanged eager row wrapper was rebuilt');assert.equal(oldTarget.nativePaint,oldPaint);assert.equal(oldPaint[0].color,0xff123456,'Previous immutable reader changed');
          assert.equal(appStream.version,appVersion,'Provider consumed App subscription');first.acquired.release();publish(changed);assert.equal(appRead().nodes.find(n=>n.node.slot===target.slot).semantics.label,'updated');
          commit([c.properties(target,{x:35,y:22,width:21,height:19}),c.graphics(target,{transform:[1,.2,.1,1,4,5]})]);advance();publish(compare());
          commit([c.nativePaint(target,[{...paint(0xff654321)[0],reference:children[0],geometry:{kind:'program',rect:[0,0,{op:'width'},{op:'height'}]}}])]);advance();publish(compare());
          commit([c.properties(children[0],{x:60,y:45,width:25,height:23})]);advance();publish(compare());
          commit([c.move(children[0],root,count-1)]);advance();publish(compare());
          commit([c.destroy(children[1],true)]);advance();const removed=compare();assert.equal(removed.acquired.frame.observation.removedRows,1);publish(removed);
          const recycled={slot:children[1].slot,generation:2};commit([c.create(recycled,'box',0,{parent:root,index:count-1}),c.properties(recycled,{width:11,height:13})]);advance();publish(compare());
          commit([c.paint(target,0xff112233)]);advance();const canceled=compare();finish(actual,canceled.acquired.frame,true);finish(oracle,canceled.full,true);canceled.acquired.release();
          const afterCancel=compare();assert(afterCancel.acquired.frame.observation.full,'Canceled predecessor was used as a delta base');publish(afterCancel);
          commit([c.paint(target,0xff223344)]);advance();const held=compare();frames.pressure(true);assert(frames.diagnostics.retiredBytes>0,'Pressure returned a live reader credit');assert.equal(frames.diagnostics.reservedBytes,0);assert.equal(held.acquired.frame.nodes.find(n=>n.node.slot===target.slot).node.generation,1);publish(held);assert.equal(frames.diagnostics.retiredBytes,0);assert.equal(inspect().holds,0);
          frames.pressure(false);commit([c.paint(target,0xff334455)]);advance();const evicted=compare();assert(evicted.acquired.frame.observation.full,'Eviction did not request a full resync');publish(evicted);
          frames.beginResize();commit([c.paint(target,0xff337755)]);advance();const surface=compare();assert.equal(surface.acquired.frame.observation,null,'Surface replacement borrowed dictionary credit');assert.equal(frames.diagnostics.reservedBytes,0);assert.equal(frames.diagnostics.resizeFrames,1);publish(surface);frames.endResize();
          for(const model of models)ok(model,p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,3n,true);v.setFloat64(8,360,true);v.setFloat64(16,260,true);v.setFloat64(24,1,true);}));advance();const resized=compare();assert(resized.acquired.frame.observation.full,'Metrics change reused a foreign base');publish(resized);
          for(const model of models)ok(model,p.opcodes.device,body(16,v=>v.setBigUint64(0,2n,true)));advance();const device=compare();assert(device.acquired.frame.observation.full,'Device change reused a foreign base');publish(device);
          for(const model of models)ok(model,p.opcodes.fontRevision,body(16,v=>v.setBigUint64(0,2n,true)));advance();const font=compare();assert(font.acquired.frame.observation.full,'Font change reused a foreign base');publish(font);
          // Corrupt only one delivered base. Core had accepted the acquisition;
          // recovery must release that candidate before retrying at base zero.
          const dispatch=module._nelyx_wasm_dispatch;let inject=true;
          module._nelyx_wasm_dispatch=function(engine,pointer,length){const output=dispatch(engine,pointer,length);this._nelyx_wasm_refresh_heap();const request=new DataView(this.HEAPU8.buffer,pointer,length);if(inject&&engine===actual.engine&&request.getUint16(p.headerFields.opcode,true)===p.opcodes.takeFrame&&length===p.headerBytes+16&&request.getUint32(p.headerBytes+4,true)===0){const at=this._nelyx_wasm_buffer_data(output),size=this._nelyx_wasm_buffer_length(output),data=new DataView(this.HEAPU8.buffer,at,size);if(data.getUint16(p.headerFields.status,true)===p.statuses.ok){let cursor=p.headerBytes+p.stateBytes+data.getUint32(p.headerFields.count,true)*p.nodeBytes;for(let i=0;i<data.getUint32(p.headerBytes+p.stateFields.blobCount,true);++i){const type=data.getUint32(cursor,true),bytes=data.getUint32(cursor+16,true);if(type===p.observationDeltaBlob){assert(!(data.getUint32(cursor+40,true)&1),'Gap injection expected a delta');data.setBigUint64(cursor+24,data.getBigUint64(cursor+24,true)+1n,true);inject=false;break;}cursor+=24+Math.ceil(bytes/8)*8;}}}return output;};
          try{commit([c.paint(target,0xff445566)]);advance();const recovered=compare();assert.equal(inject,false);assert(recovered.acquired.frame.observation.full);assert.equal(frames.diagnostics.resyncs,1,'Injected gap resync count');assert.equal(inspect().holds,1,'Gap recovery leaked its first unissued candidate');publish(recovered);}finally{module._nelyx_wasm_dispatch=dispatch;}
          let corrupt=true;
          module._nelyx_wasm_dispatch=function(engine,pointer,length){const output=dispatch(engine,pointer,length);this._nelyx_wasm_refresh_heap();const input=new DataView(this.HEAPU8.buffer,pointer,length);if(corrupt&&engine===actual.engine&&input.getUint16(p.headerFields.opcode,true)===p.opcodes.takeFrame&&length===p.headerBytes+16&&input.getUint32(p.headerBytes+4,true)===0){const at=this._nelyx_wasm_buffer_data(output),size=this._nelyx_wasm_buffer_length(output),data=new DataView(this.HEAPU8.buffer,at,size);if(data.getUint16(p.headerFields.status,true)===p.statuses.ok){let cursor=p.headerBytes+p.stateBytes+data.getUint32(p.headerFields.count,true)*p.nodeBytes;for(let i=0;i<data.getUint32(p.headerBytes+p.stateFields.blobCount,true);++i){const type=data.getUint32(cursor,true),bytes=data.getUint32(cursor+16,true);if(type===p.providerFrameBlob){data.setBigUint64(cursor+48,data.getBigUint64(cursor+48,true)+1n,true);corrupt=false;break;}cursor+=24+Math.ceil(bytes/8)*8;}}}return output;};
          try{commit([c.paint(target,0xff455667)]);advance();assert.throws(()=>frames.acquire(),/Provider candidate.*cohorts/);assert.equal(corrupt,false);assert.equal(inspect().holds,0,'Malformed candidate leaked its acquired frame');}finally{module._nelyx_wasm_dispatch=dispatch;}
          const corrected=compare();assert(corrected.acquired.frame.observation.full,'Rejected candidate did not recover from the last published frame');publish(corrected);
          // Existing memory credit cannot be silently enlarged on quota failure.
          assert(frames.diagnostics.capacityShrinks>0,'Render never returned obsolete capacity');assert(frames.diagnostics.decodeRetired>0,'Render retained retired configuration IDs');assert(frames.diagnostics.decodeBytes<=frames.diagnostics.retainedBytes,'Render decoded history exceeds its live dictionary');frames.close();const rejecting=new ProviderFrames(module,actual.engine,{reserve(){throw Error('fixture quota');}} as any);
          try{commit([c.paint(target,0xff556677)]);advance();const acquired=rejecting.acquire(),full=ok(oracle,p.opcodes.takeFrame);assert.equal(acquired.frame.observation,null);assert.deepEqual(acquired.frame.nodes.map(projection),full.nodes.map(projection));assert.equal(rejecting.diagnostics.fallbacks,1);finish(actual,acquired.frame);finish(oracle,full);acquired.release();assert.equal(inspect().holds,0);}finally{rejecting.close();}
          let credits=0,oldReader,growthReader;const growing=new ProviderFrames(module,actual.engine,{reserve(kind,bytes){if(++credits>1)throw Error('Fixture refused capacity growth');const release=budget.reserve(kind,bytes);return()=>release();}}as any);
          try{
            commit([c.paint(target,0xff557788)]);advance();oldReader=growing.acquire();assert(oldReader.frame.observation);acquisitions.push([actual,oldReader.frame]);const oldFull=ok(oracle,p.opcodes.takeFrame);acquisitions.push([oracle,oldFull]);finish(actual,oldReader.frame);finish(oracle,oldFull);
            const larger=Array.from({length:64},()=>paint(0xff123456)[0]);commit(children.slice(6,14).map(node=>c.nativePaint(node,larger)));advance();growthReader=growing.acquire();acquisitions.push([actual,growthReader.frame]);const full=ok(oracle,p.opcodes.takeFrame);acquisitions.push([oracle,full]);assert.equal(growthReader.frame.observation,null,'Fixture did not require a larger frame capacity');assert.equal(growing.diagnostics.fallbacks,1);assert(growing.diagnostics.retiredBytes>0,'Growth refusal returned an old frame reader credit');assert.deepEqual(growthReader.frame.nodes.map(projection),full.nodes.map(projection));finish(actual,growthReader.frame);finish(oracle,full);growthReader.release();oldReader.release();assert.equal(growing.diagnostics.retiredBytes,0);assert.equal(inspect().holds,0);
          }finally{growthReader?.release();oldReader?.release();growing.close();}
          assert.equal(frames.diagnostics.reservedBytes,0);assert.equal(frames.diagnostics.retiredBytes,0);budget.close();
          console.log('Provider frames '+count+': full oracle, bounded paint rows, eager wrapper reuse, App isolation, geometry/order/removal/generation, cancel/gap/eviction, reader credit, quota and close PASS.');
        } catch(error) {console.error('Provider fixture '+count+': '+error.message,frames.diagnostics);throw error;} finally {
          for(const lease of leases)lease.release();
          for(const [model,frame] of acquisitions)if(frame.status===p.statuses.ok)call(model,p.opcodes.releaseFrame,body(24,v=>{v.setBigUint64(0,frame.submission,true);v.setBigUint64(8,frame.device,true);v.setUint32(20,1,true);}));
          frames.close();budget.close();
          for(const model of models){const closed=response(exchange(module,model.engine,packet(p.opcodes.closeSession,sessionOwner)));assert.equal(closed.status,p.statuses.ok);assert.equal(closed.reservedBytes,0n);module._nelyx_engine_destroy(model.engine);forgetHeapReport(module,model.engine);}
        }
      }
      // The full wire response fits, while row/blob dictionary overhead exceeds
      // the independent retained-observation quota. Its acquisition never
      // reaches Render and must be retired even when encoding the delta fails.
      const saturated=create();
      try {
        ok(saturated,p.opcodes.openView);ok(saturated,p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,2n,true);v.setFloat64(8,100,true);v.setFloat64(16,80,true);v.setFloat64(24,1,true);}));
        const root={slot:1,generation:1},children=Array.from({length:4000},(_,i)=>({slot:i+2,generation:1}));
        const changes=[c.create(root,'stack'),c.properties(root,{width:100,height:80}),...children.flatMap((node,i)=>[c.create(node,'box',0,{parent:root,index:i}),c.properties(node,{width:2,height:2}),c.nativePaint(node,paint(0xff123456))])];
        for(let offset=0;offset<changes.length;offset+=1024){const result=response(exchange(module,saturated.engine,transaction(owner,++saturated.transaction,saturated.document,changes.slice(offset,offset+1024))));assert.equal(result.status,p.statuses.accepted);saturated.document=result.document;}
        for(let i=0;i<512;++i){const state=ok(saturated,p.opcodes.contentStep,body(8,v=>v.setUint32(0,p.limits.contentPerStep,true)));if(!state.preparation||state.preparationReady)break;if(i===511)throw Error('Saturated content did not finish');}
        ok(saturated,p.opcodes.tick,body(8,v=>v.setFloat64(0,1,true)));
        const rejected=call(saturated,p.opcodes.takeFrame,body(16,v=>v.setUint32(0,p.inspectionFlags.providerFrameDelta,true)));
        assert.equal(rejected.status,p.statuses.budgetExceeded,'Fixture did not exceed the observation quota');assert.equal(rejected.holds,0,'Rejected provider dictionary reported an unissued hold');
        const recovered=ok(saturated,p.opcodes.takeFrame);assert.equal(recovered.nodes.length,4001,'Full frame fallback did not fit');ok(saturated,p.opcodes.releaseFrame,body(24,v=>{v.setBigUint64(0,recovered.submission,true);v.setBigUint64(8,recovered.device,true);v.setUint32(20,1,true);}));
        console.log('Provider dictionary quota: rejected cache retains no unissued hold, bounded full fallback and close PASS.');
      } finally {const closed=response(exchange(module,saturated.engine,packet(p.opcodes.closeSession,sessionOwner)));assert.equal(closed.status,p.statuses.ok);assert.equal(closed.reservedBytes,0n);module._nelyx_engine_destroy(saturated.engine);forgetHeapReport(module,saturated.engine);}
      `,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
  });
  await import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  Error.stackTraceLimit = stackTraceLimit;
  clearTimeout(watchdog);
}
