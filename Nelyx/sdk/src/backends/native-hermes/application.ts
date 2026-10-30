// SPDX-License-Identifier: BSD-3-Clause
import {bootstrapApplication} from '../../runtime/bootstrap.ts';
import type {ApplicationDefinition,ViewRuntime} from '@nelyx/core/hosting/runtime';
import type {SurfaceEvent} from '@nelyx/core/hosting/services';
import type {PointerEvent,KeyEvent} from '@nelyx/core/ui/input';
import type {ViewMetrics} from '@nelyx/core/ui/types';
import type {NelyxGraphiteContext} from '@nelyx/skia-native/renderer';
import type {Skia} from '@nelyx/skia-native/skia/types/Skia';
import {createNativeAssetServices} from '../../runtime/native-assets.ts';
import type {NativeAssetConfiguration} from '../../runtime/native-assets.ts';
import {createNativeEngineServices} from '../../runtime/native-engine.ts';
import type {NativeEngineServices} from '../../runtime/native-engine.ts';
import {OwnedDisposal,finishOwnedDisposal} from '../../runtime/owned-disposal.ts';
import {NativeInteraction} from '../../runtime/native-interaction.ts';
import {createSurfaceFrameClock} from '../../runtime/frame-clock.ts';
import {nativeHermesBridge} from './bridge.ts';
import {connectNativeInteraction} from './interaction.ts';
import {createNativeServices} from './services.ts';
import {connectNativeEditing} from './editing.ts';
import {nativeHermesEnvironment} from './globals.ts';

/** RN-independent SDK composition. Core owns the same Widget/Element/layout
 * tree; the native host publishes already measured root metrics only. */
export async function startNativeHermesApplication(definition:ApplicationDefinition,configuration:NativeAssetConfiguration){
  nativeHermesEnvironment.claimApplication();
  try{return await composeNativeHermesApplication(definition,configuration);}catch(error){
    // Failures before the composition owner/listener exists still retire the
    // VM globals. A failed established drain retains its runtime dependencies.
    if(nativeHermesEnvironment.state==='open')try{nativeHermesEnvironment.beginClose();nativeHermesEnvironment.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Native VM bootstrap retirement failed');}
    throw error;
  }
}
async function composeNativeHermesApplication(definition:ApplicationDefinition,configuration:NativeAssetConfiguration){
  const bridge=nativeHermesBridge(),native=globalThis as unknown as {SkiaApi:Skia;SkiaViewApi:{makeGraphiteContext(id:number,width:number,height:number,opaque:boolean,highBitDepth:boolean,scale:number):NelyxGraphiteContext}};
  configuration={...configuration,sources:Object.fromEntries(Object.entries(configuration.sources).map(([id,source])=>{
    if(typeof source==='number'||!source.uri.startsWith('nelyx-asset:/'))return [id,source];
    // oxlint-disable-next-line no-control-regex -- Control code points are deliberately matched for input validation or normalization.
    const relative=source.uri.slice('nelyx-asset:/'.length),parts=relative.split('/');if(!relative||parts.some(part=>!part||part==='.'||part==='..'||/[\\:%?#\x00-\x1f]/.test(part)))throw new Error('Invalid native asset path');
    const root=bridge.assetRoot.replaceAll('\\','/').replace(/\/$/,'');return [id,{uri:'file:///'+root.slice(0,2)+'/'+root.slice(2).split('/').filter(Boolean).map(encodeURIComponent).join('/')+'/'+parts.map(encodeURIComponent).join('/')}];
  }))};
  const api=native.SkiaApi,owner=Object.freeze({id:'native-hermes:root',generation:1});
  let metrics:ViewMetrics={...bridge.metrics(),nativeContextGeneration:null},notify:((event:SurfaceEvent)=>void)|undefined,view:ViewRuntime|undefined,closed=false,visible=true;
  let context:NelyxGraphiteContext|undefined,engine:NativeEngineServices|undefined;
  // This resolver is a URI port, with no native module registry or RN startup.
  const assetBackend={api,resolveSource(source:unknown){return typeof source==='object'&&source!==null&&'uri'in source?source as {uri:string}:null;}};
  const assetServices=createNativeAssetServices(()=>assetBackend);
  let assetLease:ReturnType<typeof assetServices.acquire>|undefined,platform:ReturnType<typeof createNativeServices>|undefined;
  let app:Awaited<ReturnType<typeof bootstrapApplication>>|undefined,nativeEditing:ReturnType<typeof connectNativeEditing>|undefined;
  let nativeInteraction:ReturnType<typeof connectNativeInteraction>|undefined,clock:ReturnType<typeof createSurfaceFrameClock>|undefined;
  let interaction:NativeInteraction|undefined;
  let ready!:()=>void;const startupFinished=new Promise<void>(resolve=>{ready=resolve;});
  const fail=(error:unknown)=>nativeHermesEnvironment.reportError(error);
  let closing:Promise<void>|undefined,inputDiagnostics=0;const stopErrors:unknown[]=[];
  const shutdown=new OwnedDisposal([
    {name:'view-admission',run:()=>{if(stopErrors.length)throw new AggregateError(stopErrors,'Native View admission stop failed; owner retained');}},
    {name:'startup',run:()=>startupFinished},
    {name:'diagnostics',run:()=>{if(bridge.diagnostics)bridge.log('NELYX_NATIVE_VIEW '+JSON.stringify({status:view?.status,metrics:view?.currentMetrics,native:context?.nelyxStats()}));}},
    {name:'frame-clock',run:()=>clock?.dispose()},
    {name:'native-interaction',run:()=>nativeInteraction?.dispose()},
    {name:'native-editing',run:()=>nativeEditing?.dispose()},
    {name:'application',run:()=>app?.dispose()},
    {name:'native-engine',run:()=>engine?.dispose()},
    {name:'unused-context-close',run:()=>{if(!engine)context?.nelyxClose();}},
    {name:'unused-context-reset',run:()=>{if(!engine)context?.nelyxReset();}},
    {name:'unused-context-wrapper',run:()=>{if(!engine)context?.dispose();}},
    {name:'platform',run:()=>platform?.port.dispose()},
    {name:'interaction',run:()=>interaction?.dispose()},
    {name:'assets',run:()=>assetLease?.release()},
    {name:'vm-environment',run:()=>nativeHermesEnvironment.dispose()},
    {name:'completion',run:()=>bridge.completeShutdown()},
  ]);
  const close=()=>{
    if(closing)return closing;
    // Publish before clock cancellation can synchronously reenter native Close.
    let resolve!:()=>void,reject!:(error:unknown)=>void;closing=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});closed=true;
    try{view?.beginClose();}catch(error){stopErrors.push(error);}
    try{nativeHermesEnvironment.beginClose();}catch{/* The VM owner preserves this error for its final retirement step. */}
    void finishOwnedDisposal(()=>shutdown.dispose()).then(resolve,reject);return closing;
  };
  try{
  assetLease=assetServices.acquire(configuration);platform=createNativeServices(bridge);
  bridge.listen((kind,value)=>{
    if(kind==='service')return platform!.event(value);
    if(kind==='editor'||kind==='editor-ack')return nativeEditing?.event(kind,value);
    if(kind==='close'){void close().catch(fail);return;}if(closed)return;
    if(kind==='metrics'){metrics={...value as ViewMetrics,nativeContextGeneration:context?.nelyxIdentity()??null};notify?.({kind:'metrics',metrics});interaction?.surfaceChanged();view?.requestFrame();}
    else if(kind==='environment')platform!.environmentChanged();
    else if(kind==='visibility'){visible=value===true;notify?.({kind:'visibility',visible});engine?.setVisible(visible);if(visible)view?.requestFrame();}
    else if(kind==='pointer'){const event=value as PointerEvent;if(!view||!visible||event.viewportGeneration!==metrics.viewportGeneration||view.status!=='open')return false;view.dispatchPointer(event);if(bridge.diagnostics&&inputDiagnostics++<8)bridge.log('NELYX_NATIVE_INPUT '+JSON.stringify({event,status:view.status,metrics:view.currentMetrics}));return true;}
    else if(kind==='key')return view?.dispatchKey(value as KeyEvent);
    else if(kind.startsWith('native-key')||kind==='native-text')nativeEditing?.event(kind,value);
    else if(kind==='focus'){if(value)view?.dispatchKeyboardFocusGained();else view?.dispatchKeyboardFocusLost();}
    else return nativeInteraction?.event(kind,value);
  });
  const loaded=await assetLease.ready;
  if(closed){ready();await close();return;}
  context=native.SkiaViewApi.makeGraphiteContext(1,metrics.logicalWidth,metrics.logicalHeight,true,false,metrics.scale);
  metrics={...metrics,nativeContextGeneration:context.nelyxIdentity()};
  const activeEngine=engine=createNativeEngineServices({api,context,owner,assets:loaded,configuration,retirement:nativeHermesEnvironment.retirement,resolveSource:source=>assetBackend.resolveSource(source),assertOpen(){if(closed)throw new Error('Native application owner closed');}});
  const activeInteraction=interaction=new NativeInteraction(owner,{commands:true,selectionEvents:true,semantics:'native-controls',nativeSnapshots:true,geometry:'unavailable'});
  nativeInteraction=connectNativeInteraction(activeInteraction,bridge,()=>metrics);
  nativeEditing=connectNativeEditing(activeInteraction,bridge,fail);await nativeEditing.ready;
  if(closed){ready();await close();return;}
  const scheduler={request(callback:(timing?:import('@nelyx/core/foundation/clock').FrameTiming)=>void){return bridge.requestFrame((tick,dispatch)=>{try{callback({tick,dispatch,queueDelay:dispatch-tick,clockUncertainty:0});}catch(error){fail(error);}});},cancel:(id:number)=>bridge.cancelFrame(id)};
  clock=createSurfaceFrameClock({pending:()=>activeEngine.hasPendingSubmissions,poll:()=>activeEngine.pollNotifications(),onError:fail},scheduler);
  const supplied=definition.assets?definition:{...definition,assets:configuration.manifest.map(({id,kind,sha256})=>({id,kind,sha256}))};
  const started=app=await bootstrapApplication(supplied,{
    identity:{target:'windows',runtime:'hermes',host:'native-hermes',renderer:'skia-graphite',gpuBackend:'vulkan',gpuImplementation:'native-vulkan',profile:'native-hermes-graphite-vulkan'},
    reportError:fail,clock,
    platformMessages:platform.port,useDefaultBinaryMessenger:true,initializePlatformServices:true,
    surface:{owner,readMetrics:()=>metrics,attach(attached,changed){view=attached;notify=changed;if(closed)attached.beginClose();else nativeEditing!.bind(attached);return {dispose(){notify=undefined;view=undefined;}};},dispose(){}},
    assets:assetServices.service(configuration),
    ...activeEngine.services,
    editing:activeInteraction.editing,semantics:activeInteraction.semantics,
  });
  ready();if(closed){await close();return started;}
  started.view.requestFrame();bridge.log('NELYX_NATIVE_READY '+JSON.stringify({mode:bridge.mode,host:'native-hermes',metrics,editing:started.hostCapabilities.editing,semantics:started.hostCapabilities.semantics,displayList:1}));
  return started;
  }catch(error){ready();try{await close();}catch(cleanup){throw new AggregateError([error,cleanup],'Native application startup and shutdown failed');}throw error;}
}
