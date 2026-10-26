// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {bootstrapApplication} from '../../sdk/dist/runtime/bootstrap.js';
import {createNativeEngineServices} from '../../sdk/dist/runtime/native-engine.js';
import {NativeInteraction} from '../../sdk/dist/runtime/native-interaction.js';
import {finishOwnedDisposal} from '../../sdk/dist/runtime/owned-disposal.js';
import {PendingDisposalError} from '@nelyx/core/foundation/disposable';
import {ResourceRegistry} from '@nelyx/core/hosting/resources';
import {Picture} from '@nelyx/core/ui/picture';
import {Canvas} from '@nelyx/core/ui/canvas';
import {FrameRecording,disposeFrame} from '@nelyx/core/ui/frame';
import {resourceOwner} from '@nelyx/core/ui/resource-retention';
import {createReactNativeSurface} from '../../sdk/dist/backends/react-native/surface.js';
import {PluginPlatformMessagePort} from '../../sdk/dist/runtime/plugin-port.js';

const timeout=1_200_000,owner={id:'common-native-engine',generation:1};
const metrics={logicalWidth:100,logicalHeight:80,physicalWidth:100,physicalHeight:80,scale:1,viewportGeneration:1,rendererGeneration:1,nativeContextGeneration:7,nativeSurfaceGeneration:1};
function fixture(){
  const events=[],notifications=[],callbacks=new Map();let next=0;
  const context={nelyxCoreVersion:()=>1,nelyxWireVersion:()=>11,nelyxIdentity:()=>7,nelyxConfigure(){events.push('configure');},nelyxReserve:()=>0,nelyxNotifications:()=>notifications.splice(0),nelyxStats:()=>[7,0,0,0,0],
    nelyxReplayDisplayList(buffer){const words=new Float64Array(buffer);assert.equal(words[0],0x4e4c444c);assert.equal(words[1],1);events.push('scene');},
    beginRecording:()=>({}),finishRecording:()=>({dispose(){events.push('recording');}}),nelyxSubmit(_recording,id){notifications.push(7,id,0);},nelyxCancel(){},
    nelyxClose(){events.push('close');},nelyxReset(){events.push('reset');},dispose(){events.push('context');}};
  const api={Color:value=>value},engine=createNativeEngineServices({api,context,owner,assets:{images:new Map(),fonts:new Map(),sourceBytes:0},configuration:{manifest:[],sources:{}},resolveSource(){throw Error('Unexpected source resolution');},assertOpen(){}});
  const clock={request(callback){const id=++next;callbacks.set(id,callback);return {dispose(){callbacks.delete(id);}};}};
  const interaction=new NativeInteraction(owner,{commands:true,selectionEvents:true,semantics:'native-controls',nativeSnapshots:true,geometry:'unavailable'});
  const services={...engine.services,identity:{target:'windows',runtime:'hermes',host:'native-hermes',renderer:'skia-graphite',gpuBackend:'vulkan',gpuImplementation:'native-vulkan',profile:'native-hermes-graphite-vulkan'},clock,
    assets:{async resolve(){return [];},dispose(){events.push('assets');}},surface:{owner,readMetrics:()=>metrics,attach(){return {dispose(){events.push('binding');}};},dispose(){events.push('surface');}},editing:interaction.editing,semantics:interaction.semantics};
  return {api,engine,services,events,context,callbacks,tick(){const pending=[...callbacks.values()];callbacks.clear();for(const callback of pending)callback();}};
}

test('actual native Engine picture ports require the shared packet, reuse its producer and wait for the admitted lease',{timeout},async()=>{
  const f=fixture(),registry=new ResourceRegistry(),pictures=f.engine.services.pictures.create(registry),picture=Picture._fromRecording([{op:'rect',rect:{x:0,y:0,width:4,height:5},color:0xff123456}]);let compiled=0,retired=0,lease;
  f.api.XYWHRect=()=>({setLTRB(){},dispose(){}});f.api.PictureRecorder=()=>({beginRecording:()=>new Proxy({},{get(){throw Error('Engine picture port entered Canvas replay');}}),nelyxReplayDisplayList(buffer){const words=new Float64Array(buffer);assert.equal(words[0],0x4e4c444c);assert.equal(words[2],1);assert.equal(words[4],22);compiled++;},finishRecordingAsPicture:()=>({approximateBytesUsed:()=>128,dispose(){retired++;}}),dispose(){}});
  try{const resource=pictures.resource(picture);assert.equal(pictures.resource(picture),resource);assert.equal(compiled,1);lease=registry.acquire([resource]);picture.dispose();assert.equal(retired,0);pictures.dispose();assert.equal(retired,0);lease.returnBy('caller');assert.equal(retired,1);}
  finally{if(!picture.debugDisposed)picture.dispose();if(lease&&!lease.released)lease.returnBy('caller');pictures.dispose();registry.dispose();await f.engine.dispose();}
});

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

test('a surface close during bootstrap attachment fences its View before the application facade exists',{timeout},async()=>{
 const f=fixture();let app,observed,retired=0;
 f.services.surface.attach=(view,notify)=>{notify({kind:'close'});observed=view.status;return {dispose(){retired++;}};};
 try{app=await bootstrapApplication({id:'attach-close',createScene:()=>()=>[]},f.services);assert.equal(observed,'closing');assert.equal(app.view.status,'closed');assert.equal(retired,1);assert.equal(f.callbacks.size,0);}
 finally{await app?.dispose();await f.engine.dispose();}
});

test('RN surface close fences the attached View while its native input still owns an asynchronous drain',{timeout},async()=>{
 const hooks=[],effects=[],frames=new Map(),errors=[],events=[];let hook=0,nativeProps,hostClose,releaseInput,ready,rejectReady,app;
 const inputDrain=new Promise(resolve=>{releaseInput=resolve;}),opened=new Promise((resolve,reject)=>{ready=resolve;rejectReady=reject;});
 const context={nelyxCoreVersion:()=>1,nelyxWireVersion:()=>11,nelyxIdentity:()=>7,nelyxConfigure(){},nelyxReserve:()=>0,nelyxNotifications:()=>[],nelyxStats:()=>[7,0,0,0,0],nelyxReplayDisplayList(){},nelyxSubmit(){},nelyxCancel(){},nelyxClose(){events.push('close');},nelyxReset(){events.push('reset');},dispose(){events.push('context');}};
 const react={useRef(initial){const at=hook++;return hooks[at]??=( {current:initial} );},useState(initial){const at=hook++;if(!(at in hooks))hooks[at]=initial;return [hooks[at],value=>{hooks[at]=typeof value==='function'?value(hooks[at]):value;}];},useEffect(run){const at=hook++;if(!(at in hooks)){hooks[at]=true;effects.push(run);}},createElement(type,props,...children){if(type==='Skia'){nativeProps=props;props.ref.current={getContext:()=>context};}return {type,props,children};}};
 const backend={react,native:{View:'View',PixelRatio:{get:()=>1},Dimensions:{get:()=>({fontScale:1}),addEventListener:()=>({remove(){}})},Image:{resolveAssetSource:()=>null}},skia:{Skia:{Color:value=>value},SkiaGraphiteView:'Skia'},profile:{identity:{target:'windows',runtime:'hermes',host:'react-native',renderer:'skia-graphite',gpuBackend:'vulkan',gpuImplementation:'native-vulkan',profile:'controlled-rnw'}}};
 const configuration={manifest:[],sources:{}},adapter={target:'windows',backend:()=>backend,assets:()=>configuration,environment:{},visibility:()=>({isAvailable:true,currentState:'active',addEventListener:()=>({remove(){}})}),
  assetServices:{acquire(){let released=false;return {ready:Promise.resolve({images:new Map(),fonts:new Map(),sourceBytes:0}),release(){if(!released){released=true;events.push('assets');}}};},service:()=>({resolve:async()=>[],dispose(){}})},
  interaction:view=>new NativeInteraction(view,{commands:true,selectionEvents:true,semantics:'native-controls',nativeSnapshots:true,geometry:'unavailable'}),interactionControls:()=>null,
  retainOwner(close){hostClose=close;return {release(){events.push('host');}};},nativeViewProps(_props,binding){return {binding};},
  frameScheduler(){let sequence=0;return {request(callback){frames.set(++sequence,callback);return sequence;},cancel(id){frames.delete(id);}};},openInput(){return {ready:Promise.resolve(),dispose:()=>inputDrain};}};
 const Surface=createReactNativeSurface(adapter),props={definition:{id:'rn-close',accessibilityEnabled:false,createView:()=>({build:()=>[],dispose(){events.push('controller');}})},generation:1,initializePlatformServices:false,platformMessages:new PluginPlatformMessagePort(),onReady(value){app=value;ready();},onError(error){errors.push(error);rejectReady(error);}};
 let cleanup,closing;
 try{
  Surface(props);cleanup=effects[0]();await new Promise(resolve=>setImmediate(resolve));hook=0;Surface(props);assert(nativeProps);
  nativeProps.binding.ready({logicalWidth:100,logicalHeight:80,physicalWidth:100,physicalHeight:80,scale:1,nativeSurfaceGeneration:1});nativeProps.onLayout({nativeEvent:{layout:{width:100,height:80}}});await opened;
  assert.equal(app.view.status,'open');assert(frames.size);closing=hostClose();assert.equal(app.view.status,'closing');assert.equal(frames.size,0);assert(!events.includes('controller'),'Native input still owns its drain');
  releaseInput();await closing;assert.equal(app.view.status,'closed');assert.deepEqual(events,['controller','close','reset','context','assets','host']);assert.deepEqual(errors,[]);
 }finally{releaseInput();cleanup?.();if(hostClose)await hostClose();}
});

test('bootstrap publishes sealed asset bindings that survive descriptor mutation until the final frame lease',{timeout},async()=>{
  const f=fixture(),sha256='a'.repeat(64),descriptor={id:'boot-image',generation:1,kind:'image',asset:{sha256}};let retired=0,app,frame,lease;
  f.services.assets.resolve=async()=>[{descriptor,retire(){retired++;}}];
  try{
    app=await bootstrapApplication({id:'asset-engine',assets:[{id:'boot-image',kind:'image',sha256}],createScene:()=>()=>[]},f.services);
    const resource=app.assets.get('boot-image');assert(Object.isFrozen(resource));assert.equal(resourceOwner(resource),app.session.resources);
    descriptor.id='mutated-source';descriptor.generation=2;
    const canvas=new Canvas(),token={owner,sequence:1,metrics};canvas.image(resource,{x:0,y:0,width:1,height:1});frame=FrameRecording.capture(token,canvas).take(token);
    app.session.resources.releaseProducer(resource);assert.equal(retired,0);lease=app.session.resources.acquire(frame.resources);disposeFrame(frame);frame=undefined;assert.equal(retired,0);
    lease.returnBy('caller');assert.equal(retired,1);await app.dispose();assert.equal(retired,1);
  }finally{if(frame)disposeFrame(frame);if(lease&&!lease.released)lease.returnBy('caller');await app?.dispose();await f.engine.dispose();}
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
