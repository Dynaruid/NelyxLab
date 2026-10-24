// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// ServicesBinding lifecycle/system ownership adapted from services/binding.dart.
// The typed environment snapshot is an Nelyx embedding extension.
import type {Disposable} from '../foundation/disposable.ts';
import type {BinaryMessenger} from './binary-messenger.ts';
import {PlatformChannelBinding} from './channel-binding.ts';
import {SystemChannelSet} from './system-channels.ts';
import {BasicMessageChannel,MethodChannel} from './platform-channel.ts';
import {JSONMessageCodec,JSONMethodCodec} from './message-codecs.ts';
import {FlutterError} from '../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../foundation/assertions.ts';
import {PlatformException} from './message-codec.ts';
import {Clipboard} from './clipboard.ts';
import {RootIsolateToken} from '../ui/root-isolate-token.ts';
import {PlatformDispatcher,HitTestResponse} from '../ui/platform-dispatcher.ts';
import type {HitTestRequest} from '../ui/platform-dispatcher.ts';
import type {Offset} from '../ui/offset.ts';
import type {PointerDataPacket} from '../ui/pointer.ts';
import {PointerEventConverter} from '../framework/gestures/converter.ts';
import type {PointerEvent} from '../framework/gestures/events.ts';
import type {ChannelBuffers} from '../ui/channel-buffers.ts';
import {SystemNavigator} from './system-navigator.ts';
import {MissingPluginException} from './message-codec.ts';
import {HardwareKeyboard} from './hardware-keyboard.ts';
import {RawKeyboard} from './raw-keyboard.ts';
import {KeyEventManager} from './key-event-manager.ts';
import type {KeyMessage} from './key-message.ts';
import type {KeyData} from '../ui/key-data.ts';
import {AutofillService} from './autofill.ts';
import {RestorationManager} from './restoration.ts';
import {PredictiveBackEvent} from './predictive-back-event.ts';

/** Embedding route for one live View; user KeyMessage handlers can replace it. */
export interface KeyboardViewDelegate {prepareKeyMessage():void;handleKeyMessage(message:KeyMessage):boolean;keyboardFocusLost():void}
export interface PointerViewDelegate {isLive():boolean;devicePixelRatio():number;handlePointerEvent(event:PointerEvent):void;hitTest(position:Offset):HitTestResponse}
interface PointerAdmission {readonly viewId:number|string;readonly delegate:PointerViewDelegate;readonly event:PointerEvent}

export type AppLifecycleState='resumed'|'inactive'|'hidden'|'paused'|'detached';
export type ServiceCapability='available'|'permission-required'|'unavailable';
/** Observed embedding features; unsupported bits are not claimed as OS evidence. */
export interface PlatformAccessibility {readonly features:number;readonly supportedFeatures:number;readonly semanticsEnabled:boolean|null;readonly source:'native'|'browser';readonly observation:'event'|'poll'|'resume'}
export interface PlatformEnvironment {
  readonly revision:number;readonly locales:readonly string[]|null;
  readonly localeSource:'native'|'runtime'|'unavailable';readonly brightness:'light'|'dark'|null;
  readonly localeObservation?:'event'|'poll'|'resume'|'unavailable';
  readonly lifecycle:AppLifecycleState|null;readonly textScale:number|null;
  readonly accessibility?:PlatformAccessibility;
  readonly capabilities:Readonly<{clipboardRead:ServiceCapability;clipboardWrite:ServiceCapability;navigation:ServiceCapability}>;
}
export interface ServicesObserver {
  handleStartBackGesture?(event:PredictiveBackEvent):boolean;
  handleUpdateBackGestureProgress?(event:PredictiveBackEvent):void;
  handleCommitBackGesture?():void;
  handleCancelBackGesture?():void;
  didChangeEnvironment?(environment:PlatformEnvironment):void;
  didChangeAppLifecycleState?(state:AppLifecycleState):void;
  didHaveMemoryPressure?():void;
  didReceiveServiceError?(error:PlatformException):void;
  didPopRoute?():boolean|PromiseLike<boolean>;
  didPushRoute?(route:string):boolean|PromiseLike<boolean>;
  didPushRouteInformation?(information:{readonly uri:string;readonly state:unknown}):boolean|PromiseLike<boolean>;
}
const owners=new WeakMap<BinaryMessenger,ServicesBinding>();
function lifecycle(value:unknown):AppLifecycleState|null {
  if(value===null)return null;
  if(value==='resumed'||value==='inactive'||value==='hidden'||value==='paused'||value==='detached')return value;
  throw new TypeError('Invalid application lifecycle state');
}
function environment(value:unknown):PlatformEnvironment {
  if(!(value instanceof Map))throw new TypeError('Invalid platform environment');
  const revision=value.get('revision'),locales=value.get('locales'),localeSource=value.get('localeSource'),brightness=value.get('brightness'),textScale=value.get('textScale'),capabilities=value.get('capabilities');
  if(!Number.isSafeInteger(revision)||revision<0||!(locales===null||Array.isArray(locales)&&locales.length>0&&locales.length<=256&&locales.every(item=>typeof item==='string'&&item.length>0&&item.length<=128))||!['native','runtime','unavailable'].includes(localeSource)||!(brightness===null||brightness==='light'||brightness==='dark')||!(textScale===null||typeof textScale==='number'&&Number.isFinite(textScale)&&textScale>0)||!(capabilities instanceof Map))throw new TypeError('Invalid platform environment fields');
  const capability=(key:string):ServiceCapability=>{const item=capabilities.get(key);if(item!=='available'&&item!=='permission-required'&&item!=='unavailable')throw new TypeError('Invalid service capability: '+key);return item;};
  if((locales===null)!==(localeSource==='unavailable'))throw new TypeError('Locale availability/source mismatch');
  const observation=value.get('localeObservation');if(observation!==undefined&&!['event','poll','resume','unavailable'].includes(observation))throw new TypeError('Invalid locale observation capability');
  const accessibility=value.get('accessibility');let capturedAccessibility:PlatformAccessibility|undefined;
  if(accessibility!==undefined){if(!(accessibility instanceof Map))throw new TypeError('Invalid accessibility environment');const features=accessibility.get('features'),supportedFeatures=accessibility.get('supportedFeatures'),semanticsEnabled=accessibility.get('semanticsEnabled'),source=accessibility.get('source'),observation=accessibility.get('observation');if(!Number.isSafeInteger(features)||features<0||!Number.isSafeInteger(supportedFeatures)||supportedFeatures<0||(BigInt(features)&~BigInt(supportedFeatures))!==0n||!(semanticsEnabled===null||typeof semanticsEnabled==='boolean')||!['native','browser'].includes(source)||!['event','poll','resume'].includes(observation))throw new TypeError('Invalid accessibility environment fields');capturedAccessibility=Object.freeze({features,supportedFeatures,semanticsEnabled,source,observation});}
  return Object.freeze({revision,locales:locales===null?null:Object.freeze([...locales]),localeSource,...(observation!==undefined?{localeObservation:observation as NonNullable<PlatformEnvironment['localeObservation']>}:{}),...(capturedAccessibility?{accessibility:capturedAccessibility}:{}),brightness,lifecycle:lifecycle(value.get('lifecycle')),textScale,capabilities:Object.freeze({clipboardRead:capability('clipboardRead'),clipboardWrite:capability('clipboardWrite'),navigation:capability('navigation')})});
}
/** App-owned services; keyboard/editing/restoration bindings are added by their families. */
export class ServicesBinding implements Disposable {
  private autofill:AutofillService|null=null;
  get autofillService():AutofillService{this.checkOpen();return this.autofill??=new AutofillService(this.defaultBinaryMessenger);}
  private restoration:RestorationManager|null=null;
  get restorationManager():RestorationManager{this.checkOpen();return this.restoration??=new RestorationManager(this.defaultBinaryMessenger);}
  readonly keyboard=new HardwareKeyboard();
  readonly rawKeyboard=new RawKeyboard();
  readonly keyEventManager=new KeyEventManager(this.keyboard,this.rawKeyboard,{prepareMessage:()=>{if(this.activeKeyView)this.keyboardViews.get(this.activeKeyView)?.prepareKeyMessage();}});
  static get instance():ServicesBinding {const owner=owners.get(PlatformChannelBinding.binaryMessenger);if(!owner)throw new FlutterError('The default application has no initialized ServicesBinding');return owner;}
  static get rootIsolateToken():RootIsolateToken|null{return RootIsolateToken.instance;}
  get rootToken():RootIsolateToken|null{return PlatformDispatcher.forMessenger(this.defaultBinaryMessenger).rootIsolateToken;}
  get channelBuffers():ChannelBuffers{this.checkOpen();return PlatformDispatcher.forMessenger(this.defaultBinaryMessenger).channelBuffers;}
  readonly channels:SystemChannelSet;readonly ready:Promise<void>;
  private readonly platform:MethodChannel;private readonly changes:BasicMessageChannel<unknown>;
  private readonly errors:BasicMessageChannel<unknown>;
  private readonly observers=new Set<ServicesObserver>();private current:PlatformEnvironment|undefined;
  private state:AppLifecycleState|null=null;private live=true;private releaseClosing:(()=>void)|undefined;
  private readonly backOwners=new Map<object,boolean>();
  private readonly backGestureObservers=new Set<ServicesObserver>();
  private readonly keyboardViews=new Map<object,KeyboardViewDelegate>();private activeKeyView:object|undefined;
  private dispatcher:PlatformDispatcher|undefined;
  private pointerDispatcherConnected=false;private readonly pointerViews=new Map<number|string,PointerViewDelegate>();private readonly pointerAdmissions:PointerAdmission[]=[];private dispatchingPointers=false;
  private readonly handlePointerData=(packet:PointerDataPacket):void=>{
    if(!this.live)return;const delegates=new Map(this.pointerViews),views=new Map<number|string,{readonly delegate:PointerViewDelegate;readonly ratio:number|null}>();for(const viewId of new Set(packet.data.map(datum=>datum.viewId))){const delegate=delegates.get(viewId);if(delegate)views.set(viewId,{delegate,ratio:delegate.isLive()?delegate.devicePixelRatio():null});}const admitted:PointerAdmission[]=[];
    for(const datum of packet.data){const captured=views.get(datum.viewId);if(!captured||captured.ratio===null)continue;if(!Number.isFinite(captured.ratio)||captured.ratio<=0)throw new RangeError('View device pixel ratio must be positive');for(const event of PointerEventConverter.expand([datum],()=>captured.ratio))admitted.push({viewId:datum.viewId,delegate:captured.delegate,event});}
    if(!this.live)return;this.pointerAdmissions.push(...admitted);if(this.dispatchingPointers)return;this.dispatchingPointers=true;
    try{while(this.live&&this.pointerAdmissions.length){const item=this.pointerAdmissions.shift()!;if(this.pointerViews.get(item.viewId)!==item.delegate||!item.delegate.isLive())continue;try{item.delegate.handlePointerEvent(item.event);}catch(exception){FlutterError.reportError(new FlutterErrorDetails({exception,library:'gestures library'}));}}}finally{this.dispatchingPointers=false;}
  };
  private readonly handleHitTest=(request:HitTestRequest):HitTestResponse=>{if(!this.live)return HitTestResponse.empty;const delegate=this.pointerViews.get(request.view.viewId);return delegate?.isLive()?delegate.hitTest(request.offset):HitTestResponse.empty;};
  registerPointerView(viewId:number|string,delegate:PointerViewDelegate):Disposable{
    this.checkOpen();if(this.pointerViews.has(viewId))throw new FlutterError('Pointer View is already registered');this.pointerViews.set(viewId,delegate);return {dispose:()=>{if(this.pointerViews.get(viewId)===delegate)this.pointerViews.delete(viewId);}};
  }
  private connectPointerDispatcher():void{if(this.pointerDispatcherConnected||!this.live)return;const dispatcher=PlatformDispatcher.maybeForMessenger(this.defaultBinaryMessenger);if(!dispatcher)return;this.dispatcher=dispatcher;this.pointerDispatcherConnected=true;if(dispatcher.onPointerDataPacket===null)dispatcher.onPointerDataPacket=this.handlePointerData;if(dispatcher.onHitTest===null)dispatcher.onHitTest=this.handleHitTest;}
  private readonly handleKeyData=(data:KeyData):boolean=>this.keyEventManager.handleKeyData(data);
  /** View registration never overwrites an explicitly patched public handler. */
  registerKeyboardView(owner:object,delegate:KeyboardViewDelegate):Disposable{
    this.checkOpen();if(this.keyboardViews.has(owner))throw new FlutterError('Keyboard View is already registered');this.keyboardViews.set(owner,delegate);
    return {dispose:()=>{if(!this.keyboardViews.delete(owner))return;if(this.activeKeyView===owner){this.activeKeyView=undefined;delegate.keyboardFocusLost();}}};
  }
  activateKeyboardView(owner:object):void{
    this.checkOpen();if(!this.keyboardViews.has(owner))throw new FlutterError('Keyboard View is not registered');
    if(this.keyboard.isDispatching)throw new FlutterError('Cannot transfer keyboard ownership during a message');
    if(this.activeKeyView===owner)return;const previous=this.activeKeyView;this.activeKeyView=undefined;
    if(previous)this.keyboardViews.get(previous)?.keyboardFocusLost();if(this.live&&this.keyboardViews.has(owner))this.activeKeyView=owner;
  }
  releaseKeyboardView(owner:object):void{if(this.activeKeyView===owner)this.activeKeyView=undefined;}
  get isClosed():boolean{return !this.live;}
  get environment():PlatformEnvironment|undefined{return this.current;}
  get lifecycleState():AppLifecycleState|null{return this.state;}
  constructor(readonly defaultBinaryMessenger:BinaryMessenger) {
    if(owners.has(defaultBinaryMessenger))throw new FlutterError('ServicesBinding already owns this messenger');
    this.channels=new SystemChannelSet(defaultBinaryMessenger);
    this.platform=new MethodChannel('flutter/platform',new JSONMethodCodec(),defaultBinaryMessenger);
    this.changes=new BasicMessageChannel('nelyx/environment-changed',new JSONMessageCodec(),defaultBinaryMessenger);
    this.errors=new BasicMessageChannel('nelyx/environment-errors',new JSONMessageCodec(),defaultBinaryMessenger);
    owners.set(defaultBinaryMessenger,this);
    try {
      this.connectPointerDispatcher();
      this.keyEventManager.keyMessageHandler=message=>this.activeKeyView?this.keyboardViews.get(this.activeKeyView)?.handleKeyMessage(message)===true:false;
      this.changes.setMessageHandler(value=>{this.accept(environment(value));return null;});
      this.errors.setMessageHandler(value=>{if(!(value instanceof Map)||typeof value.get('code')!=='string'||!(value.get('message')===null||typeof value.get('message')==='string'))throw new TypeError('Invalid service error');const error=new PlatformException({code:value.get('code'),message:value.get('message'),details:value.get('details')});this.notify(observer=>observer.didReceiveServiceError?.(error));return null;});
      this.channels.lifecycle.setMessageHandler(value=>{if(value!==null){if(!value.startsWith('AppLifecycleState.'))throw new TypeError('Invalid lifecycle message');this.acceptLifecycle(lifecycle(value.slice(18)));}return null;});
      this.channels.system.setMessageHandler(async value=>{await this.handleSystemMessage(value);return null;});
      this.channels.navigation.setMethodCallHandler(async call=>{
        const method=call.method,args=call.arguments;
        if(!['popRoute','pushRoute','pushRouteInformation'].includes(method))throw new MissingPluginException();
        if(method==='pushRoute'&&typeof args!=='string')throw new TypeError('pushRoute requires a route string');
        if(method==='pushRouteInformation'&&(!(args instanceof Map)||typeof args.get('uri')!=='string'))throw new TypeError('pushRouteInformation requires a URI map');
        for(const observer of [...this.observers].reverse()){if(!this.live)return false;if(!this.observers.has(observer))continue;const handled=method==='popRoute'?await observer.didPopRoute?.():method==='pushRoute'?await observer.didPushRoute?.(args as string):await observer.didPushRouteInformation?.({uri:(args as Map<string,unknown>).get('uri') as string,state:(args as Map<string,unknown>).get('state')??null});if(handled)return true;}return false;
      });
      this.channels.backGesture.setMethodCallHandler(call=>this.handleBackGesture(call.method,call.arguments));
      this.releaseClosing=defaultBinaryMessenger.onClosing?.(()=>this.dispose());
      this.ready=Promise.all([this.refreshEnvironment(),this.keyboard.syncKeyboardState(defaultBinaryMessenger).then(()=>{
        if(!this.live)return;this.connectPointerDispatcher();this.dispatcher=PlatformDispatcher.maybeForMessenger(defaultBinaryMessenger);
        if(this.dispatcher&&this.dispatcher.onKeyData===null)this.dispatcher.onKeyData=this.handleKeyData;
        this.channels.keyEvent.setMessageHandler(value=>this.keyEventManager.handleRawKeyMessage(value as import('./raw-key-event.ts').RawKeyMessage));
      })]).then(()=>{});
    }catch(error){this.dispose();throw error;}
  }
  addObserver(observer:ServicesObserver):Disposable {if(!this.live)throw new FlutterError('ServicesBinding is closed');this.observers.add(observer);return {dispose:()=>{this.observers.delete(observer);this.backGestureObservers.delete(observer);}};}
  /** Existing app service owner supplies the source WidgetsBinding gesture dispatch contact. */
  async handleBackGesture(method:string,argumentsValue:unknown=null):Promise<boolean|null>{
    this.checkOpen();
    if(method==='startBackGesture'){
      this.backGestureObservers.clear();
      if(!(argumentsValue instanceof Map))throw new TypeError('Back start requires an event map');const event=PredictiveBackEvent.fromMap(argumentsValue);
      this.notify(observer=>{if(observer.handleStartBackGesture?.(event)&&this.live&&this.observers.has(observer))this.backGestureObservers.add(observer);});
      return this.backGestureObservers.size>0;
    }
    if(method==='updateBackGestureProgress'){
      if(this.backGestureObservers.size===0)return null;if(!(argumentsValue instanceof Map))throw new TypeError('Back update requires an event map');const event=PredictiveBackEvent.fromMap(argumentsValue);this.notifyBackGesture(observer=>observer.handleUpdateBackGestureProgress?.(event));return null;
    }
    if(method==='commitBackGesture'){
      if(this.backGestureObservers.size===0){for(const observer of [...this.observers].reverse()){if(!this.live)return null;if(this.observers.has(observer)&&await observer.didPopRoute?.())return null;}if(this.live)await this.popSystemNavigator();}
      else this.notifyBackGesture(observer=>observer.handleCommitBackGesture?.());return null;
    }
    if(method==='cancelBackGesture'){this.notifyBackGesture(observer=>observer.handleCancelBackGesture?.());return null;}
    throw new MissingPluginException();
  }
  private notifyBackGesture(action:(observer:ServicesObserver)=>void):void{
    for(const observer of [...this.backGestureObservers]){if(!this.live)break;if(!this.observers.has(observer)||!this.backGestureObservers.has(observer))continue;try{action(observer);}catch(exception){FlutterError.reportError(new FlutterErrorDetails({exception,library:'services back gesture dispatch'}));}}
  }
  /** Source override point, routed through this application's system channel. */
  async handleSystemMessage(systemMessage:unknown):Promise<void>{
    if(!(systemMessage instanceof Map)||typeof systemMessage.get('type')!=='string')throw new TypeError('System messages require a string type');
    if(this.live&&systemMessage.get('type')==='memoryPressure')this.handleMemoryPressure();
  }
  handleMemoryPressure():void{this.notify(observer=>observer.didHaveMemoryPressure?.());}
  private notify(action:(observer:ServicesObserver)=>void,isCurrent:()=>boolean=()=>true):void {
    for(const observer of [...this.observers]){if(!this.live||!isCurrent())break;if(!this.observers.has(observer))continue;try{action(observer);}catch(exception){FlutterError.reportError(new FlutterErrorDetails({exception,library:'services library'}));}}
  }
  private accept(value:PlatformEnvironment):void {
    if(!this.live||this.current&&value.revision<=this.current.revision)return;this.current=value;
    const isCurrent=()=>this.current===value,dispatcher=PlatformDispatcher.maybeForMessenger(this.defaultBinaryMessenger);
    if(value.accessibility&&dispatcher){dispatcher.updateAccessibilityFeatures(value.accessibility.features);if(this.live&&isCurrent()&&value.accessibility.semanticsEnabled!==null)dispatcher.updateSemanticsEnabled(value.accessibility.semanticsEnabled);}
    if(!this.live||!isCurrent())return;this.acceptLifecycle(value.lifecycle);this.notify(observer=>observer.didChangeEnvironment?.(value),isCurrent);
  }
  private acceptLifecycle(value:AppLifecycleState|null):void {if(!this.live||this.state===value)return;this.state=value;if(value!==null)this.notify(observer=>observer.didChangeAppLifecycleState?.(value),()=>this.state===value);}
  async refreshEnvironment():Promise<void> {if(!this.live)throw new FlutterError('ServicesBinding is closed');const channel=new MethodChannel('nelyx/environment',new JSONMethodCodec(),this.defaultBinaryMessenger);this.accept(environment(await channel.invokeMethod('snapshot')));}
  /** Strict service path: unknown/unsupported plugins cannot silently copy. */
  private checkOpen():void{if(!this.live)throw new FlutterError('ServicesBinding is closed');}
  async writeText(text:string):Promise<void> {this.checkOpen();if(typeof text!=='string')throw new TypeError('Clipboard text must be a string');await this.platform.invokeMethod('Clipboard.setData',new Map([['text',text]]));}
  async readText():Promise<string> {this.checkOpen();const result=await this.platform.invokeMethod('Clipboard.getData',Clipboard.kTextPlain);if(result===null)return '';if(!(result instanceof Map)||typeof result.get('text')!=='string')throw new TypeError('Invalid clipboard text response');return result.get('text');}
  async hasStrings():Promise<boolean> {this.checkOpen();const result=await this.platform.invokeMethod('Clipboard.hasStrings',Clipboard.kTextPlain);if(result===null)return false;if(!(result instanceof Map)||typeof result.get('value')!=='boolean')throw new TypeError('Invalid clipboard availability response');return result.get('value');}
  async popSystemNavigator(animated:boolean|null=null):Promise<void>{this.checkOpen();await this.platform.invokeMethod('SystemNavigator.pop',animated);}
  async setFrameworkHandlesBack(enabled:boolean):Promise<void>{this.checkOpen();await SystemNavigator.setFrameworkHandlesBack(enabled,this.defaultBinaryMessenger);}
  async updateBackOwner(owner:object,handles:boolean|null):Promise<void>{this.checkOpen();if(handles===null)this.backOwners.delete(owner);else this.backOwners.set(owner,handles);await this.setFrameworkHandlesBack([...this.backOwners.values()].some(Boolean));}
  requireCapability(name:keyof PlatformEnvironment['capabilities']):ServiceCapability {this.checkOpen();const value=this.current?.capabilities[name];if(!value||value==='unavailable')throw new PlatformException({code:'unsupported',message:'Service is unavailable: '+name});return value;}
  dispose():void {
    if(!this.live)return;this.live=false;owners.delete(this.defaultBinaryMessenger);const releaseClosing=this.releaseClosing;this.releaseClosing=undefined;this.observers.clear();this.backGestureObservers.clear();this.backOwners.clear();this.keyboardViews.clear();this.activeKeyView=undefined;this.pointerViews.clear();this.pointerAdmissions.length=0;
    if(this.dispatcher?.onPointerDataPacket===this.handlePointerData)this.dispatcher.onPointerDataPacket=null;if(this.dispatcher?.onHitTest===this.handleHitTest)this.dispatcher.onHitTest=null;
    if(this.dispatcher?.onKeyData===this.handleKeyData)this.dispatcher.onKeyData=null;this.dispatcher=undefined;
    const errors:unknown[]=[];for(const unlisten of [()=>releaseClosing?.(),()=>this.restoration?.dispose(),()=>this.autofill?.dispose(),()=>this.keyEventManager.dispose(),()=>this.keyboard.dispose(),()=>this.rawKeyboard.dispose(),()=>this.channels.keyEvent.setMessageHandler(null),()=>this.changes.setMessageHandler(null),()=>this.errors.setMessageHandler(null),()=>this.channels.lifecycle.setMessageHandler(null),()=>this.channels.system.setMessageHandler(null),()=>this.channels.navigation.setMethodCallHandler(null),()=>this.channels.backGesture.setMethodCallHandler(null)])try{unlisten();}catch(error){errors.push(error);}this.restoration=null;this.autofill=null;
    if(errors.length)throw new AggregateError(errors,'ServicesBinding listener cleanup failed');
  }
}
