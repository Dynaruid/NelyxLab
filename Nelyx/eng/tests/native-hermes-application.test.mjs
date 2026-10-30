// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const timeout = 1_200_000;

// Isolate the actual VM-global bootstrap in a process. Only OS/GPU IO is
// controlled; application, engine, platform services and shutdown are real SDK.
for (const reentrant of [false, true])
  test(
    `direct application close fences its actual View before asynchronous native drain${reentrant ? ' under frame-cancel reentry' : ''}`,
    { timeout },
    () => {
      const script = `
 import assert from 'node:assert/strict';
 const enqueue=globalThis.queueMicrotask.bind(globalThis),timers=new Map(),frames=new Map(),failures=[],events=[];let sequence=0,listener,app,reentered=false,finish;
 const finished=new Promise(resolve=>{finish=resolve;});
 const context={nelyxCoreVersion:()=>1,nelyxWireVersion:()=>11,nelyxIdentity:()=>7,nelyxConfigure(){},nelyxReserve:()=>0,nelyxNotifications:()=>[],nelyxStats:()=>[7,0,0,0,0],nelyxReplayDisplayList(){},nelyxSubmit(){},nelyxCancel(){},nelyxClose(){events.push('close');},nelyxReset(){events.push('reset');},dispose(){events.push('context');}};
 globalThis.SkiaApi={Color:value=>value};globalThis.SkiaViewApi={makeGraphiteContext:()=>context};globalThis.HermesInternal={enablePromiseRejectionTracker(){}};
 globalThis.NelyxNativeHost={abi:2,capabilities:{vm:1,services:1,editing:1,semantics:1},mode:'bytecode',assetRoot:'C:/controlled-assets',now:()=>125,
  metrics:()=>({logicalWidth:100,logicalHeight:80,physicalWidth:100,physicalHeight:80,scale:1,viewportGeneration:1,rendererGeneration:1,nativeSurfaceGeneration:1}),listen(callback){listener=callback;},publishSemantics(){},editor(){throw Error('This scene has no editor');},pressedKeys:()=>[],
  environment:()=>({locales:['en-US'],localeSource:'native',brightness:'light',lifecycle:'resumed',textScale:1,capabilities:{clipboardRead:'available',clipboardWrite:'available',navigation:'available'}}),service(){throw Error('Unexpected OS request');},requestClose(){listener('close');},
  setTimer(callback){const id=++sequence;timers.set(id,callback);return id;},clearTimer(id){timers.delete(id);},requestFrame(callback){const id=++sequence;frames.set(id,callback);return id;},cancelFrame(id){frames.delete(id);if(${reentrant}&&!reentered){reentered=true;listener('close');assert.equal(app.view.status,'closing');}},queueMicrotask:enqueue,
  completeShutdown(){events.push('complete');finish();},fail(message){failures.push(message);},log(){}};
 const {startNativeHermesApplication}=await import('./Nelyx/sdk/dist/backends/native-hermes/application.js');
 try{app=await startNativeHermesApplication({id:'native-close',createScene:()=>()=>[]},{manifest:[],sources:{}});assert.equal(app.view.status,'open');assert(frames.size>0);listener('close');assert.equal(app.view.status,'closing','Native close must stop View admission synchronously');await finished;assert.equal(app.view.status,'closed');assert.deepEqual(failures,[]);assert.deepEqual(events,['close','reset','context','complete']);assert.equal(timers.size,0);assert.equal(frames.size,0);if(${reentrant})assert(reentered);process.stdout.write('CLOSE_PASS');}
 finally{listener?.('close');await finished;}
 `;
      const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
        cwd: new URL('../../..', import.meta.url),
        encoding: 'utf8',
        timeout,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, (result.stdout ?? '') + (result.stderr ?? ''));
      assert.equal(result.stdout, 'CLOSE_PASS');
    },
  );
