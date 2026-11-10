// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Observation checks exceeded 20 minutes');
}, 1200000);
try {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import { pathToFileURL } from 'node:url';
      import path from 'node:path';
      import { EngineClient } from './Nelyx/runtime/engine-client/client.ts';
      import { createWasmTransport } from './Nelyx/runtime/engine-client/wasm.ts';
      import { ObservationDecodeCache } from './Nelyx/runtime/engine-client/observation-cache.ts';
      import { semanticBody, readSemanticBody } from './Nelyx/runtime/engine-client/semantics.ts';
      import { commands as c, body, protocol as p, appObservationBody, appLayoutSelectionBody } from './Nelyx/runtime/engine-client/codec.ts';
      const factory = (await import(pathToFileURL(path.resolve(process.argv[2] ?? 'Nelyx/engine/dist/single-worker/engine.mjs')).href)).default;
      const decodeCache=new ObservationDecodeCache(1024,2);
      const semanticBytes=semanticBody({role:'button',label:'first'});
      const decoded=decodeCache.read('view1/node1:1',semanticBytes,readSemanticBody);
      assert.equal(decodeCache.read('view1/node1:1',semanticBytes.slice(),readSemanticBody),decoded);
      semanticBytes[12]=255;
      assert.throws(()=>decodeCache.read('view1/node1:1',semanticBytes,readSemanticBody));
      assert.equal(decodeCache.read('view1/node1:1',semanticBody({role:'button',label:'first'}),readSemanticBody),decoded,'Caller buffer mutation must not poison retained validation');
      assert.notEqual(decodeCache.read('view1/node1:2',semanticBody({role:'button',label:'first'}),readSemanticBody),decoded,'Recycled node generations must not share a cache entry');
      const changed=decodeCache.read('view1/node1:1',semanticBody({role:'button',label:'next'}),readSemanticBody);
      assert.equal(changed.label,'next');assert.notEqual(changed,decoded);
      decodeCache.read('view2/node1:1',semanticBody({role:'button',label:'separate'}),readSemanticBody);
      assert.equal(decodeCache.size,2);assert(decodeCache.byteLength<=1024);
      decodeCache.clear();assert.equal(decodeCache.byteLength,0);assert.equal(decodeCache.size,0);
      const client = await EngineClient.connect(createWasmTransport(await factory()));
      try {
        const view = await client.openView(1);
        const request = async (op, data) => { const r = await view.request(op, data); assert.equal(r.status, p.statuses.ok, 'opcode '+op); return r; };
        await request(p.opcodes.metrics, body(40, v => {
          v.setBigUint64(0, 2n, true); v.setFloat64(8, 320, true); v.setFloat64(16, 240, true); v.setFloat64(24, 1, true);
        }));
        const node = {slot:1,generation:1};
        const parent={slot:2,generation:1}, unrelated={slot:3,generation:1};
        await view.commit([c.create(parent,'stack'), c.create(node,'box',0,{parent}), c.create(unrelated,'box'), c.properties(node,{width:100,height:100}),
          c.graphics(node,{transform:[1,0,0,1,3,4],shadow:{x:1,y:2,sigma:2,color:0xff123456}}),
          c.semantics(node,{role:'button',label:'retained label',actions:p.semanticsActions.activate})]);
        await request(p.opcodes.contentStep, body(8,v=>v.setUint32(0,p.limits.contentPerStep,true)));
        await request(p.opcodes.tick, body(8,v=>v.setFloat64(0,1,true)));
        const frame = await request(p.opcodes.takeFrame);
        const completion = body(24,v=>{v.setBigUint64(0,frame.submission,true);v.setBigUint64(8,frame.device,true);v.setUint32(16,1,true);});
        await request(p.opcodes.releaseFrame,completion);
        new DataView(completion.buffer).setUint32(16,0,true);
        await request(p.opcodes.publish,completion);
        const settled=await view.inspectState();
        const cachedA=await request(p.opcodes.semanticsSnapshot,appObservationBody());
        const cachedB=await request(p.opcodes.semanticsSnapshot,appObservationBody());
        assert.equal(cachedA.nodes.find(n=>n.node.slot===node.slot).semantics,cachedB.nodes.find(n=>n.node.slot===node.slot).semantics,'Unchanged App semantic publications should reuse validated values');
        const cachedFull=await request(p.opcodes.semanticsSnapshot);
        assert.equal(cachedFull.nodes.find(n=>n.node.slot===node.slot).semantics,cachedB.nodes.find(n=>n.node.slot===node.slot).semantics,'Full queries and App projections must share only identical validated blobs');
        await request(p.opcodes.requestAppFrame);
        const callbackTick=await request(p.opcodes.tick,body(8,v=>v.setFloat64(0,2,true)));
        assert.equal(callbackTick.property,settled.property,'App callback demand must not dirty paint properties');
        assert.equal((await view.request(p.opcodes.takeFrame)).status,p.statuses.notFound,'App-only scheduling must not republish identical pixels');
        const callbacks=await view.pollInteractionEvents();
        assert(callbacks.events.some(e=>e.kind===p.events.appFrame),'App callback must still be delivered without a GPU frame');
        for(const opcode of [p.opcodes.layoutSnapshot,p.opcodes.semanticsSnapshot]) {
          const full = await request(opcode), projected = await request(opcode,appObservationBody());
          assert(full.nodes.find(n=>n.node.slot===node.slot).graphics);
          assert.equal(projected.nodes[0].graphics,null);
          assert.equal(projected.nodes.length,full.nodes.length);
          for (let i=0;i<full.nodes.length;i++) {
            const expected={...full.nodes[i],graphics:null};
            assert.deepEqual(Object.fromEntries(Object.keys(expected).map(key=>[key,projected.nodes[i][key]])),expected);
            assert(Object.isFrozen(projected.nodes[i]));
          }
          assert.equal(projected.publication,full.publication);
          assert.equal(projected.activeDocument,full.activeDocument);
          assert.equal(projected.publishedDocument,full.publishedDocument);
          assert(projected.blobs.length < full.blobs.length);
          assert((await request(opcode)).nodes.find(n=>n.node.slot===node.slot).graphics, 'projection must not alter the default response');
          const invalid = await view.request(opcode,body(4,v=>v.setUint32(0,3,true)));
          assert.equal(invalid.status,p.statuses.malformed);
        }
        const selected=await request(p.opcodes.layoutSnapshot,appLayoutSelectionBody([node]));
        assert.deepEqual(selected.nodes.map(n=>n.node),[node,parent],'selection includes direct parent and excludes unrelated nodes');
        assert.equal((await request(p.opcodes.layoutSnapshot,appLayoutSelectionBody([{...node,generation:2}]))).nodes.length,0,'recycled generations never alias');
        assert.equal((await request(p.opcodes.layoutSnapshot,appLayoutSelectionBody([]))).nodes.length,0);
        assert.equal((await view.request(p.opcodes.semanticsSnapshot,appLayoutSelectionBody([node]))).status,p.statuses.malformed);
        assert.equal((await view.request(p.opcodes.layoutSnapshot,appLayoutSelectionBody([node,node]))).status,p.statuses.malformed);
        assert.equal((await view.request(p.opcodes.layoutSnapshot,appLayoutSelectionBody([node]).slice(0,12))).status,p.statuses.malformed);
        // An admitted scene can exceed the delta-request budget even without
        // text/paint blobs. Both full inspection and provider preparation must
        // survive the real Core -> Wasm -> decoder response path.
        const largeCount=Math.floor(p.limits.packetBytes/p.nodeBytes)+1;
        assert(largeCount<=p.limits.nodes);
        await view.commit(Array.from({length:largeCount-3},(_,i)=>c.create({slot:i+4,generation:1},'box')));
        assert.equal((await request(p.opcodes.inspect)).nodes.length,largeCount);
        let prepared;
        for(let step=0;step<=Math.ceil((largeCount+1)/p.limits.contentPerStep);++step){
          prepared=await request(p.opcodes.contentStep,body(8,v=>v.setUint32(0,p.limits.contentPerStep,true)));
          if(prepared.preparationReady)break;
        }
        assert(prepared.preparationReady,'Large admitted scene did not finish');
        assert.equal((await request(p.opcodes.preparationScene)).nodes.length,largeCount);
        await assert.rejects(()=>view.request(p.opcodes.inspect,new Uint8Array(p.limits.packetBytes)),/budget|large|length/i);
        await view.close();
        console.log('App observations, full-scene responses above 1 MiB, request bounds and flag rejection PASS.');
      } finally { await client.close(); }
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
