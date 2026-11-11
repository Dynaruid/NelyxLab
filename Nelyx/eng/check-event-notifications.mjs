// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import path from 'node:path';

// No generated test bundle, browser profile, or receipt is retained.
const watchdog = setTimeout(() => {
  throw Error('Notification checks exceeded 20 minutes');
}, 1_200_000);
try {
  const result = await build({
    absWorkingDir: path.resolve(import.meta.dirname, '../..'),
    stdin: {
      resolveDir: path.resolve(import.meta.dirname, '../..'),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import { observationNode } from './Nelyx/runtime/engine-client/node-index.ts';
      import { createPacketTransport } from './Nelyx/runtime/engine-client/message-port.ts';
      import { EngineViewClient } from './Nelyx/runtime/engine-client/client.ts';
      import { SceneWriter, SceneNode, SceneReference } from './Nelyx/runtime/engine-client/scene.ts';
      import { OriginalWidgetHost } from './Nelyx/runtime/app/host.ts';
      import { protocol as p } from './Nelyx/runtime/engine-client/schema.ts';
      import { response } from './Nelyx/runtime/engine-client/codec.ts';
      // A large observation exercises per-handle blob association, duplicate
      // rejection and generation checks without omitting any payload decoding.
      const count = 420, stride = 48;
      const observation = new Uint8Array(p.headerBytes + p.stateBytes + count * (p.nodeBytes + stride));
      const packet = new DataView(observation.buffer), b = p.headerBytes;
      packet.setUint32(p.headerFields.magic, p.magic, true);
      packet.setUint16(p.headerFields.major, p.abiMajor, true);
      packet.setUint32(p.headerFields.schema, p.schema, true);
      packet.setUint32(p.headerFields.length, observation.length, true);
      packet.setUint16(p.headerFields.opcode, 0x8000 | p.opcodes.layoutSnapshot, true);
      packet.setUint32(p.headerFields.count, count, true);
      packet.setUint32(b + p.stateFields.blobCount, count, true);
      packet.setUint32(b + p.stateFields.blobBytes, count * stride, true);
      const blobStart = b + p.stateBytes + count * p.nodeBytes;
      for (let i = 0; i < count; ++i) {
        const row = b + p.stateBytes + i * p.nodeBytes, blob = blobStart + i * stride;
        packet.setUint32(row, i + 1, true); packet.setUint32(row + 4, 1, true);
        packet.setUint32(row + 8, p.kinds.paragraph, true);
        packet.setUint32(blob, p.fontBindingBlob, true);
        packet.setUint32(blob + 8, i + 1, true); packet.setUint32(blob + 12, 1, true);
        packet.setUint32(blob + 16, 24, true);
        packet.setBigUint64(blob + 32, BigInt(i + 100), true);
      }
      const decoded = response(observation);
      assert.equal(observationNode(decoded,{slot:1,generation:1}),decoded.nodes[0]);
      assert.equal(observationNode(decoded,{slot:1,generation:2}),undefined,'index must not alias recycled slots');
      assert.equal(decoded.nodes.length, count);
      assert(Object.isFrozen(decoded.nodes[0]), 'in-place enrichment must still publish immutable nodes');
      for (let i = 0; i < count; ++i) assert.equal(decoded.nodes[i].fontBinding.fontRevision, BigInt(i + 100));
      const lazy = response(observation,{appObservation:true});
      for(let i=0;i<count;++i) {
        const expected=decoded.nodes[i];
        assert.deepEqual(Object.fromEntries(Object.keys(expected).map(key=>[key,lazy.nodes[i][key]])),expected);
        assert(Object.isFrozen(lazy.nodes[i]));
      }
      const privateCopy=response(observation,{appObservation:true});
      packet.setFloat64(b+p.stateBytes+40,123,true);
      assert.equal(privateCopy.nodes[0].width,0,'App geometry must own the packet bytes');
      assert.equal(privateCopy.nodes[0].bounds,privateCopy.nodes[0].bounds,'materialized values retain identity');
      packet.setFloat64(b+p.stateBytes+40,NaN,true);
      assert.throws(()=>response(observation,{appObservation:true}),/Invalid engine scalar/,'validation must precede lazy access');
      packet.setFloat64(b+p.stateBytes+40,0,true);
      packet.setUint32(blobStart + stride + 8, 1, true);
      assert.throws(() => response(observation), /Duplicate/);
      packet.setUint32(blobStart + stride + 8, 2, true);
      packet.setUint32(blobStart, p.semanticGeometryBlob, true);
      packet.setUint32(blobStart + 12, 2, true);
      assert.throws(() => response(observation), /Foreign layout/);
      const turn = () => new Promise(resolve => setImmediate(resolve));
      for(const role of ['layout','publication']) {
        const observed={events:[],gestureRequests:[],interactionCount:0};
        const host=new SceneWriter({pollInteractionEvents:async()=>observed} as any,{pollEvents:false}) as any;
        let pending,inject=false,visits=0;
        const lane=host.observationLanes[role];
        Object.defineProperty(lane,'pending',{
          get(){if(!pending&&inject){inject=false;queueMicrotask(()=>{pending=observed;});}return pending;},
          set(value){pending=value;},
        });
        host[role==='layout'?'observeLayout':'observeScene']=async()=>{if(++visits===1)inject=true;};
        await host.pollEvents();await turn();
        assert.equal(visits,2,'observation completion stranded the final publication');
        assert.equal(lane.running,undefined);
        assert.equal(pending,undefined);
      }
      {
        const streams=new Map(),calls=[];let releasePublication;
        const client={observationStream(_owner,op){
          if(!streams.has(op))streams.set(op,{version:0n,counters:{resyncs:0}});
          return streams.get(op);
        }};
        const view=new EngineViewClient(client as any,{session:1,app:1,view:1,generation:1});
        view.request=async(op,bytes)=>{
          const stream=client.observationStream(view.owner,op);
          calls.push({op,base:new DataView(bytes.buffer,bytes.byteOffset).getBigUint64(8,true)});
          if(op===p.opcodes.semanticsSnapshot&&calls.filter(c=>c.op===op).length===1)
            await new Promise(resolve=>{releasePublication=resolve;});
          ++stream.version;return {status:p.statuses.ok};
        };
        const published=view.observeApp(p.opcodes.semanticsSnapshot);await turn();
        const nextPublication=view.observeApp(p.opcodes.semanticsSnapshot);
        const selected=view.observeApp(p.opcodes.layoutSnapshot,[{slot:1,generation:1}]);
        await selected;
        assert.equal(calls.length,2,'Published observation held a separate active-layout role');
        assert.deepEqual(calls.map(c=>c.base),[0n,0n]);
        releasePublication();await published;await nextPublication;
        assert.deepEqual(calls.map(c=>c.base),[0n,0n,1n],'Same-role request used an unacknowledged delta base');
      }
      // A final callback can land after perform's last loop condition but
      // before the owner promise clears. This models route retirement in the
      // completion microtask, with no unrelated future notification to rescue it.
      for(const kind of ['widget','scene']) {
        const host=kind==='widget'?Object.create(OriginalWidgetHost.prototype):new SceneWriter({} as any,{pollEvents:false});
        host.closed=false;host.rerun=false;host.focusing={finishPoll(){}};
        let passes=0;
        host.perform=()=>{host.rerun=false;++passes;return Promise.resolve().then(()=>{
          if(passes===1)queueMicrotask(()=>kind==='widget'?host.schedule():void host.flush());
        });};
        await host.flush();await turn();
        assert.equal(passes,2,kind+' completion lost its final invalidation');
        assert.equal(host.running,undefined);
      }
      let receive, closed = false;
      const transport = createPacketTransport({ notifications: true,
        subscribe(callback) { receive = callback; return () => { receive = undefined; }; },
        post(message) { receive({ kind: 'packet-result', id: message.id, bytes: message.bytes }); },
        close() { closed = true; }
      });
      let calls = 0;
      const unsubscribe = transport.subscribeChanges(() => ++calls);
      receive({ kind: 'engine-change' });
      assert.equal(calls, 1);
      assert.deepEqual(await transport.exchange(new Uint8Array([1,2,3])), new Uint8Array([1,2,3]));
      assert.equal(calls, 1, 'packet replies must not create a notification feedback loop');
      unsubscribe(); receive({ kind: 'engine-change' }); assert.equal(calls, 1);
      await transport.close(); assert(closed); assert.equal(receive, undefined);
      const listeners = new Set<() => void>();
      const client = { notificationRevision: 0, releaseView() {}, subscribeChanges(callback) {
        listeners.add(callback); return () => listeners.delete(callback);
      }};
      const notify = () => { ++client.notificationRevision; for (const f of [...listeners]) f(); };
      const view = new EngineViewClient(client as any, { session: 1, app: 1, view: 1, generation: 1 });
      const before = view.notificationRevision; notify();
      await view.waitForChange(before); assert.equal(listeners.size, 0, 'early wake is retained by revision');
      const wait = view.waitForChange(view.notificationRevision); assert.equal(listeners.size, 1);
      notify(); await wait; assert.equal(listeners.size, 0);
      const stoppedHost = view.waitForChange(view.notificationRevision);
      view.wakeChangeWaits(); await stoppedHost; assert.equal(listeners.size, 0);
      const canceled = view.waitForChange(view.notificationRevision);
      const cancellationCheck = assert.rejects(canceled); view.sessionClosed(); await cancellationCheck; assert.equal(listeners.size, 0);
      const fallback = new EngineViewClient({ notificationRevision: 0, subscribeChanges() {} } as any,
        { session: 1, app: 1, view: 2, generation: 1 });
      await fallback.waitForChange(0);
      let resolvePoll, polls = 0, delivered = 0;
      const state = { events: [], gestureRequests: [], interactionCount: 0 };
      const writer = new SceneWriter({ subscribeChanges: client.subscribeChanges,
        pollInteractionEvents() { ++polls; return new Promise(resolve => { resolvePoll = resolve; }); }
      } as any, { onAfterEvents() { ++delivered; } });
      (writer as any).startEvents(); assert.equal(polls, 1);
      notify(); notify(); notify();
      resolvePoll(state); await turn(); assert.equal(polls, 2, 'notifications during a poll coalesce into one following poll');
      resolvePoll(state); await turn(); assert(delivered >= 2);
      await turn(); assert.equal(polls, 2, 'idle notification hosts do not poll');
      notify(); assert.equal(polls, 3);
      resolvePoll({ ...state, interactionCount: 1 }); await turn();
      assert.equal(polls, 4, 'bounded interaction batches drain without another host edge');
      await writer.stop(); resolvePoll(state); await turn(); notify();
      assert.equal(polls, 4); assert.equal(listeners.size, 0, 'stop detaches readiness observers');
      const sceneWriter = new SceneWriter({} as any, {pollEvents: false}) as any;
      const rootRef = new SceneReference(), left = new SceneReference(), right = new SceneReference();
      const scene = (color: number, reverse = false) => new SceneNode(rootRef, 'stack',
        (reverse ? [right, left] : [left, right]).map(ref => new SceneNode(ref, 'box', [], {color: ref === left ? color : 0})), {});
      sceneWriter.accepted = sceneWriter.records(scene(0));
      const painted = sceneWriter.records(scene(0xff223344));
      const paintChanges = sceneWriter.diff(painted);
      assert.equal(paintChanges.length, 1);
      assert.equal(new DataView(paintChanges[0].buffer).getUint16(0, true), p.commands.paint);
      assert.equal(sceneWriter.counters.topologyReused, 1);
      sceneWriter.accepted = painted;
      const moved = sceneWriter.diff(sceneWriter.records(scene(0xff223344, true)));
      assert(moved.some(bytes => new DataView(bytes.buffer).getUint16(0, true) === p.commands.move));
      assert.equal(sceneWriter.counters.topologyReused, 1, 'sibling reordering must take the structural diff');
      const reset = sceneWriter.diff(sceneWriter.records(scene(0)));
      assert.equal(reset.length, 1, 'paint reset remains visible on the topology fast path');
      let observationState = { events: [], gestureRequests: [], interactionCount: 0,
        status:p.statuses.ok, publication:1n, lastInput:1n, consumedThrough:1n, property:1n,
        nodes:[{node:{slot:1,generation:1}}] };
      const observations:number[] = [];
      const projected = new SceneWriter({pollInteractionEvents:async()=>observationState,
        observeApp:async(op,selection)=>{
          if(op===p.opcodes.layoutSnapshot)assert.equal(selection.length,1,'one registered observer, not the full scene');
          observations.push(op); return observationState; }} as any,
        {appObservations:true,pollEvents:false,onPublication:()=>{}}) as any;
      const observedReference = new SceneReference();
      projected.adopt(projected.records(new SceneNode(observedReference,'box',[],{onLayout:()=>{}})),[]);
      await projected.pollEvents(); assert.equal(observations.length,2);
      observationState = {...observationState,lastInput:2n,consumedThrough:2n};
      await projected.pollEvents(); assert.equal(observations.length,2,'input serial alone must not recopy an unchanged App observation');
      observationState = {...observationState,property:2n};
      await projected.pollEvents(); assert.equal(observations.at(-1),p.opcodes.layoutSnapshot);
      assert.equal(observations.length,3,'scroll property changes must still refresh list observations');
      observationState = {...observationState,publication:2n};
      await projected.pollEvents(); assert.equal(observations.at(-1),p.opcodes.semanticsSnapshot);
      assert.equal(observations.length,4,'new published geometry must still be observed');
      projected.adopt(projected.records(new SceneNode(observedReference,'box',[],{onLayout:()=>{}})),[]);
      await projected.pollEvents();
      assert.equal(observations.length,5,'A replaced layout subscription needs a current observation without a document change');
      projected.adopt(projected.records(new SceneNode(observedReference,'box')),[]);
      observationState={...observationState,property:3n};await projected.pollEvents();
      assert.equal(observations.length,5,'A removed layout subscription must stop requesting rows');
      for (const merged of [false,true]) {
        const queued: (()=>void)[] = [];let actions=0;
        const input = new SceneWriter({} as any,{pollEvents:false,
          onInputEvent:(_event,perform)=>queued.push(perform)}) as any;
        const root=new SceneReference(),target=new SceneReference();
        input.adopt(input.records(new SceneNode(root,'stack')),[]);
        const desired=input.records(new SceneNode(root,'stack',[
          new SceneNode(target,'box',[],{semantics:{role:'button',label:'OK'},onAction:()=>++actions})
        ]));
        const targetRecord=[...desired.values()].find(record=>record.node.reference===target),
          rootRecord=[...input.accepted.values()][0];
        const event={kind:p.events.semanticAction,node:merged?rootRecord.handle:targetRecord.handle,
          ...(merged?{semanticSource:targetRecord.handle}:{}),detail:BigInt(p.semanticsActions.activate),id:1n};
        await input.deliverInput({gestureRequests:[],events:[event]});
        input.adopt(desired,[]);for(const perform of queued.splice(0))perform();
        assert.equal(actions,1,'Core admitted a published semantic action before its Source ACK was adopted');
        await input.deliverInput({gestureRequests:[],events:[event]});
        input.adopt(input.records(new SceneNode(root,'stack')),[]);
        for(const perform of queued.splice(0))perform();
        assert.equal(actions,1,'A retired Source action must not run after the checkpoint');
      }
      let finishObservation, slowPolls=0, snapshotRequests=0;
      const states:number[]=[];
      const slow = new SceneWriter({subscribeChanges:client.subscribeChanges,
        pollInteractionEvents:async()=>({...observationState,lastInput:BigInt(++slowPolls)}),
        request:()=>{++snapshotRequests; return new Promise(resolve=>{finishObservation=resolve;});}
      } as any,{onPublication:()=>{},onState:s=>states.push(Number(s.lastInput))}) as any;
      slow.startEvents(); await turn(); assert.equal(snapshotRequests,1);
      notify(); await turn(); notify(); await turn();
      assert.equal(slowPolls,3,'input must drain while a geometry RPC remains unresolved');
      assert.equal(snapshotRequests,1,'only one geometry observation can be in flight');
      finishObservation({...observationState,lastInput:1n}); await turn();
      assert.equal(states.at(-1),3,'old geometry must not rewind a newer input fence');
      assert.equal(snapshotRequests,1,'same publication demands must coalesce');
      await slow.stop();
      {
        let releasePublication,reads=0,layoutRequests=0,layoutCallbacks=0;
        let state={...observationState,property:10n,lastInput:10n};
        const independent=new SceneWriter({pollInteractionEvents:async()=>state,
          observeApp:async(op)=>{
            if(op===p.opcodes.layoutSnapshot){++layoutRequests;return state;}
            ++reads;return new Promise(resolve=>{releasePublication=resolve;});
          }} as any,{appObservations:true,pollEvents:false,onPublication:()=>{}}) as any;
        const ref=new SceneReference(),callback=()=>++layoutCallbacks;
        independent.adopt(independent.records(new SceneNode(ref,'box',[],{onLayout:callback})),[]);
        await independent.pollEvents(false);await turn();
        assert.equal(reads,1);assert.equal(layoutCallbacks,1);
        state={...state,property:11n,lastInput:11n};
        await independent.pollEvents(false);await turn();
        assert.equal(layoutRequests,2,'Source layout waited behind an unrelated published tree');
        assert.equal(layoutCallbacks,2);assert.equal(reads,1,'Publication demand grew an RPC queue');
        await independent.stop();releasePublication(state);await turn();
        assert.equal(layoutCallbacks,2,'Stopped owner received an observation callback');
        assert.equal(independent.observationLanes.layout.pending,undefined);
        assert.equal(independent.observationLanes.publication.pending,undefined);
      }
      console.log('Notification transport, lost wake, coalescing, queue drain, idle and close checks passed.');
    `,
    },
    logOverride: { 'package.json': 'silent', 'ignored-bare-import': 'silent' },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node24',
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
