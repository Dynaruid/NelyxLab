// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Immediate state/input read checks exceeded 20 minutes');
}, 1200000);
const listener = globalThis.addEventListener;
const stackTraceLimit = Error.stackTraceLimit;
try {
  // Exercise the actual coordinator route with suspended provider mailboxes.
  // Only boot is replaced: Core validation, admission and completion stay real.
  globalThis.addEventListener = () => {};
  Error.stackTraceLimit = 0;
  const result = await build({
    stdin: {
      resolveDir: path.resolve('Nelyx/engine/platform/web'),
      loader: 'ts',
      contents:
        fs.readFileSync('Nelyx/engine/platform/web/coordinator.ts', 'utf8') +
        `
        import assert from 'node:assert/strict';
        import {pathToFileURL} from 'node:url';
        import path from 'node:path';
        import {commands,transaction,stateInspectionBody} from '../../../runtime/engine-client/codec.ts';
        import {EngineClient} from '../../../runtime/engine-client/client.ts';
        import {createWasmTransport} from '../../../runtime/engine-client/wasm.ts';
        import {OriginalWidgetHost} from '../../../runtime/app/host.ts';
        import {Align,SizedBox} from '@nelyx/core/framework/widgets/basic';
        import {LayoutBuilder} from '@nelyx/core/framework/widgets/layout-builder';
        const factory=(await import(pathToFileURL(path.resolve(process.argv[2]??'Nelyx/engine/dist/single-worker/engine.mjs')).href)).default;
        module=await factory();
        engine=module._nelyx_wasm_open(1,1,p.schema,p.capabilities.protocol);
        assert(engine);
        announced=true;profile='threaded';
        transportBudget=new ProviderBudget(module,engine,3);
        const testOwner={session:1,app:1,view:1,generation:1},replies=[],renderQueue=[],contentQueue=[];
        const port={postMessage:message=>replies.push(message)};
        renderWorker={postMessage:message=>renderQueue.push(message)} as any;
        contentWorker={postMessage:message=>contentQueue.push(message)} as any;
        let ticket=0;
        const sendRead=(bytes)=>{route(port as any,{kind:'packet',id:++ticket,bytes:bytes.buffer});return replies.at(-1);};
        const inspect=()=>packet(p.opcodes.inspect,testOwner,stateInspectionBody());
        try {
          assert.equal(response(exchange(module,engine,packet(p.opcodes.openView,testOwner))).status,p.statuses.ok);
          sendRead(packet(p.opcodes.inspect,testOwner));
          sendRead(transaction(testOwner,1n,0n,[commands.create({slot:1,generation:1},'box')]));
          assert.equal(renderQueue.length,1,'Full scene inspection bypassed Render');
          assert.equal(contentQueue.length,1,'A mutation bypassed Content');
          assert.equal(replies.length,0,'Suspended owner requests completed early');
          const first=sendRead(inspect()),state=response(new Uint8Array(first.bytes));
          assert.equal(state.status,p.statuses.ok);
          assert.equal(state.nodes.length,0);
          assert.equal(state.document,0n,'A read fabricated an ACK for a queued transaction');
          assert.equal(replies.length,1,'State read waited for a provider mailbox');
          for(const opcode of [p.opcodes.pollInteractionEvents,p.opcodes.pollRaw]) {
            const reply=sendRead(packet(opcode,testOwner));
            assert.equal(response(new Uint8Array(reply.bytes)).status,p.statuses.ok);
          }
          // Bypassing provider queues never bypasses Core owner/schema checks.
          const stale=inspect();new DataView(stale.buffer).setUint32(p.headerFields.generation,2,true);
          assert.equal(response(new Uint8Array(sendRead(stale).bytes)).status,p.statuses.staleGeneration);
          const incompatible=inspect();new DataView(incompatible.buffer).setUint32(p.headerFields.schema,0,true);
          assert.equal(response(new Uint8Array(sendRead(incompatible).bytes)).status,p.statuses.incompatible);
          for(const bytes of [
            packet(p.opcodes.inspect,testOwner,new Uint8Array(8)),
            packet(p.opcodes.inspect,testOwner,new Uint8Array(4)),
            packet(p.opcodes.pollInteractionEvents,testOwner,new Uint8Array(4)),
            packet(p.opcodes.layoutSnapshot,testOwner),
          ]) sendRead(bytes);
          assert.equal(renderQueue.length,5,'A full or malformed read entered the immediate path');
          const mutation=contentQueue.shift();
          complete({id:mutation.id,bytes:exchange(module,engine,new Uint8Array(mutation.bytes)).buffer});
          const current=response(new Uint8Array(sendRead(inspect()).bytes));
          assert.equal(current.document,1n,'A later state read reused an old receipt');
          assert.equal(current.nodes.length,0);
          assert.equal(contentQueue.length,0);
          assert.equal(pending.size,5,'Immediate completion retired another owner request');
          for(const held of renderQueue) complete({id:held.id,error:'suspended fixture retired'});
          assert.equal(pending.size,0);assert.equal(pendingBytes,0);
          transportBudget.close();
          const closed=response(exchange(module,engine,packet(p.opcodes.closeSession,sessionOwner)));
          assert.equal(closed.status,p.statuses.ok);assert.equal(closed.reservedBytes,0n);
          console.log('Immediate reads: real coordinator/Core, suspended Render/Content, fresh state, owner/schema rejection, full/malformed routing, pending credit and close PASS.');
        } finally {
          for(const id of [...pending.keys()])complete({id,error:'fixture cleanup'});
          transportBudget.close();
          module._nelyx_engine_destroy(engine);forgetHeapReport(module,engine);engine=0;
        }
        const client=await EngineClient.connect(createWasmTransport(module)),view=await client.openView(1);
        const app=new OriginalWidgetHost(view,{pollEvents:false,onError:error=>{throw error;}}) as any;
        let commits=0,clock=0,builderCalls=0,holdPublication=false,heldPublication,onCommit,checkPending=false;
        const inspectState=view.inspectState.bind(view),commit=view.commit.bind(view);
        const core=async(op,data?)=>{
          const result=await view.request(op,data);
          assert.equal(result.status,p.statuses.ok,'Host fixture opcode '+op);return result;
        };
        view.commit=async(changes)=>{
          const receipt=await commit(changes);
          if(++commits===1)app.schedule();
          if(checkPending){
            checkPending=false;
            const pending=await inspectState();
            assert(pending.document>pending.activeDocument&&pending.pendingDocument!==0n,
              'Fixture did not leave real Content work pending');
            assert(app.waitForContent(pending),'Unprepared Content lost its anti-starvation barrier');
          }
          for(let step=0;step<16;++step){
            const state=await core(p.opcodes.contentStep,new Uint8Array(new Uint32Array([p.limits.contentPerStep,0]).buffer));
            if(state.layoutBuildPending)return receipt;
            if(!state.preparation||state.preparationReady)break;
          }
          await core(p.opcodes.tick,new Uint8Array(new Float64Array([++clock]).buffer));
          const frame=await core(p.opcodes.takeFrame),done=new Uint8Array(24),fields=new DataView(done.buffer);
          fields.setBigUint64(0,frame.submission,true);fields.setBigUint64(8,frame.device,true);
          await core(p.opcodes.releaseFrame,done);
          if(holdPublication)heldPublication=done;
          else await core(p.opcodes.publish,done);
          if(onCommit){const callback=onCommit;onCommit=undefined;callback();}
          return receipt;
        };
        try {
          const metrics=new Uint8Array(40),fields=new DataView(metrics.buffer);
          fields.setBigUint64(0,2n,true);fields.setFloat64(8,100,true);fields.setFloat64(16,60,true);fields.setFloat64(24,1,true);
          await core(p.opcodes.metrics,metrics);
          await app.mount(new SizedBox(20,12));
          assert.equal(app.diagnostics().samplesThrough,2,'An invalidation during ACK did not produce another pass');
          assert.equal(commits,1,'Unchanged rerun produced another transaction');
          await app.update(new LayoutBuilder((_context,constraints)=>{
            ++builderCalls;assert.equal(constraints.maxWidth,100);return new SizedBox(40,20);
          }));
          assert.equal(builderCalls,1,'Manual polling lost the final Source request');
          assert.equal(view.hasPendingTransaction,false);
          const settled=await inspectState();assert.equal(settled.document,settled.publishedDocument);
          assert.equal(settled.preparation,0n);
          console.log('App passes: ACK invalidation preserved, manual Source request/constraints, publication and close PASS.');
          // A real update arriving during the state RPC belongs to this
          // capture. It must replace the earlier desired Widget without an
          // ACK for the obsolete configuration.
          await app.update(new Align(new SizedBox(10,10)));
          const beforeCommits=commits, beforeCaptures=app.diagnostics().samplesThrough;
          let injected=false,reentrant;
          view.inspectState=async()=>{
            const state=await inspectState();
            if(!injected){injected=true;reentrant=app.update(new Align(new SizedBox(45,21)));}
            return state;
          };
          await app.update(new Align(new SizedBox(22,13)));await reentrant;
          view.inspectState=inspectState;
          assert.equal(commits-beforeCommits,1,'Obsolete desired Widget was committed');
          assert.equal(app.diagnostics().samplesThrough-beforeCaptures,1,'Pre-capture demand caused a redundant Source pass');
          const captured=await core(p.opcodes.layoutSnapshot);
          assert(captured.nodes.some(node=>node.width===45&&node.height===21),
            'The update received before capture was lost');
          // A newer metrics cohort arriving after inspect is not consumed by
          // a capture based on that older state. Keep its follow-up pass.
          const beforeCohort=app.diagnostics().samplesThrough;let newer=false;
          view.inspectState=async()=>{
            const old=await inspectState();
            if(!newer){newer=true;fields.setBigUint64(0,old.metrics+1n,true);
              await core(p.opcodes.metrics,metrics);app.observeMetrics(await inspectState());app.schedule();}
            return old;
          };
          await app.update(new Align(new SizedBox(46,22)));
          view.inspectState=inspectState;
          assert.equal(app.diagnostics().samplesThrough-beforeCohort,2,'Newer metrics demand was consumed by an old capture cohort');
          assert.equal(app.sceneMetrics,(await inspectState()).metrics,'Capture did not advance to the latest metrics cohort');
          // Hold a real acquired/released Frame before publication. The
          // App must retain the publication fence used by Source
          // page observations, as well as the pending Content barrier above.
          holdPublication=true;checkPending=true;onCommit=()=>app.schedule();
          const beforeHeld=app.diagnostics().samplesThrough;
          let publicationWaits=0;
          const waitForChange=view.waitForChange;
          view.waitForChange=async()=>{
            const waiting=await inspectState();
            assert.equal(waiting.document,waiting.activeDocument);
            assert(waiting.publishedDocument<waiting.document);
            assert.equal(waiting.preparation,0n);assert.equal(waiting.pendingDocument,0n);
            assert(heldPublication);++publicationWaits;
            await core(p.opcodes.publish,heldPublication);heldPublication=undefined;
          };
          await app.update(new Align(new SizedBox(37,17)));
          view.waitForChange=waitForChange;
          assert.equal(app.diagnostics().samplesThrough-beforeHeld,2,
            'The update during ACK must survive');
          assert.equal(publicationWaits,1,'App bypassed the Source publication fence');
          const activated=await inspectState();
          assert.equal(activated.document,activated.activeDocument);
          assert.equal(activated.publishedDocument,activated.document);
          assert.equal(activated.preparation,0n);assert.equal(activated.pendingDocument,0n);
          console.log('App updates: pre-capture desired Widget retained, ACK update retained, real pending Content and publication fences preserved PASS.');
        } finally {
          await app.close();await view.close();await client.close();
        }
        `,
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
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
  if (listener === undefined) delete globalThis.addEventListener;
  else globalThis.addEventListener = listener;
  clearTimeout(watchdog);
}
