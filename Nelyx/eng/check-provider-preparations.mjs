// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Provider preparation checks exceeded 20 minutes');
}, 1200000);
const stackTraceLimit = Error.stackTraceLimit;
try {
  Error.stackTraceLimit = 0;
  const built = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
    import assert from 'node:assert/strict';import path from 'node:path';import{pathToFileURL}from'node:url';
    import{ProviderPreparations}from'./Nelyx/engine/platform/web/provider-preparations.ts';
    import{ContentActor}from'./Nelyx/engine/platform/web/actors.ts';
    import{ProviderFrames}from'./Nelyx/engine/platform/web/provider-frames.ts';
    import{ProviderBudget}from'./Nelyx/engine/platform/web/memory.ts';
    import{exchange,forgetHeapReport,owner,sessionOwner}from'./Nelyx/engine/platform/web/common.ts';
    import{ObservationStream}from'./Nelyx/runtime/engine-client/observation-stream.ts';
    import{commands as c,body,packet,response,transaction,protocol as p}from'./Nelyx/runtime/engine-client/codec.ts';
    import{acquireImageResources,imageResourceReadBytes,readImageResourceSlice}from'./Nelyx/runtime/engine-client/image-resource.ts';
    const factory=(await import(pathToFileURL(path.resolve(process.argv[2]??'Nelyx/engine/dist/single-worker/engine.mjs')).href)).default;
    const module=await factory();
    const call=(m,op,data?,id=0n)=>response(exchange(module,m.engine,packet(op,owner,data,id)));
    const ok=(m,op,data?)=>{const r=call(m,op,data);assert.equal(r.status,p.statuses.ok,'Core opcode '+op);return r;};
    const project=n=>Object.fromEntries(Object.entries(n).filter(([key])=>!['semantics','semanticTraversal','semanticGeometry','list','layoutBuilder','hasFocus','caretVisible'].includes(key)).map(([key,value])=>[key,key==='flags'?value&~(1|2|4|8|64|256|512):value]));
    const empty={engine:module._nelyx_wasm_open(1,1,p.schema,p.capabilities.protocol)},emptyBudget=new ProviderBudget(module,empty.engine,3),emptyStream=new ProviderPreparations(module,empty.engine,{reserve(){throw Error('Empty rows reserved capacity');}}as any);
    try{
      ok(empty,p.opcodes.openView);ok(empty,p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,2n,true);v.setFloat64(8,320,true);v.setFloat64(16,240,true);v.setFloat64(24,1,true);}));
      for(let i=0;i<8;++i)ok(empty,p.opcodes.contentStep,body(8,v=>v.setUint32(0,p.limits.contentPerStep,true)));
      const inspect=()=>ok(empty,p.opcodes.inspect,body(4,v=>v.setUint32(0,p.inspectionFlags.stateOnly,true))),baseline=inspect().memory.cpu,credit=emptyBudget.reserve(2,4096);
      try{
        credit.resize!(8192);assert.equal(inspect().memory.cpu,baseline+8192n);credit.resize!(2048);assert.equal(inspect().memory.cpu,baseline+2048n);
        const state=inspect();emptyBudget.set(5,Number(state.memory.limit-state.memory.total)-4096);
        try{assert.throws(()=>credit.resize!(16384),/Unified memory budget rejected/);assert.equal(inspect().memory.cpu,baseline+2048n,'Rejected resize changed its live account');}finally{emptyBudget.set(5,0);}
      }finally{credit();credit();}assert.equal(inspect().memory.cpu,baseline);assert.throws(()=>credit.resize!(1),/Invalid memory credit resize/);
      const guarded=emptyBudget.reserveWithHeadroom(2,4096,8192);
      try{
        assert.equal(inspect().memory.cpu,baseline+4096n,'Admission guard remained as a live cache charge');
        const budgetDispatch=module._nelyx_wasm_dispatch;let reports=0;
        module._nelyx_wasm_dispatch=function(engine,pointer,length){this._nelyx_wasm_refresh_heap();const input=new DataView(this.HEAPU8.buffer,pointer,length);if(engine===empty.engine&&input.getUint16(p.headerFields.opcode,true)===p.opcodes.memoryReport&&input.getUint32(p.headerBytes,true)===3&&input.getUint32(p.headerBytes+4,true)===2){++reports;assert.equal(length,p.headerBytes+p.memoryReportHeadroomBytes);assert.equal(input.getBigUint64(p.headerBytes+16,true),4096n);}return budgetDispatch(engine,pointer,length);};
        try{guarded.resize!(8192,4096);}finally{module._nelyx_wasm_dispatch=budgetDispatch;}assert.equal(reports,1,'Headroom used a transient second account update');assert.equal(inspect().memory.cpu,baseline+8192n);
        const state=inspect();emptyBudget.set(5,Number(state.memory.limit-state.memory.total)-4096);
        try{const peak=inspect().memory.peak;assert.throws(()=>guarded.resize!(12288,8192),/Unified memory budget rejected/);assert.equal(inspect().memory.cpu,baseline+8192n,'Rejected guard changed its previous credit');assert.equal(inspect().memory.peak,peak,'Rejected guard raised the committed peak');assert.throws(()=>guarded.resize!(8192,8192),/Unified memory budget rejected/);assert.throws(()=>emptyBudget.reserveWithHeadroom(2,1024,8192),/Unified memory budget rejected/);assert.equal(inspect().memory.cpu,baseline+8192n);}finally{emptyBudget.set(5,0);}
      }finally{guarded();}assert.equal(inspect().memory.cpu,baseline);
      console.log('Provider credit resize: atomic growth/shrink, quota rollback, idempotent release and close PASS.');
      const lease=emptyStream.acquire();assert.equal(lease.scene.status,p.statuses.ok);assert.equal(lease.scene.nodes.length,0);lease.release();
      assert.equal(emptyStream.diagnostics.emptyScenes,1);assert.equal(emptyStream.diagnostics.fallbacks,0);assert.equal(emptyStream.diagnostics.reservedBytes,0);
      console.log('Empty preparation: no dictionary capacity during resource startup, no quota fallback and close PASS.');
    }finally{emptyStream.close();emptyBudget.close();const closed=response(exchange(module,empty.engine,packet(p.opcodes.closeSession,sessionOwner)));assert.equal(closed.status,p.statuses.ok);assert.equal(closed.reservedBytes,0n);module._nelyx_engine_destroy(empty.engine);forgetHeapReport(module,empty.engine);}
    const race={engine:module._nelyx_wasm_open(1,1,p.schema,p.capabilities.protocol)},raceBudget=new ProviderBudget(module,race.engine,1),notes=[];
    let recorded=0;const actor=new ContentActor(module,race.engine,{discardMeasurements(){},acquireImageResources(scene){return{scene,release(){}};},acquireFontResources(){return()=>{};},prepare(){++recorded;throw Error('Fixture obsolete record');}}as any,value=>notes.push(value),false,raceBudget),dispatch=module._nelyx_wasm_dispatch;
    try{
      ok(race,p.opcodes.openView);ok(race,p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,2n,true);v.setFloat64(8,320,true);v.setFloat64(16,240,true);v.setFloat64(24,1,true);}));for(let i=0;i<8;++i)ok(race,p.opcodes.contentStep,body(8,v=>v.setUint32(0,p.limits.contentPerStep,true)));
      let inject=true;module._nelyx_wasm_dispatch=function(engine,pointer,length){this._nelyx_wasm_refresh_heap();const op=new DataView(this.HEAPU8.buffer,pointer,length).getUint16(p.headerFields.opcode,true),out=dispatch(engine,pointer,length);if(inject&&engine===race.engine&&op===p.opcodes.preparationScene&&length===p.headerBytes){inject=false;ok(race,p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,3n,true);v.setFloat64(8,360,true);v.setFloat64(16,260,true);v.setFloat64(24,1,true);}));for(let i=0;i<8;++i)ok(race,p.opcodes.contentStep,body(8,v=>v.setUint32(0,p.limits.contentPerStep,true)));}return out;};
      (actor as any).step();assert.equal(inject,false);assert.equal(recorded,1);assert(!notes.some(value=>value.kind==='preparation-error'),'An obsolete recording reported failure against the new candidate');actor.stop();assert.equal(ok(race,p.opcodes.preparationScene).metrics,3n);
      console.log('Content cancellation: old response during new metrics, obsolete record ignored, new candidate usable and close PASS.');
    }finally{module._nelyx_wasm_dispatch=dispatch;actor.stop();raceBudget.close();const closed=response(exchange(module,race.engine,packet(p.opcodes.closeSession,sessionOwner)));assert.equal(closed.status,p.statuses.ok);assert.equal(closed.reservedBytes,0n);module._nelyx_engine_destroy(race.engine);forgetHeapReport(module,race.engine);}
    for(const count of[64,2048]){
      const models=[0,1].map(()=>({engine:module._nelyx_wasm_open(1,1,p.schema,p.capabilities.protocol),document:0n,transaction:0n,time:0})),[actual,oracle]=models;
      const budget=new ProviderBudget(module,actual.engine,1),preparations=new ProviderPreparations(module,actual.engine,budget),frameBudget=new ProviderBudget(module,actual.engine,2),frames=new ProviderFrames(module,actual.engine,frameBudget),app=new ObservationStream(),leases=[];
      const root={slot:1,generation:1},children=Array.from({length:count},(_,i)=>({slot:i+2,generation:1})),target=children.at(-1),textNode=children[0],imageNode=children[2],image={slot:1,generation:1};
      const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
      const commit=changes=>{for(const m of models){const r=response(exchange(module,m.engine,transaction(owner,++m.transaction,m.document,changes)));assert.equal(r.status,p.statuses.accepted);m.document=r.document;}};
      const ready=()=>{for(const m of models){for(let i=0;i<256;++i){const s=ok(m,p.opcodes.contentStep,body(8,v=>v.setUint32(0,p.limits.contentPerStep,true)));if(s.preparationReady){assert.equal(s.preparationDocument,m.document,'Fixture reused an older ready candidate');break;}assert(s.preparation&&!s.measureRequest&&!s.layoutBuildPending,'Unexpected preparation dependency');if(i===255)throw Error('Fixture did not finish preparation');}}};
      const publish=()=>{for(const m of models){ok(m,p.opcodes.tick,body(8,v=>v.setFloat64(0,++m.time,true)));const lease=m===actual?frames.acquire():undefined,f=lease?.frame??ok(m,p.opcodes.takeFrame);assert.equal(f.status,p.statuses.ok);const data=body(24,v=>{v.setBigUint64(0,f.submission,true);v.setBigUint64(8,f.device,true);});try{ok(m,p.opcodes.releaseFrame,data);ok(m,p.opcodes.publish,data);}finally{lease?.release();}}};
      const appRead=()=>response(exchange(module,actual.engine,packet(p.opcodes.layoutSnapshot,owner,body(16,v=>{v.setUint32(0,p.inspectionFlags.appObservationDelta,true);v.setBigUint64(8,app.version,true);}))),{observationStream:app});
      const compare=()=>{const lease=preparations.acquire();leases.push(lease);const full=ok(oracle,p.opcodes.preparationScene);assert.equal(lease.scene.status,p.statuses.ok);assert.deepEqual(lease.scene.nodes.map(project),full.nodes.map(project),'Preparation delta differs from full eager oracle');
        const resolved=acquireImageResources(lease.scene,(r,o,n,prep)=>{const chunk=ok(actual,p.opcodes.imageResourceRead,imageResourceReadBytes(r,o,n,prep));return readImageResourceSlice(chunk)!;},n=>budget.reserve(4,n));
        try{assert.deepEqual(resolved.scene.blobs.find(b=>b.type===2)?.bytes,full.blobs.find(b=>b.type===2)?.bytes,'Preparation image bytes differ');}finally{resolved.release();}return lease;};
      try{
        for(const m of models){ok(m,p.opcodes.openView);ok(m,p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,2n,true);v.setFloat64(8,320,true);v.setFloat64(16,240,true);v.setFloat64(24,1,true);}));}
        const initial=[c.create(root,'stack'),c.properties(root,{width:320,height:240}),c.acquireResource(image,png),...children.flatMap((node,i)=>[c.create(node,i===0?'paragraph':i===2?'image':'box',0,{parent:root,index:i}),c.properties(node,{width:20,height:20})]),c.bindResource(imageNode,image),c.text(textNode,'original'),c.nativePaint(target,[{kind:'shape',color:0xff123456,shape:{kind:'rrect',radii:Array(8).fill(0),strokeWidth:0,strokeColor:0,strokeAlign:0}}]),c.semantics(target,{role:'button',label:'original'})];
        for(let i=0;i<initial.length;i+=1024)commit(initial.slice(i,i+1024));
        ready();const first=compare();assert(first.scene.observation.full);assert.equal(first.scene.nodes[1].text,'original');const same=compare();assert(!same.scene.observation.full);assert.equal(same.scene.observation.rowVisits,0);assert.equal(same.scene.nodes,first.scene.nodes);same.release();publish();appRead();const appVersion=app.version;
        commit([c.nativePaint(children[5],[{kind:'ripple',reference:children[5],color:0xff654321,progress:0.5,shape:{kind:'rrect',radii:Array(8).fill(0),strokeWidth:0,strokeColor:0,strokeAlign:0}}])]);for(const m of models)assert.equal(ok(m,p.opcodes.inspect,body(4,v=>v.setUint32(0,p.inspectionFlags.stateOnly,true))).activeDocument,m.document,'Fixture did not exercise retained live paint');publish();
        const frame=frames.acquire();assert.equal(frame.frame.status,p.statuses.notFound);frame.release();
        const hits=preparations.diagnostics.decodeHits,frameDeltas=frames.diagnostics.deltas;
        commit([c.properties(textNode,{width:21,height:20}),c.semantics(target,{role:'button',label:'updated'})]);ready();const changed=compare();
        assert(!changed.scene.observation.full);assert(changed.scene.observation.rowVisits<=192,'Small update serialized unrelated pages');assert(changed.scene.observation.preparation.comparedSlots<=192n,'Small update scanned unrelated slot pages');assert.equal(changed.scene.nodes[4],first.scene.nodes[4],'Unchanged eager wrapper rebuilt');assert.equal(changed.scene.nodes[1].text,'original');assert(preparations.diagnostics.decodeHits>hits,'Immutable text was decoded again');assert.equal(app.version,appVersion,'Content consumed the App subscription');assert.equal(frames.diagnostics.deltas,frameDeltas,'Content consumed the Render subscription');first.release();changed.release();publish();assert.equal(appRead().nodes.find(n=>n.node.slot===target.slot).semantics.label,'updated');
        commit([c.text(textNode,'replacement')]);ready();const text=compare();assert.equal(text.scene.nodes[1].text,'replacement');assert.equal(first.scene.nodes[1].text,'original','Previous text reader mutated');text.release();publish();
        commit([c.move(children[1],root,count-1)]);ready();compare().release();publish();
        commit([c.destroy(children[3],true)]);ready();const removed=compare();assert.equal(removed.scene.observation.removedRows,1);removed.release();publish();
        const recycled={slot:children[3].slot,generation:2};commit([c.create(recycled,'box',0,{parent:root,index:count-1}),c.properties(recycled,{width:11,height:13})]);ready();compare().release();publish();
        commit([c.properties(target,{width:22,height:20})]);ready();const canceled=compare();canceled.release();
        for(const m of models){const state=ok(m,p.opcodes.inspect,body(4,v=>v.setUint32(0,p.inspectionFlags.stateOnly,true)));ok(m,p.opcodes.preparationResult,body(24,v=>{v.setBigUint64(0,state.preparation,true);v.setBigUint64(8,state.metrics,true);v.setBigUint64(16,state.device,true);}));}
        commit([c.properties(target,{width:23,height:20})]);ready();const replacement=compare();assert(!replacement.scene.observation.full);assert.notEqual(replacement.scene.preparation,canceled.scene.preparation);assert.equal(replacement.scene.observation.preparation.basedOn,canceled.scene.preparation,'Dictionary lost its delivered candidate identity');replacement.release();publish();
        commit([c.properties(target,{width:24,height:20})]);ready();const held=compare();preparations.pressure(true);assert(preparations.diagnostics.retiredBytes>0);assert.equal(preparations.diagnostics.reservedBytes,0);assert.equal(held.scene.nodes[1].text,'replacement');held.release();assert.equal(preparations.diagnostics.retiredBytes,0);publish();preparations.pressure(false);
        commit([c.properties(target,{width:25,height:20})]);ready();const evicted=compare();assert(evicted.scene.observation.full);evicted.release();publish();
        preparations.beginResize();commit([c.properties(target,{width:25.5,height:20})]);ready();const surface=compare();assert.equal(surface.scene.observation,null,'Surface replacement borrowed preparation dictionary credit');assert.equal(preparations.diagnostics.reservedBytes,0);assert.equal(preparations.diagnostics.resizeScenes,1);surface.release();publish();preparations.endResize();
        for(const m of models)ok(m,p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,3n,true);v.setFloat64(8,360,true);v.setFloat64(16,260,true);v.setFloat64(24,1,true);}));ready();const resized=compare();assert(resized.scene.observation.full);resized.release();publish();
        for(const m of models)ok(m,p.opcodes.fontRevision,body(16,v=>v.setBigUint64(0,2n,true)));ready();const font=compare();assert(font.scene.observation.full);font.release();publish();
        for(const m of models)ok(m,p.opcodes.device,body(16,v=>v.setBigUint64(0,2n,true)));ready();const device=compare();assert(device.scene.observation.full);device.release();publish();
        // A corrupt delivered base must not install rows or advance JS state.
        const dispatch=module._nelyx_wasm_dispatch;let inject=true;
        module._nelyx_wasm_dispatch=function(engine,pointer,length){const out=dispatch(engine,pointer,length);this._nelyx_wasm_refresh_heap();const input=new DataView(this.HEAPU8.buffer,pointer,length);if(inject&&engine===actual.engine&&input.getUint16(p.headerFields.opcode,true)===p.opcodes.preparationScene&&length===p.headerBytes+16&&input.getUint32(p.headerBytes+4,true)===0){const at=this._nelyx_wasm_buffer_data(out),size=this._nelyx_wasm_buffer_length(out),data=new DataView(this.HEAPU8.buffer,at,size);if(data.getUint16(p.headerFields.status,true)===p.statuses.ok){let cursor=p.headerBytes+p.stateBytes+data.getUint32(p.headerFields.count,true)*p.nodeBytes;for(let i=0;i<data.getUint32(p.headerBytes+p.stateFields.blobCount,true);++i){const type=data.getUint32(cursor,true),bytes=data.getUint32(cursor+16,true);if(type===p.observationDeltaBlob){assert(!(data.getUint32(cursor+40,true)&1));data.setBigUint64(cursor+24,data.getBigUint64(cursor+24,true)+1n,true);inject=false;break;}cursor+=24+Math.ceil(bytes/8)*8;}}}return out;};
        try{commit([c.properties(target,{width:26,height:20})]);ready();const gap=compare();assert.equal(inject,false);assert(gap.scene.observation.full);assert.equal(preparations.diagnostics.resyncs,1);gap.release();publish();}finally{module._nelyx_wasm_dispatch=dispatch;}
        let corrupt=true;
        module._nelyx_wasm_dispatch=function(engine,pointer,length){const out=dispatch(engine,pointer,length);this._nelyx_wasm_refresh_heap();const input=new DataView(this.HEAPU8.buffer,pointer,length);if(corrupt&&engine===actual.engine&&input.getUint16(p.headerFields.opcode,true)===p.opcodes.preparationScene&&length===p.headerBytes+16&&input.getUint32(p.headerBytes+4,true)===0){const at=this._nelyx_wasm_buffer_data(out),size=this._nelyx_wasm_buffer_length(out),data=new DataView(this.HEAPU8.buffer,at,size);if(data.getUint16(p.headerFields.status,true)===p.statuses.ok){let cursor=p.headerBytes+p.stateBytes+data.getUint32(p.headerFields.count,true)*p.nodeBytes;for(let i=0;i<data.getUint32(p.headerBytes+p.stateFields.blobCount,true);++i){const type=data.getUint32(cursor,true),bytes=data.getUint32(cursor+16,true);if(type===p.providerPreparationBlob){data.setBigUint64(cursor+48,data.getBigUint64(cursor+48,true)+1n,true);corrupt=false;break;}cursor+=24+Math.ceil(bytes/8)*8;}}}return out;};
        try{commit([c.properties(target,{width:26.5,height:20})]);ready();const before=preparations.diagnostics;assert.throws(()=>preparations.acquire(),/Provider preparation.*cohorts/);assert.equal(corrupt,false);assert.equal(preparations.diagnostics.deltas,before.deltas);assert.equal(preparations.diagnostics.fulls,before.fulls);}finally{module._nelyx_wasm_dispatch=dispatch;}
        const recovered=compare();assert(recovered.scene.observation.full);recovered.release();publish();
        assert(preparations.diagnostics.capacityShrinks>0,'Content never returned obsolete capacity');assert(preparations.diagnostics.decodeRetired>0,'Content retained retired configuration IDs');assert(preparations.diagnostics.decodeBytes<=preparations.diagnostics.retainedBytes,'Content decoded history exceeds its live dictionary');preparations.close();const rejecting=new ProviderPreparations(module,actual.engine,{reserve(){throw Error('fixture quota');}}as any);
        try{commit([c.properties(target,{width:27,height:20})]);ready();const lease=rejecting.acquire();assert.equal(lease.scene.observation,null);assert.equal(rejecting.diagnostics.fallbacks,1);lease.release();publish();}finally{rejecting.close();}
        let credits=0,oldReader,growthReader;const growing=new ProviderPreparations(module,actual.engine,{reserve(kind,bytes){if(++credits>1)throw Error('Fixture refused capacity growth');const release=budget.reserve(kind,bytes);return()=>release();}}as any);
        try{
          commit([c.properties(target,{width:28,height:20})]);ready();oldReader=growing.acquire();assert(oldReader.scene.observation);publish();
          const larger=Array.from({length:64},()=>({kind:'shape' as const,color:0xff123456,shape:{kind:'rrect' as const,radii:Array(8).fill(0),strokeWidth:0,strokeColor:0,strokeAlign:0}}));
          commit([c.text(textNode,'growth'.repeat(10000)),...children.slice(6,14).map(node=>c.nativePaint(node,larger))]);ready();growthReader=growing.acquire();assert.equal(growthReader.scene.observation,null,'Fixture did not require a larger capacity');assert.equal(growing.diagnostics.fallbacks,1);assert(growing.diagnostics.retiredBytes>0,'Growth refusal returned an old reader credit');assert.equal(oldReader.scene.nodes[1].text,'replacement');growthReader.release();oldReader.release();assert.equal(growing.diagnostics.retiredBytes,0);publish();
        }finally{growthReader?.release();oldReader?.release();growing.close();}
        assert.equal(preparations.diagnostics.reservedBytes,0);assert.equal(preparations.diagnostics.retiredBytes,0);
        console.log('Provider preparations '+count+': full oracle, shared-page candidates, immutable text/rows, image reads, App/frame isolation, order/generation, cancel/gap/global/eviction, capacity fallback and close PASS.');
      }catch(error){console.error('Preparation fixture '+count+': '+error.message);throw error;}
      finally{for(const lease of leases)lease.release();preparations.close();frames.close();budget.close();frameBudget.close();for(const m of models){const closed=response(exchange(module,m.engine,packet(p.opcodes.closeSession,sessionOwner)));assert.equal(closed.status,p.statuses.ok);assert.equal(closed.reservedBytes,0n);module._nelyx_engine_destroy(m.engine);forgetHeapReport(module,m.engine);}}
    }
    const saturated={engine:module._nelyx_wasm_open(1,1,p.schema,p.capabilities.protocol),document:0n,transaction:0n},quotaBudget=new ProviderBudget(module,saturated.engine,1),quotaStream=new ProviderPreparations(module,saturated.engine,quotaBudget);
    try{
      ok(saturated,p.opcodes.openView);ok(saturated,p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,2n,true);v.setFloat64(8,320,true);v.setFloat64(16,240,true);v.setFloat64(24,1,true);}));
      const root={slot:1,generation:1},children=Array.from({length:4000},(_,i)=>({slot:i+2,generation:1})),paint=[{kind:'shape',color:0xff123456,shape:{kind:'rrect',radii:Array(8).fill(0),strokeWidth:0,strokeColor:0,strokeAlign:0}}];
      const commands=[c.create(root,'stack'),c.properties(root,{width:320,height:240}),...children.flatMap((node,i)=>[c.create(node,'box',0,{parent:root,index:i}),c.properties(node,{width:10,height:10}),c.nativePaint(node,paint)])];
      for(let i=0;i<commands.length;i+=1024){const r=response(exchange(module,saturated.engine,transaction(owner,++saturated.transaction,saturated.document,commands.slice(i,i+1024))));assert.equal(r.status,p.statuses.accepted);saturated.document=r.document;}
      for(let i=0;i<256;++i){const s=ok(saturated,p.opcodes.contentStep,body(8,v=>v.setUint32(0,p.limits.contentPerStep,true)));if(s.preparationReady)break;if(i===255)throw Error('Quota fixture did not finish');}
      const lease=quotaStream.acquire();assert.equal(lease.scene.status,p.statuses.ok);assert.equal(lease.scene.observation,null);assert.equal(lease.scene.nodes.length,4001);assert.equal(quotaStream.diagnostics.fallbacks,1);lease.release();
      console.log('Preparation dictionary quota: bounded full fallback, no frame holder and complete close PASS.');
    }finally{quotaStream.close();quotaBudget.close();const closed=response(exchange(module,saturated.engine,packet(p.opcodes.closeSession,sessionOwner)));assert.equal(closed.status,p.statuses.ok);assert.equal(closed.reservedBytes,0n);module._nelyx_engine_destroy(saturated.engine);forgetHeapReport(module,saturated.engine);}
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
    'data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  Error.stackTraceLimit = stackTraceLimit;
  clearTimeout(watchdog);
}
