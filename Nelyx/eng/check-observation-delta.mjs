// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Observation delta checks exceeded 20 minutes');
}, 1200000);
try {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
    import assert from 'node:assert/strict';
    import {pathToFileURL} from 'node:url';import path from 'node:path';
    import {EngineClient} from './Nelyx/runtime/engine-client/client.ts';
    import {createWasmTransport} from './Nelyx/runtime/engine-client/wasm.ts';
    import {SceneBlobJournal} from './Nelyx/runtime/engine-client/scene-blobs.ts';
    import {ObservationGapError,ObservationStream} from './Nelyx/runtime/engine-client/observation-stream.ts';
    import type {EngineNodeSnapshot} from './Nelyx/runtime/engine-client/codec.ts';
    import {commands as c,body,packet,response as decodeResponse,protocol as p,appObservationBody} from './Nelyx/runtime/engine-client/codec.ts';
    const materialize=node=>Object.fromEntries([...new Set([...Object.keys(node),...Object.getOwnPropertyNames(Object.getPrototypeOf(node)).filter(key=>Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node),key)?.get)])].map(key=>[key,node[key]]));
    const sameRows=(actual,expected,label)=>{assert.equal(actual.length,expected.length,label+' row count');for(let i=0;i<actual.length;++i)assert.deepEqual(materialize(actual[i]),materialize(expected[i]),label+' row '+i);};
    // Membership is independent from row values. Exercise malformed deltas
    // against an accepted base, including same-size replacement/generation
    // changes that an order-length-only check would incorrectly accept.
    const membership=new ObservationStream(),row=(slot,generation=1)=>Object.freeze({node:Object.freeze({slot,generation})}) as EngineNodeSnapshot;
    const m1=row(1),m2=row(2),m3=row(3),m4=row(4),m2next=row(2,2);
    const membershipBlobs=(base,version,changed,removed=[],order?)=>{
      const bytes=body(p.observationDeltaBytes+(removed.length+(order?.length??0))*8,v=>{
        v.setBigUint64(0,base,true);v.setBigUint64(8,version,true);v.setUint32(16,(base===0n?1:0)|(order?2:0),true);
        v.setUint32(20,removed.length,true);v.setUint32(24,order?.length??0,true);
        for(const [offset,value] of [[48,1n],[56,2n],[64,1n],[72,1n]])v.setBigUint64(offset,value,true);
        [...removed,...(order??[])].forEach((node,i)=>{v.setUint32(p.observationDeltaBytes+i*8,node.slot,true);v.setUint32(p.observationDeltaBytes+i*8+4,node.generation,true);});
      });
      return [{type:p.observationDeltaBlob,handle:{slot:0,generation:0},bytes},...changed.map(node=>({type:p.observationReferencesBlob,handle:node.node,bytes:new Uint8Array()}))];
    };
    const adoptMembership=(base,version,changed,removed=[],order?)=>{const plan=membership.prepare(membershipBlobs(base,version,changed,removed,order),changed),nodes=plan.merge(changed);plan.commit();return nodes;};
    const initialMembers=adoptMembership(0n,1n,[m1,m2,m3],[],[m1.node,m2.node,m3.node]),m2changed=row(2);
    const valueChanged=adoptMembership(1n,2n,[m2changed]);
    assert.deepEqual(valueChanged,[m1,m2changed,m3]);assert.equal(valueChanged[0],initialMembers[0]);
    assert.equal(membership.counters.membershipReuses,1);assert.equal(membership.counters.membershipOrderVisits,3);
    for(const changed of [[m4],[m2next]])assert.throws(()=>membership.prepare(membershipBlobs(2n,3n,changed),changed),/membership/);
    assert.equal(membership.version,2n,'Malformed value-only membership advanced the base');
    assert.throws(()=>membership.prepare(membershipBlobs(2n,3n,[m4],[m3.node]),[m4]),/membership/);
    const reordered=adoptMembership(2n,3n,[],[],[m3.node,m2.node,m1.node]);assert.deepEqual(reordered,[m3,m2changed,m1]);
    const replaced=adoptMembership(3n,4n,[m2next],[m2.node],[m3.node,m2next.node,m1.node]);assert.deepEqual(replaced,[m3,m2next,m1]);
    assert.deepEqual(initialMembers,[m1,m2,m3],'Membership updates mutated an older snapshot');membership.clear();assert.equal(membership.byteLength,0);
    const factory=(await import(pathToFileURL(path.resolve(process.argv[2]??'Nelyx/engine/dist/single-worker/engine.mjs')).href)).default;
    const transport=createWasmTransport(await factory()),client=await EngineClient.connect(transport);
    try {
      const view=await client.openView(1),node={slot:1,generation:1},parent={slot:2,generation:1},sibling={slot:3,generation:1};
      const request=async(op,data?)=>{const r=await view.request(op,data);assert.equal(r.status,p.statuses.ok,'opcode '+op);return r;};
      await request(p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,2n,true);v.setFloat64(8,320,true);v.setFloat64(16,240,true);v.setFloat64(24,1,true);}));
      await view.commit([c.create(parent,'stack'),c.create(node,'box',0,{parent}),c.create(sibling,'box'),
        c.properties(node,{width:100,height:100}),c.semantics(node,{role:'button',label:'first'})]);
      let clock=0;
      const activate=async()=>{for(let i=0;i<20;++i){const s=await request(p.opcodes.contentStep,body(8,v=>v.setUint32(0,p.limits.contentPerStep,true)));if(!s.preparation||s.preparationReady)break;}await request(p.opcodes.tick,body(8,v=>v.setFloat64(0,++clock,true)));};
      const finishPublication=async()=>{
        const frame=await request(p.opcodes.takeFrame),done=body(24,v=>{v.setBigUint64(0,frame.submission,true);v.setBigUint64(8,frame.device,true);v.setUint32(16,1,true);});
        await request(p.opcodes.releaseFrame,done);new DataView(done.buffer).setUint32(16,0,true);await request(p.opcodes.publish,done);};
      const publish=async()=>{await activate();await finishPublication();};
      await publish();
      const first=await view.observeApp(p.opcodes.semanticsSnapshot),full=await request(p.opcodes.semanticsSnapshot,appObservationBody());
      assert(first.observation.full);assert.deepEqual(first.nodes.map(materialize),full.nodes.map(materialize));
      assert.equal(first.observation.cohorts.published.document,first.publishedDocument);
      assert.equal(first.observation.cohorts.active.document,first.activeDocument);
      assert.equal(first.observation.cohorts.published.font,1n);
      const rejectedWire=await transport.exchange(packet(p.opcodes.semanticsSnapshot,view.owner,body(16,v=>v.setUint32(0,p.inspectionFlags.appObservationDelta,true)))),rejectedStream=new ObservationStream();
      new DataView(rejectedWire.buffer,rejectedWire.byteOffset,rejectedWire.byteLength).setUint16(p.headerFields.status,p.statuses.budgetExceeded,true);
      assert.throws(()=>decodeResponse(rejectedWire,{appObservation:true,observationStream:rejectedStream}),/Rejected observations/);
      assert.equal(rejectedStream.version,0n,'A rejected provider packet advanced the JS base');
      const unchanged=await view.observeApp(p.opcodes.semanticsSnapshot);
      assert.equal(unchanged.nodes,first.nodes);assert.equal(unchanged.observation.rowVisits,0);assert.equal(unchanged.observation.registeredBlobs,0);
      const registered=first.blobs.find(b=>b.type===p.observationRegistrationBlob);registered?.bytes.fill(255);
      assert.equal((await view.observeApp(p.opcodes.semanticsSnapshot)).nodes.find(n=>n.node.slot===1).semantics.label,'first','Public blob mutation poisoned private registrations');
      const layout=await view.observeApp(p.opcodes.layoutSnapshot,[node]);assert.deepEqual(layout.nodes.map(n=>n.node),[node,parent]);
      await view.commit([c.paint(node,0xff123456)]);
      const accepted=await view.observeApp(p.opcodes.layoutSnapshot,[node]);
      assert(accepted.document>accepted.activeDocument);assert.equal(accepted.nodes,layout.nodes,'Accepted configuration replaced active rows');
      await activate();
      const active=await view.observeApp(p.opcodes.layoutSnapshot,[node]);assert.notEqual(active.nodes,layout.nodes);
      const oldPublication=await view.observeApp(p.opcodes.semanticsSnapshot);assert.equal(oldPublication.nodes,first.nodes,'Active layout replaced unpublished semantics');
      await finishPublication();
      const painted=await view.observeApp(p.opcodes.semanticsSnapshot);
      assert.equal(painted.observation.changedRows,1);assert.equal(painted.observation.registeredBlobs,0);
      assert.equal(painted.observation.rowVisits,1,'One paint update rebuilt unrelated native observation candidates');
      assert.equal(painted.nodes.find(n=>n.node.slot===3),first.nodes.find(n=>n.node.slot===3));
      assert.equal(painted.nodes.find(n=>n.node.slot===1).semantics,first.nodes.find(n=>n.node.slot===1).semantics);
      await view.commit([c.semantics(node,{role:'button',label:'next'})]);
      assert.equal((await view.inspectState()).transactionCost.fullValidations,0n);
      await publish();
      // Simulate an observation that reaches Core but whose response is lost.
      const lost=body(16,v=>{v.setUint32(0,p.inspectionFlags.appObservationDelta,true);v.setBigUint64(8,painted.observation.version,true);});
      await transport.exchange(packet(p.opcodes.semanticsSnapshot,view.owner,lost));
      const recovered=await view.observeApp(p.opcodes.semanticsSnapshot);assert(recovered.observation.full,'Unknown native base did not resync');
      assert.equal(recovered.nodes.find(n=>n.node.slot===1).semantics.label,'next');assert.equal(first.nodes.find(n=>n.node.slot===1).semantics.label,'first');
      const original=view.request.bind(view);let rejectOnce=true;
      view.request=async(...args)=>{if(rejectOnce){rejectOnce=false;throw new ObservationGapError('injected gap');}return original(...args);};
      assert((await view.observeApp(p.opcodes.semanticsSnapshot)).observation.full);view.request=original;
      assert.equal(client.observationStream(view.owner,p.opcodes.semanticsSnapshot).counters.resyncs,1);
      await view.commit([c.destroy(node,true)]);await publish();
      const removed=await view.observeApp(p.opcodes.semanticsSnapshot);assert.equal(removed.observation.removedRows,1);assert(!removed.nodes.some(n=>n.node.slot===1));
      const empty=await view.observeApp(p.opcodes.layoutSnapshot,[{slot:1,generation:2}]);assert.equal(empty.nodes.length,0);
      await request(p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,3n,true);v.setFloat64(8,400,true);v.setFloat64(16,240,true);v.setFloat64(24,1,true);}));
      const resizing=await view.observeApp(p.opcodes.layoutSnapshot,[parent]);
      assert.equal(resizing.observation.cohorts.accepted.metrics,3n);assert.equal(resizing.observation.cohorts.active.metrics,2n);
      assert.equal(resizing.observation.cohorts.published.metrics,2n,'Unpublished metrics replaced the published cohort');
      await view.close();assert.equal(client.diagnostics().observations.length,0,'Closed owner retained dictionaries');
      const blobs=await client.openView(1,2),a={slot:1,generation:1},b={slot:2,generation:1};
      const journal=new SceneBlobJournal(()=>7);
      const commit=async changes=>{const plan=journal.prepare(changes);try{await blobs.commit(plan.commands);plan.accept();}catch(e){plan.reject();throw e;}};
      await commit([c.create(a,'paragraph'),c.create(b,'paragraph'),c.paragraphOptions(a,{fontFamily:'same',locale:'en'}),c.paragraphOptions(b,{fontFamily:'same',locale:'en'})]);
      const cost=(await blobs.inspectState()).transactionCost;assert.equal(cost.blobRegistrations,1n);assert.equal(cost.blobBindings,2n);
      await commit([c.paragraphOptions(a,{fontFamily:'collision',locale:'en'})]);assert.equal(journal.diagnostics().entries,2,'Hash collision aliased different bytes');
      await commit([c.paragraphOptions(a,{fontFamily:'same',locale:'en'})]);assert.equal(journal.diagnostics().entries,1);
      const before=journal.diagnostics();await assert.rejects(commit([c.paragraphOptions({slot:99,generation:1},{fontFamily:'rejected'})]));
      assert.deepEqual(journal.diagnostics(),before,'NACK adopted provisional registrations');
      const oversized=new SceneBlobJournal(),emptyJournal=oversized.diagnostics();
      const largeInputs=Array.from({length:1100},(_,i)=>c.semantics({slot:i+1,generation:1},{role:'button',label:String(i)+':'+ 'x'.repeat(4000)}));
      assert.throws(()=>oversized.prepare(largeInputs),/quota|budget/i);
      assert.deepEqual(oversized.diagnostics(),emptyJournal,'A saturated blob journal kept provisional bytes or IDs');
      await commit([c.destroy(a,true),c.destroy(b,true)]);assert.equal(journal.diagnostics().bytes,0);
      await blobs.close();
      const storage=await client.openView(1,3),handles=Array.from({length:24},(_,i)=>({slot:i+1,generation:1}));
      assert.equal((await storage.request(p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,2n,true);v.setFloat64(8,320,true);v.setFloat64(16,240,true);v.setFloat64(24,1,true);}))).status,p.statuses.ok);
      await storage.commit(handles.flatMap((n,i)=>[c.create(n,'box'),c.properties(n,{width:20+i,height:40}),
        c.semantics(n,{role:'button',label:String(i)+':'+ 'retained label '.repeat(120)})]));
      const publishStorage=async(owner=storage)=>{
        for(let i=0;i<=Math.ceil(p.limits.nodes/p.limits.contentPerStep)+2;++i){const s=await owner.request(p.opcodes.contentStep,body(8,v=>v.setUint32(0,p.limits.contentPerStep,true)));assert.equal(s.status,p.statuses.ok);if(!s.preparation||s.preparationReady)break;}
        await owner.request(p.opcodes.tick,body(8,v=>v.setFloat64(0,++clock,true)));
        const frame=await owner.request(p.opcodes.takeFrame),done=body(24,v=>{v.setBigUint64(0,frame.submission,true);v.setBigUint64(8,frame.device,true);v.setUint32(16,1,true);});
        if(frame.status!==p.statuses.ok){const events=await owner.request(p.opcodes.pollEvents);throw Error('Fixture frame failure '+JSON.stringify(events.events,(_,v)=>typeof v==='bigint'?String(v):v));}
        assert.equal(frame.status,p.statuses.ok,'Fixture did not prepare an actual frame '+JSON.stringify({owner:owner.owner,preparation:String(frame.preparation),failed:String(frame.failedDocument),nodes:frame.nodeCount,active:String(frame.activeDocument)}));
        await owner.request(p.opcodes.releaseFrame,done);new DataView(done.buffer).setUint32(16,0,true);await owner.request(p.opcodes.publish,done);
      };
      await publishStorage();
      const originalRows=await storage.observeApp(p.opcodes.semanticsSnapshot),survivor=originalRows.nodes[0];
      assert.equal(originalRows.nodes.length,24);
      const stream=client.observationStream(storage.owner,p.opcodes.semanticsSnapshot);
      assert(stream.counters.rowCompactions>0,'Large initial registrations pinned the transport backing');
      const originalCopyBytes=stream.counters.registrationCopyBytes;
      const forceFull=await storage.request(p.opcodes.semanticsSnapshot,body(16,v=>v.setUint32(0,p.inspectionFlags.appObservationDelta,true)));
      // request() also validates and adopts its delta, like the ordinary observation path.
      assert(forceFull.observation.full);assert.equal(stream.counters.registrationCopyBytes,originalCopyBytes,'Known immutable IDs copied again on resync');
      const kept=forceFull.nodes[0],expected={width:kept.width,parent:kept.parent,matrix:kept.matrix,bounds:kept.bounds,resource:kept.resource,coverage:kept.preparedCoverage,motion:kept.motion};
      for(const batch of [handles.slice(1,13),handles.slice(13)]){
        await storage.commit(batch.map(n=>c.paint(n,0xffabcdef)));await publishStorage();
        const delta=await storage.observeApp(p.opcodes.semanticsSnapshot);
        assert.equal(delta.nodes[0],kept,'Row relocation changed immutable identity');
        assert(stream.byteLength<=Number(delta.observation.retainedBytes),'Live row backing fragmentation escaped the native cache bound');
      }
      assert.deepEqual({width:kept.width,parent:kept.parent,matrix:kept.matrix,bounds:kept.bounds,resource:kept.resource,coverage:kept.preparedCoverage,motion:kept.motion},expected,'Relocation changed lazy/cached snapshot values');
      for(const property of ['parent','matrix','bounds','resource','preparedCoverage'])assert.equal(kept[property],property==='preparedCoverage'?expected.coverage:expected[property],'Relocation replaced a materialized immutable value: '+property);
      assert.equal(kept.motion,0n,'A zero BigInt cache entry became absent');
      assert.equal(survivor.color,0);assert.equal(originalRows.nodes[1].color,0,'An old snapshot was overwritten by a delta');
      const stable=await storage.observeApp(p.opcodes.semanticsSnapshot),compactions=stream.counters.rowCompactions;
      assert.equal((await storage.observeApp(p.opcodes.semanticsSnapshot)).nodes,stable.nodes);
      assert.equal(stream.counters.rowCompactions,compactions,'Unchanged rows were recopied');
      await storage.close();assert.equal(stream.byteLength,0);
      for(const [caseIndex,width] of [64,2048].entries()){
        const bounded=await client.openView(1,4+caseIndex),handles=Array.from({length:width},(_,i)=>({slot:i+1,generation:1})),root=handles[0],target=handles[1];
        await bounded.request(p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,2n,true);v.setFloat64(8,320,true);v.setFloat64(16,240,true);v.setFloat64(24,1,true);}));
        await bounded.commit([...handles.map((n,i)=>i?c.create(n,'box',0,{parent:root,index:i-1}):c.create(n,'stack')),c.properties(target,{width:20,height:20}),c.semantics(target,{role:'button',label:'retained'})]);
        await publishStorage(bounded);const before=await bounded.observeApp(p.opcodes.semanticsSnapshot);
        const referenceCosts=client.observationStream(bounded.owner,p.opcodes.semanticsSnapshot).counters;
        const referenceVisits=referenceCosts.referenceVisits;
        const membershipVisits=referenceCosts.membershipOrderVisits,membershipReuses=referenceCosts.membershipReuses;
        await bounded.commit([c.paint(target,0xff112233,2)]);await publishStorage(bounded);
        const changed=await bounded.observeApp(p.opcodes.semanticsSnapshot),oracle=await bounded.request(p.opcodes.semanticsSnapshot,appObservationBody());
        assert.equal(changed.observation.rowVisits,1,'Native paint observation grew with '+width+' unrelated nodes');
        assert.equal(changed.observation.changedRows,1);assert.equal(changed.nodes[2],before.nodes[2]);
        assert.equal(referenceCosts.referenceVisits,referenceVisits,'Paint delta rescanned unrelated immutable bindings at '+width+' nodes');
        assert.equal(referenceCosts.membershipOrderVisits,membershipVisits,'Paint delta rescanned the retained order at '+width+' nodes');
        assert.equal(referenceCosts.membershipReuses,membershipReuses+1,'Paint delta did not retain its validated membership');
        assert.deepEqual(changed.nodes.map(materialize),oracle.nodes.map(materialize),'Incremental paint observation differs from full oracle');
        await bounded.commit([c.properties(target,{x:4,width:30,height:20})]);await publishStorage(bounded);
        const geometry=await bounded.observeApp(p.opcodes.semanticsSnapshot),fullGeometry=await bounded.request(p.opcodes.semanticsSnapshot,appObservationBody());
        assert(geometry.observation.rowVisits<=2,'Local geometry revisited unrelated rows: '+geometry.observation.rowVisits);
        sameRows(geometry.nodes,fullGeometry.nodes,'geometry');
        const layoutBefore=await bounded.observeApp(p.opcodes.layoutSnapshot);
        await bounded.commit([c.semantics(target,{role:'button',label:'changed metadata'})]);await publishStorage(bounded);
        const metadata=await bounded.observeApp(p.opcodes.semanticsSnapshot),fullMetadata=await bounded.request(p.opcodes.semanticsSnapshot,appObservationBody());
        assert(metadata.observation.rowVisits<=2,'Semantics update grew with unrelated scene size');
        sameRows(metadata.nodes,fullMetadata.nodes,'semantics');
        const layoutAfter=await bounded.observeApp(p.opcodes.layoutSnapshot),fullLayout=await bounded.request(p.opcodes.layoutSnapshot,appObservationBody());
        assert(layoutAfter.observation.rowVisits<=2,'Active layout rebuilt unrelated candidates');
        sameRows(layoutAfter.nodes,fullLayout.nodes,'active layout');
        assert.equal(layoutAfter.nodes[3],layoutBefore.nodes[3]);
        await bounded.commit([c.paint(target,0xff010203)]);await publishStorage(bounded);
        await bounded.commit([c.paint(handles[2],0xff112233)]);await publishStorage(bounded);
        const skipped=await bounded.observeApp(p.opcodes.semanticsSnapshot),fullSkipped=await bounded.request(p.opcodes.semanticsSnapshot,appObservationBody());
        assert(skipped.observation.rowVisits<=3,'Skipped publications lost their bounded dirty journal');
        sameRows(skipped.nodes,fullSkipped.nodes,'skipped publication');
        const retired=handles.at(-1);await bounded.commit([c.destroy(retired,true)]);await publishStorage(bounded);
        const removed=await bounded.observeApp(p.opcodes.semanticsSnapshot),fullRemoved=await bounded.request(p.opcodes.semanticsSnapshot,appObservationBody());
        assert.equal(removed.observation.removedRows,1);assert(removed.observation.rowVisits<=2);
        sameRows(removed.nodes,fullRemoved.nodes,'removal');
        const recycled={slot:retired.slot,generation:2};await bounded.commit([c.create(recycled,'box',0,{parent:root,index:width-2})]);await publishStorage(bounded);
        const recycledRows=await bounded.observeApp(p.opcodes.semanticsSnapshot),fullRecycled=await bounded.request(p.opcodes.semanticsSnapshot,appObservationBody());
        assert(recycledRows.observation.rowVisits<=2);sameRows(recycledRows.nodes,fullRecycled.nodes,'recycling');
        const recycledLayout=await bounded.observeApp(p.opcodes.layoutSnapshot),fullRecycledLayout=await bounded.request(p.opcodes.layoutSnapshot,appObservationBody());
        sameRows(recycledLayout.nodes,fullRecycledLayout.nodes,'recycled layout');
        if(caseIndex===0){
          await bounded.commit([c.motion(root,1n,0n,0.5,10)]);await publishStorage(bounded);await bounded.observeApp(p.opcodes.semanticsSnapshot);
          await bounded.commit([c.paint(target,0xff556677,2)]);await publishStorage(bounded);
          const animated=await bounded.observeApp(p.opcodes.semanticsSnapshot),fullAnimated=await bounded.request(p.opcodes.semanticsSnapshot,appObservationBody());
          assert.equal(animated.observation.rowVisits,width,'A concurrent inherited opacity animation reused the paint-only cohort');
          assert.deepEqual(animated.nodes.map(materialize),fullAnimated.nodes.map(materialize));
        }
        await bounded.close();
      }
      const saturated=await client.openView(1,6),root={slot:1,generation:1},children=Array.from({length:512},(_,i)=>({slot:i+2,generation:1})),editors=Array.from({length:30},(_,i)=>({slot:i+514,generation:1}));
      await saturated.request(p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,2n,true);v.setFloat64(8,320,true);v.setFloat64(16,240,true);v.setFloat64(24,1,true);}));
      await saturated.commit([c.create(root,'stack'),...children.map((n,i)=>c.create(n,'box',0,{parent:root,index:i})),...editors.flatMap((n,i)=>[c.create(n,'editable',0,{parent:root,index:512+i}),c.editor(n)])]);
      const label='baseline'.repeat(512);for(let offset=0;offset<children.length;offset+=64)await saturated.commit(children.slice(offset,offset+64).map(n=>c.semantics(n,{role:'button',label})));
      await publishStorage(saturated);const initial=await saturated.observeApp(p.opcodes.semanticsSnapshot),large='x'.repeat(p.limits.textBytes),revisions=new Map();
      const saturatedStream=client.observationStream(saturated.owner,p.opcodes.semanticsSnapshot),version=saturatedStream.version;
      // Published geometry remains valid while live editor values change. The
      // combined observation exceeds its response budget, without fabricating
      // an oversized render-frame response or abandoning a provider reader.
      for(const n of editors){const before=await saturated.editSnapshot(n),after=await saturated.edit(n,{kind:'replace',revision:before.revision,text:large});revisions.set(n.slot,after.revision);}
      // A normal delta now transmits only the live editor rows. Force a full
      // resync to saturate output while retaining the existing accepted bases.
      const rejected=await saturated.request(p.opcodes.semanticsSnapshot,body(16,v=>v.setUint32(0,p.inspectionFlags.appObservationDelta,true)));
      assert.equal(rejected.status,p.statuses.budgetExceeded);assert.equal(rejected.observation,null,'A rejected observation adopted a fabricated empty delta');
      assert.equal(saturatedStream.version,version,'Rejected observation advanced the client base');
      for(const n of editors)await saturated.edit(n,{kind:'replace',revision:revisions.get(n.slot),text:''});
      const restored=await saturated.observeApp(p.opcodes.semanticsSnapshot);
      assert.equal(restored.status,p.statuses.ok);assert(!restored.observation.full,'A rejected response discarded the native observation base');
      assert.equal(restored.nodes[1].semantics.label,label);assert.equal(initial.nodes[1].semantics.label,label);
      assert.equal(restored.nodes.find(row=>row.node.slot===editors[0].slot).editing.text,'');
      await saturated.close();
      const oversizedFrame=await client.openView(1,7),frameRoot={slot:1,generation:1},frameChildren=Array.from({length:400},(_,i)=>({slot:i+2,generation:1}));
      await oversizedFrame.request(p.opcodes.metrics,body(40,v=>{v.setBigUint64(0,2n,true);v.setFloat64(8,320,true);v.setFloat64(16,240,true);v.setFloat64(24,1,true);}));
      await oversizedFrame.commit([c.create(frameRoot,'stack'),...frameChildren.map((n,i)=>c.create(n,'box',0,{parent:frameRoot,index:i}))]);
      for(let offset=0;offset<frameChildren.length;offset+=64)await oversizedFrame.commit(frameChildren.slice(offset,offset+64).map(n=>c.semantics(n,{role:'button',label,hint:label,value:label})));
      for(let i=0;i<20;++i){const s=await oversizedFrame.request(p.opcodes.contentStep,body(8,v=>v.setUint32(0,p.limits.contentPerStep,true)));assert.equal(s.status,p.statuses.ok);if(s.preparationReady)break;}
      await oversizedFrame.request(p.opcodes.tick,body(8,v=>v.setFloat64(0,++clock,true)));
      const rejectedFrame=await oversizedFrame.request(p.opcodes.takeFrame);
      // Clean up the old implementation's unissued holder before failing, so
      // this negative regression cannot leave the fixture's session busy.
      if(rejectedFrame.holds)await oversizedFrame.request(p.opcodes.releaseFrame,body(24,v=>{v.setBigUint64(0,rejectedFrame.submission,true);v.setBigUint64(8,rejectedFrame.device,true);v.setUint32(20,1,true);}));
      assert.equal(rejectedFrame.status,p.statuses.budgetExceeded);assert.equal(rejectedFrame.holds,0,'A failed frame response left an unissued provider hold');
      await oversizedFrame.close();
      console.log('Versioned observations: immutable rows, no-change reuse, active/published fences, tombstones, lost response/resync, owner close PASS.');
      console.log('Observation membership: bounded value-only updates, forged additions/generations/order rejection, reordering/replacement and old snapshots PASS.');
      console.log('Observation storage: bounded live backing, immutable lazy-row relocation, resync copy reuse and close PASS.');
      console.log('Native observations: bounded paint/geometry/semantics/layout candidates for 64/2048 nodes, skipped publications, removal/recycling and full oracle equivalence PASS.');
      console.log('Observation quota: rejected multi-MiB response preserves both bases, then recovers by a valid delta PASS.');
      console.log('Frame quota: rejected output retires its unissued provider hold and closes without a reader PASS.');
      console.log('Immutable configurations: one registration/two bindings, exact collision handling, NACK rollback and retirement PASS.');
    } finally {await client.close();assert.equal(client.diagnostics().observations.length,0);}
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
  clearTimeout(watchdog);
}
