// SPDX-License-Identifier: BSD-3-Clause
import {OwnedDisposal,finishOwnedDisposal} from '../../runtime/owned-disposal.ts';
import {createNativeEngineServices} from '../../runtime/native-engine.ts';
import type {NativeEngineServices} from '../../runtime/native-engine.ts';
import type { LayoutChangeEvent } from 'react-native';

import type {SkiaGraphiteViewRef} from '@nelyx/skia-rn/views/graphite-types';
import { bootstrapApplication } from '../../runtime/bootstrap.ts';
import type { PlatformContext } from '@nelyx/core/hosting/platform';
import type { ApplicationDefinition } from '@nelyx/core/hosting/runtime';
import type {SurfaceEvent} from '@nelyx/core/hosting/services';
import type {PlatformMessagePort} from '@nelyx/core/hosting/platform-messages';
import {createReactNativePlatformMessages} from './platform-messages.ts';
import {PlatformException} from '@nelyx/core/services/message-codec';
import type {ReactNativePlatform} from '@nelyx/core/hosting/platform';
import {NativeInteraction} from '../../runtime/native-interaction.ts';
import {createReactNativeInteractionControls} from './interaction-controls.tsx';
import {nativeInputProps,nativeKeyboardProps} from './input.ts';
import {windowsCoreInputObserver} from '../../platforms/windows/input-trace.ts';
import {createWindowsKeyboardHost} from './windows-keyboard.tsx';
import {windowsSurfaceEnvelope,windowsInputSurfaceId} from './windows-surface-envelope.ts';
import {createAndroidEnvironment} from './android-environment.tsx';
import {createAndroidKeyboardHost} from './android-keyboard.tsx';
import {freezeEnvironment} from '@nelyx/core/ui/frame';
import {bindReactNativeVisibility} from './lifecycle.ts';
import type {ReactNativeAppStatePort} from './lifecycle.ts';
import {createSurfaceFrameClock} from '../../runtime/frame-clock.ts';
import type {SurfaceFrameScheduler} from '../../runtime/frame-clock.ts';
import type {ReactNativeBackend} from './registration.ts';
import type {NativeAssetConfiguration,createNativeAssetServices} from '../../runtime/native-assets.ts';
import type {createReactNativeEnvironment} from './environment.ts';
import type {ComposedApplication} from '../../runtime/bootstrap.ts';
import type {TextLayoutService,TextLayout,TextGlyphRun,ViewOwner} from '@nelyx/core/ui/types';
import type { ViewMetrics,ViewEnvironment } from '@nelyx/core/ui/types';
import type { NelyxGraphiteContext } from '@nelyx/skia-native/renderer';

export interface ReactNativeSurfaceProps {
  readonly initializePlatformServices?:boolean;
  /** One transferred port per effect owner; replacing it requires a remount. */
  readonly platformMessages?:PlatformMessagePort;
  readonly useDefaultBinaryMessenger?:boolean;
  readonly definition: ApplicationDefinition;
  readonly assets?: NativeAssetConfiguration;
  /** Caller-owned controller; the surface owns only its application service lease. */
  readonly interaction?: NativeInteraction;
  readonly generation: number;
  readonly viewId?: string;
  readonly initialize?: (context: PlatformContext<ReactNativeTextService>, metrics: ViewMetrics) => void;
  readonly onReady: (application: ReactNativeApplication) => void;
  /** Matching native surface update; OS display/scanout remains unobserved. */
  readonly onFirstContentReady?: (application:ReactNativeApplication) => void;
  readonly onMetrics?: (application: ReactNativeApplication, metrics: ViewMetrics) => void;
  readonly onClose?: (application: ReactNativeApplication) => void;
  readonly onStatus?: (ready: boolean) => void;
  readonly onError: (error: unknown) => void;
}
export interface ReactNativeTextService extends TextLayoutService {
  glyphRuns(layout: TextLayout): readonly TextGlyphRun[];
}
export interface ReactNativeApplication extends ComposedApplication<ReactNativeTextService> {}
export interface ReactNativeViewMetrics {
  readonly logicalWidth:number;readonly logicalHeight:number;
  readonly physicalWidth:number;readonly physicalHeight:number;readonly scale:number;
  readonly nativeSurfaceGeneration:number;
  /** A backing can change within one owner; a new native owner requires remount. */
  readonly nativeViewGeneration?:number;
  /** Fabric identity for native services; distinct from Skia's content id. */
  readonly nativeReactTag?:number;
}
export interface ReactNativeSurfaceBinding {
  ready(metrics:ReactNativeViewMetrics):void;
  visibility(visible:boolean,preparing?:boolean):void;
  firstContentReady?():void;
  failed(error:unknown):void;
}
type NativeAssetLease=ReturnType<ReturnType<typeof createNativeAssetServices>['acquire']>;
interface ReactNativeSurfaceOwner {
  engine?:NativeEngineServices;
  readonly epoch:number;readonly interaction:NativeInteraction;
  alive:boolean;closed:boolean;active:boolean;nativeReady:boolean;nativeVisible:boolean;preparing?:boolean;firstContent?:boolean;firstContentNotified?:boolean;
  assets?:Awaited<NativeAssetLease['ready']>;lease?:NativeAssetLease;
  metrics?:ViewMetrics;layout?:{width:number;height:number};nativeMetrics?:ReactNativeViewMetrics;
  environment?:ViewEnvironment;environmentRevision?:number;
  notify?:(event:SurfaceEvent)=>void;application?:ReactNativeApplication;opening?:Promise<ReactNativeApplication>;
  view?:import('@nelyx/core/hosting/runtime').ViewRuntime;
  setVisible?:(visible:boolean)=>void;
  stopFrames?:()=>void;stopVisibility?:()=>void;close?:()=>Promise<void>;closing?:Promise<void>;
  interactionServices?:ReturnType<NativeInteraction['acquireServices']>;
  input?:ReactNativeSurfaceInputLease;
}

const failedOwners = new Set<unknown>(); // A failed drain must retain its native dependencies.

/** dispose fences ingress synchronously and resolves only after native retirement. */
export interface ReactNativeSurfaceInputLease {readonly ready:Promise<void>;dispose():Promise<void>}

export interface ReactNativeSurfaceAdapter<Props extends ReactNativeSurfaceProps> {
  readonly target:string;
  backend():ReactNativeBackend;
  assets():NativeAssetConfiguration;
  readonly assetServices:Pick<ReturnType<typeof createNativeAssetServices>,'acquire'|'service'>;
  readonly environment:ReturnType<typeof createReactNativeEnvironment>;
  visibility():ReactNativeAppStatePort;
  frameScheduler?():SurfaceFrameScheduler;
  interaction(owner:ViewOwner):NativeInteraction;
  readonly interactionControls?:import('react').ComponentType<ReactNativeSemanticsControlsProps>;
  readonly requiresNativeBinding?:boolean;
  /** A host can close before React runs this surface's initial effect. */
  isClosing?():boolean;
  /** Native host shutdown must await this same effect owner's complete drain. */
  retainOwner?(close:()=>Promise<void>):{release():void};
  nativeViewProps(props:Props,binding:ReactNativeSurfaceBinding):Record<string,unknown>;
  openInput?(interaction:NativeInteraction,view:import('@nelyx/core/hosting/runtime').ViewRuntime,metrics:ReactNativeViewMetrics,onError:(error:unknown)=>void):ReactNativeSurfaceInputLease;
}
export interface ReactNativeSemanticsControlsProps {
  readonly accessibilityEnabled?:boolean;
  readonly interaction:NativeInteraction;
  readonly readView:()=>import('@nelyx/core/hosting/runtime').ViewRuntime|undefined;
  readonly readNativeMetrics:()=>ReactNativeViewMetrics|undefined;
  readonly onError:(error:unknown)=>void;
}
/** Shared RN surface ownership. The adapter supplies native view attributes, visibility and input policy. */
export function createReactNativeSurface<Props extends ReactNativeSurfaceProps>(adapter:ReactNativeSurfaceAdapter<Props>) {
 const InteractionControls=adapter.interactionControls??createReactNativeInteractionControls(adapter.backend);
 const AndroidEnvironment=createAndroidEnvironment(adapter.backend);
 const AndroidKeyboardHost=createAndroidKeyboardHost(adapter.backend);
 const WindowsKeyboardHost=createWindowsKeyboardHost(adapter.backend);
 return function ApplicationSurface(props:Props) {
  const {react:{createElement,useEffect,useRef,useState},native:{PixelRatio,View},skia:{Skia,SkiaGraphiteView}}=adapter.backend();
  const latest = useRef(props); latest.current = props;
  const ref = useRef<SkiaGraphiteViewRef>(null);
  const keyboardHost=useRef<import('react-native').View>(null);
  const androidKeyboardHost=useRef<import('./android-keyboard.tsx').AndroidKeyboardHandle>(null);
  const initial=useRef({configuration:props.assets ?? adapter.assets(),interaction:props.interaction}).current;
  const configuration=initial.configuration;
  const viewOwner=useRef(Object.freeze({id:props.viewId ?? `${props.definition.id}:${adapter.target}`,generation:props.generation})).current;
  if(props.generation!==viewOwner.generation || (props.viewId ?? `${props.definition.id}:${adapter.target}`)!==viewOwner.id)
    throw new Error('React Native surface owner/generation changes require a component remount');
  if(props.interaction!==initial.interaction || props.assets && props.assets!==configuration)throw new Error('React Native surface interaction/assets changes require a component remount');
  if (initial.interaction && (initial.interaction.owner.id!==viewOwner.id || initial.interaction.owner.generation!==viewOwner.generation)) throw new Error('React Native interaction/surface owner mismatch');
  const [readyOwner, setReadyOwner] = useState<ReactNativeSurfaceOwner|null>(null);
  const [cursorState,setCursorState]=useState({epoch:0,kind:'basic'});
  const life = useRef<ReactNativeSurfaceOwner|undefined>(undefined),epoch=useRef(0);
  const current=(owner:ReactNativeSurfaceOwner)=>life.current===owner && owner.alive && !owner.closed;
  const visible=(owner:ReactNativeSurfaceOwner)=>owner.preparing===true||owner.active && owner.nativeVisible;
  const fail=(owner:ReactNativeSurfaceOwner,error:unknown)=>{
    if(life.current!==owner || !owner.alive)return;owner.alive=false;owner.closed=true;owner.stopVisibility?.();owner.stopFrames?.();setReadyOwner(null);
    void finishOwnedDisposal(()=>owner.close?.()).catch(failure=>{failedOwners.add(owner);if(failure!==error)latest.current.onError(failure);});
    latest.current.onStatus?.(false);latest.current.onError(error);
  };
  useEffect(() => {
    if(adapter.isClosing?.()){setReadyOwner(null);latest.current.onStatus?.(false);return;}
    const previous=life.current,interaction=initial.interaction ?? adapter.interaction(viewOwner);
    if(interaction.owner.id!==viewOwner.id || interaction.owner.generation!==viewOwner.generation)throw new Error('React Native interaction/surface owner mismatch');
    const owner:ReactNativeSurfaceOwner={epoch:++epoch.current,interaction,alive:true,closed:false,active:adapter.visibility().currentState==='active',nativeReady:!adapter.requiresNativeBinding,nativeVisible:!adapter.requiresNativeBinding};
    life.current = owner;setReadyOwner(null);latest.current.onStatus?.(false);
    let hostOwner:{release():void}|undefined;
    let disposal:OwnedDisposal|undefined;
    owner.close=()=>{
      if(disposal)return disposal.dispose();
      let application:ReactNativeApplication|undefined;const stopErrors:unknown[]=[];
      disposal=new OwnedDisposal([
        {name:'stop',run:()=>{if(stopErrors.length)throw new AggregateError(stopErrors,'Surface ingress stop failed; owner retained');}},
        {name:'previous',run:()=>previous?.closing},
        {name:'opening',run:async()=>{application=owner.application??await owner.opening;}},
        {name:'native-input',run:()=>owner.input?.dispose()},
        {name:'application',run:()=>application?.dispose()},
        {name:'native-engine',run:()=>owner.engine?.dispose()},
        {name:'close-observer',run:()=>{if(application)latest.current.onClose?.(application);}},
        {name:'interaction-services',run:()=>owner.interactionServices?.release()},
        {name:'interaction',run:()=>{if(!initial.interaction)interaction.dispose();}},
        {name:'asset-lease',run:()=>owner.lease?.release()},
        {name:'native-host-lease',run:()=>hostOwner?.release()},
        {name:'completion',run:()=>{failedOwners.delete(owner);}},
      ],promise=>{owner.closing=promise;});
      const closing=disposal.dispose(); // Publish before stop callbacks can reenter.
      owner.alive=false;owner.closed=true;
      for(const stop of [()=>owner.view?.beginClose(),()=>owner.stopVisibility?.(),()=>owner.stopFrames?.(),()=>{void owner.input?.dispose().catch(()=>{});}])try{stop();}catch(error){stopErrors.push(error);}
      return closing;
    };
    const closeOwner=()=>finishOwnedDisposal(()=>owner.close!());
    try {
      hostOwner=adapter.retainOwner?.(()=>{
        // A native shutdown can start while this React effect stays mounted.
        // Remove its native child as well as draining its application owner.
        if(current(owner))setReadyOwner(null);
        return owner.close!();
      });
      const visibility=bindReactNativeVisibility(adapter.visibility(),visible=>{
        if(!current(owner))return;owner.active=visible;
        const shown=owner.preparing===true||visible && owner.nativeVisible;owner.notify?.({kind:'visibility',visible:shown});
        const application=owner.application;
        if(application){owner.setVisible?.(shown);if(shown)application.view.requestFrame();}
      });
      owner.active=visibility.visible;owner.stopVisibility=()=>visibility.dispose();
      if(props.definition.createView){
        const updateTextScale=(scale:number)=>{const known=Number.isFinite(scale)&&scale>0;owner.environment=freezeEnvironment({...owner.environment??{safeArea:{top:0,right:0,bottom:0,left:0},safeAreaSource:'application',keyboardInset:0,keyboardSource:'unavailable'},textScale:known?scale:1,textScaleSource:known?'native':'application'});};
        updateTextScale(adapter.backend().native.Dimensions.get('window').fontScale);
        const dimensions=adapter.backend().native.Dimensions.addEventListener('change',event=>{if(!current(owner)||(adapter.target==='android'&&(owner.environmentRevision??0)>0))return;try{updateTextScale(event.window.fontScale);openOrUpdate(owner);}catch(error){fail(owner,error);}});
        owner.stopVisibility=()=>{visibility.dispose();dimensions.remove();};
      }
      const assetLease=owner.lease=adapter.assetServices.acquire(configuration);
      Promise.all([assetLease.ready,previous?.closing]).then(([assets])=>{owner.assets=assets;if(current(owner))setReadyOwner(owner);}).catch(error=>fail(owner,error));
    } catch(error) {
      if(adapter.isClosing?.()){
        owner.alive=false;owner.closed=true;setReadyOwner(null);latest.current.onStatus?.(false);
        closeOwner().catch(failure=>{failedOwners.add(owner);latest.current.onError(failure);});
      }else fail(owner,error);
    }
    return () => {
      owner.alive=false;owner.closed=true;owner.stopVisibility?.();owner.stopFrames?.();
      closeOwner().catch(error => { failedOwners.add(owner); latest.current.onError(error); });
    };
  // A new definition (including a React Refresh scene edit) replaces this
  // session only after its preceding owner has completed the same close path.
  }, [props.definition]);
  const mount = (owner:ReactNativeSurfaceOwner,event: LayoutChangeEvent) => {
    if(!current(owner))return;owner.layout=event.nativeEvent.layout;openOrUpdate(owner);
  };
  const openOrUpdate = (owner:ReactNativeSurfaceOwner) => {
    const assets = owner.assets, native = ref.current;
    try {
    if(!owner.layout)return;const {width,height}=owner.layout;
    if (!current(owner) || !owner.nativeReady || !assets || !native || (!owner.application && (width <= 0 || height <= 0))) return;
    const scale = owner.nativeMetrics?.scale ?? PixelRatio.get();
    const metrics: ViewMetrics = { logicalWidth: owner.nativeMetrics?.logicalWidth ?? width, logicalHeight: owner.nativeMetrics?.logicalHeight ?? height, physicalWidth: owner.nativeMetrics?.physicalWidth ?? Math.round(width * scale), physicalHeight: owner.nativeMetrics?.physicalHeight ?? Math.round(height * scale), scale,
      viewportGeneration: (owner.application?.view.currentMetrics.viewportGeneration ?? 0) + 1, rendererGeneration: 1,
      nativeContextGeneration: owner.application?.view.currentMetrics.nativeContextGeneration ?? 1, nativeSurfaceGeneration: owner.nativeMetrics?.nativeSurfaceGeneration ?? null,...(owner.environment?{environment:owner.environment}:{}) };
    if(owner.metrics && (['logicalWidth','logicalHeight','physicalWidth','physicalHeight','scale','nativeSurfaceGeneration'] as const).every(key=>metrics[key]===owner.metrics![key])&&JSON.stringify(metrics.environment)===JSON.stringify(owner.metrics.environment))return;
    if (owner.application) {
      owner.metrics=metrics;owner.notify?.({kind:'metrics',metrics});
      owner.interaction.surfaceChanged();
      latest.current.onMetrics?.(owner.application, metrics);
      owner.application.view.requestFrame(); return;
    }
    if (owner.opening) {
      owner.metrics={...metrics,viewportGeneration:(owner.metrics?.viewportGeneration ?? 0)+1,nativeContextGeneration:owner.metrics!.nativeContextGeneration};
      return;
    }
    const context = native.getContext() as NelyxGraphiteContext;
    owner.metrics={...metrics,nativeContextGeneration:context.nelyxIdentity()};
    const assetImage=adapter.backend().native.Image;
    const engine=owner.engine=createNativeEngineServices({api:Skia,context,owner:viewOwner,assets,configuration,resolveSource:source=>assetImage.resolveAssetSource(source),assertOpen(){if(owner.closed)throw new Error('Native surface owner closed');}});
    const frameClock=createSurfaceFrameClock({pending:()=>engine.hasPendingSubmissions,poll:()=>engine.pollNotifications(),onError:error=>fail(owner,error)},adapter.frameScheduler?.()??{request:callback=>requestAnimationFrame(()=>callback()),cancel:id=>cancelAnimationFrame(id)});
    owner.stopFrames=()=>frameClock.dispose();
    const stopNotifications=owner.stopFrames;
    const profile = adapter.backend().profile;
    const interaction=owner.interactionServices=owner.interaction.acquireServices();
    const definition=props.definition.assets?props.definition:{...props.definition,assets:configuration.manifest.map(({id,kind,sha256})=>({id,kind,sha256}))};
    const observeInput=adapter.target==='windows'?windowsCoreInputObserver():undefined;
    owner.opening = bootstrapApplication(definition, {
      platformMessages:props.platformMessages??createReactNativePlatformMessages(adapter.backend().native,adapter.target as ReactNativePlatform,adapter.visibility(),{activate(kind){if(!current(owner))throw new PlatformException({code:'closed-owner',message:'Native cursor View is retired'});const view=ref.current as (SkiaGraphiteViewRef&{getMouseCursorVersion?:()=>number})|null;if(view?.getMouseCursorVersion?.()!==1)throw new PlatformException({code:'native-cursor-cohort',message:'Native cursor protocol1 requires matching rebuilt Skia View sources'});setCursorState({epoch:owner.epoch,kind});},dispose(){if(current(owner))setCursorState({epoch:owner.epoch,kind:'basic'});}},{viewId:0,isLive:()=>current(owner)&&visible(owner),rootTag(){return adapter.target==='android'?androidKeyboardHost.current?.getNativeTag()??null:adapter.backend().native.findNodeHandle(keyboardHost.current);},nodeTag:id=>owner.interaction.nativeSemanticsTag(id)},{key:definition.id},definition.accessibilityEnabled!==false),
      initializePlatformServices:props.initializePlatformServices??!props.platformMessages,
      ...(props.useDefaultBinaryMessenger?{useDefaultBinaryMessenger:true}:{}),
      reportError:error=>fail(owner,error),
      ...(observeInput?{observeInput}:{}),
      identity:profile.identity,
      surface:{owner:viewOwner,readMetrics:()=>owner.metrics!,attach(view,notify){owner.view=view;owner.notify=notify;if(!current(owner))view.beginClose();notify({kind:'visibility',visible:visible(owner)});return {dispose(){owner.closed=true;stopNotifications();delete owner.notify;delete owner.view;}};},dispose:()=>{owner.closed=true;stopNotifications();return owner.lease!.release();}},
      ...engine.services,assets:adapter.assetServices.service(configuration),
      clock:frameClock,
      editing:interaction.editing,semantics:interaction.semantics,
    }, latest.current.initialize?services => latest.current.initialize?.(services, owner.metrics!):undefined);
    owner.opening.then(async application => {
      owner.application = application;
      if (!current(owner)) return;
      if(adapter.openInput&&props.definition.createView){
        if(!owner.nativeMetrics)throw new Error('Native input requires the admitted surface identity');
        const input=owner.input=adapter.openInput(owner.interaction,application.view,owner.nativeMetrics,error=>fail(owner,error));
        await input.ready;if(!current(owner))return;
      }
      if(application.view.currentMetrics!==owner.metrics && application.view.currentMetrics.viewportGeneration<owner.metrics!.viewportGeneration) {
        owner.notify?.({kind:'metrics',metrics:owner.metrics!});latest.current.onMetrics?.(application,owner.metrics!);
      }
      owner.setVisible=value=>engine.setVisible(value);
      engine.setVisible(visible(owner)); application.view.requestFrame();
      latest.current.onStatus?.(true); latest.current.onReady(application);
      if(owner.firstContent&&!owner.firstContentNotified){owner.firstContentNotified=true;latest.current.onFirstContentReady?.(application);}
    }).catch(error => fail(owner,error));
    } catch(error) {fail(owner,error);}
  };
  if (!readyOwner || !current(readyOwner)) return createElement(View, {style: {flex: 1}});
  const owner=readyOwner;
  const binding:ReactNativeSurfaceBinding={
    ready(metrics){if(!current(owner))return;
      if(owner.nativeMetrics && (metrics.nativeViewGeneration!==owner.nativeMetrics.nativeViewGeneration||metrics.nativeReactTag!==owner.nativeMetrics.nativeReactTag)){fail(owner,new Error('Native view owner changed; remount the application surface'));return;}
      if(owner.nativeMetrics){if(metrics.nativeSurfaceGeneration<owner.nativeMetrics.nativeSurfaceGeneration){fail(owner,new Error('Native surface generation regressed'));return;}
        if(metrics.nativeSurfaceGeneration===owner.nativeMetrics.nativeSurfaceGeneration){if(!(['logicalWidth','logicalHeight','physicalWidth','physicalHeight','scale'] as const).every(key=>metrics[key]===owner.nativeMetrics![key]))fail(owner,new Error('Native backing changed without a new generation'));return;}}
      owner.nativeReady=true;owner.nativeMetrics=metrics;openOrUpdate(owner);},
    firstContentReady(){if(!current(owner))return;owner.firstContent=true;if(owner.application&&!owner.firstContentNotified){owner.firstContentNotified=true;latest.current.onFirstContentReady?.(owner.application);}},
    visibility(value,preparing){if(!current(owner))return;owner.nativeVisible=value;owner.preparing=preparing===true;const shown=visible(owner);owner.notify?.({kind:'visibility',visible:shown});if(owner.application){owner.setVisible?.(shown);if(shown)owner.application.view.requestFrame();}},
    failed(error){fail(owner,error);},
  };
  const accessibilityProps=props.definition.accessibilityEnabled===false?{accessible:false,accessibilityElementsHidden:true,importantForAccessibility:'no-hide-descendants' as const}:{};
  const hostProps={...accessibilityProps,ref:keyboardHost,style:{flex:1,position:'relative'} as const};
  const pointerConfig=adapter.target==='android'?adapter.backend().native.UIManager.getViewManagerConfig('SkiaView'):undefined;
  const pointerConstants=pointerConfig&&'Constants'in pointerConfig?pointerConfig.Constants:undefined;
  const children=[
    createElement(SkiaGraphiteView, {...adapter.nativeViewProps(props,binding),...nativeInputProps(adapter.target,()=>current(owner)?owner.application?.view:undefined,()=>{if(adapter.target==='android')androidKeyboardHost.current?.focus();else keyboardHost.current?.focus();},()=>current(owner)?owner.nativeMetrics?.nativeViewGeneration:undefined,()=>current(owner)?ref.current?.getNativeId():undefined,pointerConstants),...(adapter.target==='windows'?{collapsable:false,testID:windowsInputSurfaceId(viewOwner)}:{}),mouseCursor:cursorState.epoch===owner.epoch?cursorState.kind:'basic',key:`surface:${owner.epoch}`,ref,style:{flex:1},onLayout:event=>mount(owner,event)}),
    props.definition.createView&&(props.definition.accessibilityEnabled!==false||adapter.target!=='windows')?createElement(InteractionControls,{key:`controls:${owner.epoch}`,interaction:owner.interaction,accessibilityEnabled:props.definition.accessibilityEnabled!==false,readView:()=>current(owner)?owner.application?.view:undefined,readNativeMetrics:()=>current(owner)?owner.nativeMetrics:undefined,onError:error=>fail(owner,error)}):null,
    props.definition.createView&&adapter.target==='android'?createElement(AndroidEnvironment,{key:`environment:${owner.epoch}`,changed(snapshot){if(!current(owner)||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<=(owner.environmentRevision??0))return;try{owner.environment=freezeEnvironment(snapshot.environment);owner.environmentRevision=snapshot.revision;openOrUpdate(owner);}catch(error){fail(owner,error);}}}):null];
  if(adapter.target==='windows'){
    // Native focus may name a nonvisual Core semantics descendant. Routed
    // keyboard packets still belong to this surface's single input lease.
    const envelope={collapsable:false,testID:windowsSurfaceEnvelope(hostProps.style)};
    return createElement(View,{...accessibilityProps,style:hostProps.style,...envelope},createElement(WindowsKeyboardHost,{...hostProps,...envelope,key:owner.epoch,readView:()=>current(owner)?owner.application?.view:undefined},...children));
  }
  return adapter.target==='android'?createElement(AndroidKeyboardHost,{...hostProps,ref:androidKeyboardHost,key:owner.epoch,readView:()=>current(owner)?owner.application?.view:undefined,reportError:error=>fail(owner,error)},...children):createElement(View,{...hostProps,...nativeKeyboardProps(adapter.target,()=>current(owner)?owner.application?.view:undefined)},...children);
}
}
