// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootstrapApplication} from '../../sdk/dist/runtime/bootstrap.js';
import {createNativeEngineServices} from '../../sdk/dist/runtime/native-engine.js';
import {NativeInteraction} from '../../sdk/dist/runtime/native-interaction.js';
import {finishOwnedDisposal} from '../../sdk/dist/runtime/owned-disposal.js';
import {PendingDisposalError} from '@nelyx/core/foundation/disposable';

const timeout=1_200_000,owner={id:'common-native-engine',generation:1};
const metrics={logicalWidth:100,logicalHeight:80,physicalWidth:100,physicalHeight:80,scale:1,viewportGeneration:1,rendererGeneration:1,nativeContextGeneration:7,nativeSurfaceGeneration:1};
function fixture(){
  const events=[],notifications=[],callbacks=new Map();let next=0;
  const context={nelyxCoreVersion:()=>1,nelyxWireVersion:()=>11,nelyxIdentity:()=>7,nelyxConfigure(){events.push('configure');},nelyxReserve:()=>0,nelyxNotifications:()=>notifications.splice(0),nelyxStats:()=>[7,0,0,0,0],
    nelyxReplayDisplayList(buffer){const words=new Float64Array(buffer);assert.equal(words[0],0x4e4c444c);assert.equal(words[1],1);events.push('scene');},
    beginRecording:()=>({}),finishRecording:()=>({dispose(){events.push('recording');}}),nelyxSubmit(_recording,id){notifications.push(7,id,0);},nelyxCancel(){},
    nelyxClose(){events.push('close');},nelyxReset(){events.push('reset');},dispose(){events.push('context');}};
  const engine=createNativeEngineServices({api:{Color:value=>value},context,owner,assets:{images:new Map(),fonts:new Map(),sourceBytes:0},configuration:{manifest:[],sources:{}},resolveSource(){throw Error('Unexpected source resolution');},assertOpen(){}});
  const clock={request(callback){const id=++next;callbacks.set(id,callback);return {dispose(){callbacks.delete(id);}};}};
  const interaction=new NativeInteraction(owner,{commands:true,selectionEvents:true,semantics:'native-controls',nativeSnapshots:true,geometry:'unavailable'});
  const services={...engine.services,identity:{target:'windows',runtime:'hermes',host:'native-hermes',renderer:'skia-graphite',gpuBackend:'vulkan',gpuImplementation:'native-vulkan',profile:'native-hermes-graphite-vulkan'},clock,
    assets:{async resolve(){return [];},dispose(){events.push('assets');}},surface:{owner,readMetrics:()=>metrics,attach(){return {dispose(){events.push('binding');}};},dispose(){events.push('surface');}},editing:interaction.editing,semantics:interaction.semantics};
  return {engine,services,events,context,callbacks,tick(){const pending=[...callbacks.values()];callbacks.clear();for(const callback of pending)callback();}};
}

test('shared engine ports submit through the common scene and retire the application context once',{timeout},async()=>{
  const f=fixture();let app;
  try{
    app=await bootstrapApplication({id:'engine-app',createScene:()=>()=>[{op:'clear',color:0xff123456}]},f.services);
    app.view.requestFrame();f.tick();assert.equal(app.view.status,'open');assert(f.events.includes('scene'));
    f.engine.pollNotifications();assert.equal(f.engine.hasPendingSubmissions,false);
    await app.dispose();await f.engine.dispose();await f.engine.dispose();
    assert.equal(f.events.filter(value=>value==='close').length,1);assert.equal(f.events.filter(value=>value==='reset').length,1);assert.equal(f.events.filter(value=>value==='context').length,1);assert.equal(f.callbacks.size,0);
    assert.throws(()=>f.engine.services.text.create(app.session.resources),/closed/);assert.throws(()=>f.engine.services.paths.contains(null,{x:0,y:0}),/closed/);
  }finally{await app?.dispose();await f.engine.dispose();}
});

test('startup failure and unused-context retirement share the same engine owner',{timeout},async()=>{
  const f=fixture(),failure=new Error('startup callback failed');
  try{
    await assert.rejects(bootstrapApplication({id:'failing-engine',createScene:()=>()=>[],startup(){throw failure;}},f.services),error=>error===failure);
    await f.engine.dispose();assert.equal(f.events.filter(value=>value==='context').length,1);assert.equal(f.events.filter(value=>value==='close').length,1);
  }finally{await f.engine.dispose();}
  const unopened=fixture();await unopened.engine.dispose();assert.deepEqual(unopened.events,['close','reset','context']);
});

test('a missing scene capability fails before configure and returns the unused context',{timeout},async()=>{
  const f=fixture();delete f.context.nelyxReplayDisplayList;
  try{assert.throws(()=>f.engine.services.renderer.create(f.services.surface,{}),/display-list1/);assert.deepEqual(f.events,[]);}
  finally{await f.engine.dispose();}
  assert.deepEqual(f.events,['close','reset','context']);
});

test('failed renderer drain retains programs and does not reset or release its context',{timeout},async()=>{
  const f=fixture(),failure=new Error('native drain failed'),renderer=f.engine.services.renderer.create(f.services.surface,{});let attempts=0;
  f.context.nelyxClose=()=>{attempts++;throw failure;};
  const closing=f.engine.dispose();await assert.rejects(closing,error=>error===failure);assert.equal(f.engine.dispose(),closing);await assert.rejects(f.engine.dispose(),error=>error===failure);
  assert.equal(attempts,1);assert.equal(renderer.debugRuntimePrograms.closed,false);assert(!f.events.includes('reset'));assert(!f.events.includes('context'));
});

test('explicit unused-context recovery resumes before reset and wrapper release',{timeout},async()=>{
  const f=fixture();let attempts=0;
  f.context.nelyxClose=()=>{attempts++;f.events.push('close');throw new PendingDisposalError([Error('pending close')],()=>{f.events.push('close-complete');});};
  await finishOwnedDisposal(()=>f.engine.dispose());assert.equal(attempts,1);assert.deepEqual(f.events,['close','close-complete','reset','context']);await f.engine.dispose();
});
