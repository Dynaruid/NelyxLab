// SPDX-License-Identifier: BSD-3-Clause
import {bootstrapApplication} from '../../runtime/bootstrap.ts';
import type {ApplicationDefinition,ViewRuntime} from '@nelyx/core/hosting/runtime';
import type {SurfaceEvent} from '@nelyx/core/hosting/services';
import type {PointerEvent,KeyEvent} from '@nelyx/core/ui/input';
import type {ViewMetrics} from '@nelyx/core/ui/types';
import {GraphiteRenderer,createPathQueries,createRuntimeShaderCache} from '@nelyx/skia-rn/renderer';
import type {NelyxGraphiteContext} from '@nelyx/skia-rn/renderer';
import {ReactNativeTextLayoutService} from '@nelyx/skia-rn/text';
import type {Skia} from '@nelyx/skia-rn/skia/types/Skia';
import {FramePictureService} from '@nelyx/core/hosting/pictures';
import {RasterizationService} from '@nelyx/core/hosting/rasterization';
import {ImageService} from '@nelyx/core/hosting/images';
import {createFramePictureBackend} from '@nelyx/skia-rn/pictures';
import {createRasterizationBackend} from '@nelyx/skia-rn/rasterization';
import {createReactNativeAssetServices} from '../react-native/assets.ts';
import type {ReactNativeAssetConfiguration} from '../react-native/assets.ts';
import {createReactNativeImageBackend} from '../react-native/images.ts';
import {NativeImageMemory} from '../react-native/image-memory.ts';
import {ReactNativeInteraction} from '../react-native/interaction.ts';
import {createReactNativeFrameClock} from '../react-native/lifecycle.ts';
import {nativeHermesBridge} from './bridge.ts';
import {connectNativeInteraction} from './interaction.ts';
import {createNativeServices} from './services.ts';
import {connectNativeEditing} from './editing.ts';

/** RN-independent SDK composition. Core owns the same Widget/Element/layout
 * tree; the native host publishes already measured root metrics only. */
export async function startNativeHermesApplication(definition:ApplicationDefinition,configuration:ReactNativeAssetConfiguration){
  const bridge=nativeHermesBridge(),native=globalThis as unknown as {SkiaApi:Skia;SkiaViewApi:{makeGraphiteContext(id:number,width:number,height:number,opaque:boolean,highBitDepth:boolean,scale:number):NelyxGraphiteContext}};
  configuration={...configuration,sources:Object.fromEntries(Object.entries(configuration.sources).map(([id,source])=>{
    if(typeof source==='number'||!source.uri.startsWith('nelyx-asset:/'))return [id,source];
    const relative=source.uri.slice('nelyx-asset:/'.length),parts=relative.split('/');if(!relative||parts.some(part=>!part||part==='.'||part==='..'||/[\\:%?#\x00-\x1f]/.test(part)))throw new Error('Invalid native asset path');
    const root=bridge.assetRoot.replaceAll('\\','/').replace(/\/$/,'');return [id,{uri:'file:///'+root.slice(0,2)+'/'+root.slice(2).split('/').filter(Boolean).map(encodeURIComponent).join('/')+'/'+parts.map(encodeURIComponent).join('/')}];
  }))};
  const api=native.SkiaApi,owner=Object.freeze({id:'native-hermes:root',generation:1});
  let metrics:ViewMetrics={...bridge.metrics(),nativeContextGeneration:null},notify:((event:SurfaceEvent)=>void)|undefined,view:ViewRuntime|undefined,closed=false,visible=true;
  const context=native.SkiaViewApi.makeGraphiteContext(1,metrics.logicalWidth,metrics.logicalHeight,true,false,metrics.scale);
  metrics={...metrics,nativeContextGeneration:context.nelyxIdentity()};
  // This resolver is a URI port, with no native module registry or RN startup.
  const assetBackend={native:{Image:{resolveAssetSource(source:unknown){return typeof source==='object'&&source!==null&&'uri'in source?source as {uri:string}:null;}}},skia:{Skia:api}};
  const assetServices=createReactNativeAssetServices(()=>assetBackend),assetLease=assetServices.acquire(configuration),platform=createNativeServices(bridge);
  let app:Awaited<ReturnType<typeof bootstrapApplication>>|undefined,nativeEditing:ReturnType<typeof connectNativeEditing>|undefined;
  let nativeInteraction:ReturnType<typeof connectNativeInteraction>|undefined,clock:ReturnType<typeof createReactNativeFrameClock>|undefined,programs:ReturnType<typeof createRuntimeShaderCache>|undefined;
  let ready!:()=>void;const startupFinished=new Promise<void>(resolve=>{ready=resolve;});
  const fail=(error:unknown)=>bridge.fail(error instanceof Error?error.stack??error.message:String(error));
  let closing:Promise<void>|undefined,inputDiagnostics=0;
  const close=()=>closing??=(async()=>{closed=true;await startupFinished;if(bridge.diagnostics)bridge.log('NELYX_NATIVE_VIEW '+JSON.stringify({status:view?.status,metrics:view?.currentMetrics,native:context.nelyxStats()}));nativeInteraction?.dispose();await nativeEditing?.dispose();clock?.dispose();await app?.dispose();await platform.port.dispose();programs?.dispose();await assetLease.release();bridge.completeShutdown();})();
  bridge.listen((kind,value)=>{
    if(kind==='service')return platform.event(value);
    if(kind==='editor'||kind==='editor-ack')return nativeEditing?.event(kind,value);
    if(kind==='close'){void close().catch(fail);return;}if(closed)return;
    if(kind==='metrics'){metrics={...value as ViewMetrics,nativeContextGeneration:context.nelyxIdentity()};notify?.({kind:'metrics',metrics});interaction?.surfaceChanged();view?.requestFrame();}
    else if(kind==='environment')platform.environmentChanged();
    else if(kind==='visibility'){visible=value===true;notify?.({kind:'visibility',visible});renderer?.setVisible(visible);if(visible)view?.requestFrame();}
    else if(kind==='pointer'){const event=value as PointerEvent;if(!view||!visible||event.viewportGeneration!==metrics.viewportGeneration||view.status!=='open')return false;view.dispatchPointer(event);if(bridge.diagnostics&&inputDiagnostics++<8)bridge.log('NELYX_NATIVE_INPUT '+JSON.stringify({event,status:view.status,metrics:view.currentMetrics}));return true;}
    else if(kind==='key')return view?.dispatchKey(value as KeyEvent);
    else if(kind.startsWith('native-key')||kind==='native-text')nativeEditing?.event(kind,value);
    else if(kind==='focus'){if(value)view?.dispatchKeyboardFocusGained();else view?.dispatchKeyboardFocusLost();}
    else return nativeInteraction?.event(kind,value);
  });
  let text!:ReactNativeTextLayoutService,renderer!:GraphiteRenderer;
  let interaction:ReactNativeInteraction|undefined;
  try{
  const loaded=await assetLease.ready,images=new Map(loaded.images),memory=new NativeImageMemory();
  if(closed){ready();await close();return;}
  const runtimePrograms=programs=createRuntimeShaderCache(api);
  const image=(key:string)=>{const value=images.get(key);if(!value)throw new Error('Stale native Hermes image');return value;};
  const pictures=createFramePictureBackend(api,{runtimePrograms,image,paragraph:key=>text.paintResource(key),picture:key=>pictures.picture(key)},()=>context.nelyxIdentity());
  const activeInteraction=interaction=new ReactNativeInteraction(owner,{commands:true,selectionEvents:true,semantics:'native-controls',nativeSnapshots:true,geometry:'unavailable'});
  nativeInteraction=connectNativeInteraction(activeInteraction,bridge,()=>metrics);
  nativeEditing=connectNativeEditing(activeInteraction,bridge,fail);await nativeEditing.ready;
  const scheduler={request(callback:(timing?:import('@nelyx/core/foundation/clock').FrameTiming)=>void){return bridge.requestFrame((tick,dispatch)=>callback({tick,dispatch,queueDelay:dispatch-tick,clockUncertainty:0}));},cancel:(id:number)=>bridge.cancelFrame(id)};
  clock=createReactNativeFrameClock({pending:()=>!!renderer?.hasPendingSubmissions,poll:()=>renderer.pollNotifications(),onError:fail},scheduler);
  const supplied=definition.assets?definition:{...definition,assets:configuration.manifest.map(({id,kind,sha256})=>({id,kind,sha256}))};
  const started=app=await bootstrapApplication(supplied,{
    identity:{target:'windows',runtime:'hermes',host:'native-hermes',renderer:'skia-graphite',gpuBackend:'vulkan',gpuImplementation:'native-vulkan',profile:'native-hermes-graphite-vulkan'},
    reportError:fail,clock,
    platformMessages:platform.port,useDefaultBinaryMessenger:true,initializePlatformServices:true,
    surface:{owner,readMetrics:()=>metrics,attach(attached,changed){view=attached;notify=changed;nativeEditing!.bind(attached);return {dispose(){notify=undefined;view=undefined;}};},dispose(){}},
    assets:assetServices.service(configuration),
    renderer:{create:()=>renderer=new GraphiteRenderer(api,()=>context,owner,{nativeDisplayLists:true,runtimePrograms,image,paragraph:key=>text.paintResource(key),picture:key=>pictures.picture(key)})},
    text:{create:resources=>text=new ReactNativeTextLayoutService(api,resources,owner,loaded.fonts,image,runtimePrograms)},
    editing:activeInteraction.editing,semantics:activeInteraction.semantics,
    paths:createPathQueries(api,()=>{if(closed)throw new Error('Native path owner retired');}),
    pictures:{create:resources=>new FramePictureService(resources,pictures,owner)},
    rasterization:{create:resources=>new RasterizationService(resources,createRasterizationBackend(api,images,{runtimePrograms,image,paragraph:key=>text.paintResource(key),picture:key=>pictures.picture(key)},owner,memory,()=>{if(closed)throw new Error('Native raster owner retired');},resource=>resources.isRetained(resource),()=>resources.allocateId('native:raster')))},
    images:{create:(resources,clock,time)=>new ImageService(resources,createReactNativeImageBackend(api,assetBackend.native,images,configuration,owner,memory,()=>resources.allocateId('native:image')),clock,time)},
  });
  ready();if(closed){await close();return started;}
  started.view.requestFrame();bridge.log('NELYX_NATIVE_READY '+JSON.stringify({mode:bridge.mode,host:'native-hermes',metrics,editing:started.hostCapabilities.editing,semantics:started.hostCapabilities.semantics,displayList:1}));
  return started;
  }catch(error){ready();try{await close();}catch(cleanup){throw new AggregateError([error,cleanup],'Native application startup and shutdown failed');}throw error;}
}
