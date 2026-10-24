// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Action-listener dispatch from Flutter semantics/binding.dart, with explicit View ownership.
import {ObserverList} from '../../foundation/observer-list.ts';
import {invariant} from '../../foundation/errors.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {Listenable,ValueNotifier} from '../../foundation/notifier.ts';
import {SemanticsUpdateBuilder} from '../../ui/semantics.ts';
import {StandardMessageCodec} from '../../services/message-codecs.ts';
import {SemanticsActionEvent} from '../../ui/semantics-action.ts';
import type {SemanticsNode,Rect} from '../../ui/types.ts';
import {AccessibilityFeatures} from '../../ui/accessibility-features.ts';
import {PlatformDispatcher} from '../../ui/platform-dispatcher.ts';
import type {FrameScheduler} from '../scheduler/scheduler.ts';
import {SemanticsDebug} from './debug.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
export interface SemanticsBindingOptions {
  /** Hard opt-out for this View, including platform observation and explicit handles. */
  readonly accessibilityEnabled?:boolean;
  readonly dispatcher?:PlatformDispatcher;readonly scheduler?:FrameScheduler;readonly viewId?:number|string;
  readonly performSemanticsAction?:(event:SemanticsActionEvent)=>void;
}
interface PlatformSemanticsConnection {readonly bindings:Set<SemanticsBinding>;release?:()=>void;featuresChanged():void;enabledChanged():void;action(event:SemanticsActionEvent):void;syncTree():void;}
export type SemanticsActionListener=(event:SemanticsActionEvent)=>void;
/** Source callback handle. The owning binding validates its outstanding count. */
export class SemanticsHandle {
  protected constructor(private readonly onDispose:()=>void,instrument=true){if(instrument&&FoundationBuildMode.debug&&Listenable.debugInstrumentationEnabled)Listenable.debugMaybeDispatchCreated?.('SemanticsHandle',this);}
  /** @internal Library-private construction adapted to explicit application bindings. */
  static _create(onDispose:()=>void):SemanticsHandle{return new SemanticsHandle(onDispose);}
  dispose():void{if(FoundationBuildMode.debug&&Listenable.debugInstrumentationEnabled)Listenable.debugMaybeDispatchDisposed?.(this);this.onDispose();}
}
/** Per-View action dispatch, source semantics handles and update-builder factory.
 * Platform accessibility feature observation remains an embedding responsibility. */
export class SemanticsBinding {
  private static readonly connections=new WeakMap<PlatformDispatcher,PlatformSemanticsConnection>();
  private features=AccessibilityFeatures.fromBits(0);private platformHandle:SemanticsHandle|null=null;private platformConnection:PlatformSemanticsConnection|null=null;
  private featuresScheduled=false;
  private readonly featureListeners=new Set<()=>void>();private readonly frameworkSemanticsChanged=()=>this.platformConnection?.syncTree();
  private releasePlatformClosing:(()=>void)|undefined;
  private readonly listeners=new ObserverList<SemanticsActionListener>();
  private readonly enabled=new ValueNotifier(false);private outstandingHandles=0;
  private enabledNotificationDepth=0;
  private readonly enabledListeners:{listener:()=>void;callback:()=>void}[]=[];
  private live=true;
  private readonly viewRects=new Map<number|string,Map<number|string,Rect>>();
  constructor(private readonly options:SemanticsBindingOptions={}){
    const dispatcher=options.dispatcher;if(!this.accessibilityEnabled||!dispatcher)return;this.features=dispatcher.accessibilityFeatures;
    let connection=SemanticsBinding.connections.get(dispatcher);const firstConnection=connection===undefined;
    if(!connection){
      const bindings=new Set<SemanticsBinding>();let treeEnabled=false;
      connection={bindings,
        featuresChanged:()=>{for(const binding of [...bindings])if(binding.live&&bindings.has(binding))binding.scheduleAccessibilityFeaturesChanged();},
        enabledChanged:()=>{for(const binding of [...bindings])if(binding.live&&bindings.has(binding))binding.handlePlatformSemanticsEnabledChanged();},
        action:event=>{for(const binding of [...bindings])if(binding.live&&bindings.has(binding)&&binding.options.viewId===event.viewId)binding.handleSemanticsActionEvent(event,decoded=>binding.options.performSemanticsAction?.(decoded));},
        syncTree:()=>{const enabled=[...bindings].some(binding=>binding.semanticsEnabled);if(treeEnabled===enabled)return;dispatcher.setSemanticsTreeEnabled(enabled);treeEnabled=enabled;},
      };
      SemanticsBinding.connections.set(dispatcher,connection);
    }
    invariant(options.viewId===undefined||![...connection.bindings].some(binding=>binding.options.viewId===options.viewId),'duplicate-semantics-view','Semantics dispatcher View identity is already registered');
    this.platformConnection=connection;connection.bindings.add(this);
    try{if(firstConnection)connection.release=dispatcher.observeAccessibility(connection);this.handlePlatformSemanticsEnabledChanged();this.addSemanticsEnabledListener(this.frameworkSemanticsChanged);connection.syncTree();this.releasePlatformClosing=dispatcher.onClosing(()=>this.dispose());}
    catch(error){try{this.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Semantics binding initialization failed');}throw error;}
  }
  get accessibilityFeatures():AccessibilityFeatures{return this.features;}
  get accessibilityEnabled():boolean{return this.options.accessibilityEnabled!==false;}
  get disableAnimations():boolean{return this.accessibilityEnabled&&(FoundationBuildMode.debug&&SemanticsDebug.disableAnimations!==null?SemanticsDebug.disableAnimations:this.features.disableAnimations);}
  /** Host observer corresponding to WidgetsBinding's accessibility observer hook. */
  addAccessibilityFeaturesChangedListener(listener:()=>void):()=>void{invariant(this.live,'closed-semantics-binding','Cannot observe a closed View');this.featureListeners.add(listener);return ()=>this.featureListeners.delete(listener);}
  handleAccessibilityFeaturesChanged():void{
    if(!this.live||!this.accessibilityEnabled)return;const dispatcher=this.options.dispatcher;if(dispatcher)this.features=dispatcher.accessibilityFeatures;
    for(const listener of [...this.featureListeners])if(this.live&&this.featureListeners.has(listener))try{listener();}catch(exception){FlutterError.reportError(new FlutterErrorDetails({exception,library:'semantics library'}));}
  }
  private scheduleAccessibilityFeaturesChanged():void{
    const scheduler=this.options.scheduler;
    if(scheduler&&['persistent','build','layout','paint','semantics'].includes(scheduler.phase)){if(!scheduler.disposed&&!this.featuresScheduled){this.featuresScheduled=true;scheduler.addPostFrameCallback(()=>{this.featuresScheduled=false;if(this.live)this.handleAccessibilityFeaturesChanged();},{debugLabel:'SemanticsBinding.handleAccessibilityFeaturesChanged'});}}
    else this.handleAccessibilityFeaturesChanged();
  }
  private handlePlatformSemanticsEnabledChanged():void{if(this.options.dispatcher?.semanticsEnabled)this.platformHandle??=this.ensureSemantics();else{this.platformHandle?.dispose();this.platformHandle=null;}}
  /** Actual retained node rectangles supplied by this View's published tree. */
  updateViewSemantics(viewId:number|string,nodes:readonly SemanticsNode[],legacyViewId?:number|string):void{if(!this.live||!this.accessibilityEnabled)return;const rects=new Map<number|string,Rect>();const visit=(node:SemanticsNode)=>{const rect=Object.freeze({...node.bounds});rects.set(node.id,rect);if(node.sourceNodeId!==undefined)rects.set(node.sourceNodeId,rect);for(const child of node.children??[])visit(child);};for(const node of nodes)visit(node);this.viewRects.set(viewId,rects);if(legacyViewId!==undefined)this.viewRects.set(legacyViewId,rects);}
  getRectOfSemanticsNodeInViewCoordinates(viewId:number|string,nodeId:number|string):Rect|null{return this.viewRects.get(viewId)?.get(nodeId)??null;}
  get semanticsEnabled():boolean{if(!this.live)return false;if(FoundationBuildMode.debug)invariant(this.enabled.value===(this.outstandingHandles>0),'invalid-semantics-handle-count','Semantics enablement must match its handles');return this.enabled.value;}
  get debugOutstandingSemanticsHandles():number{return this.outstandingHandles;}
  addSemanticsEnabledListener(listener:()=>void):void{invariant(this.live,'closed-semantics-binding','Cannot observe a closed View');const callback=()=>{if(this.live)listener();};this.enabledListeners.push({listener,callback});this.enabled.addListener(callback);}
  removeSemanticsEnabledListener(listener:()=>void):void{const index=this.enabledListeners.findIndex(entry=>entry.listener===listener);if(index!==-1){this.enabled.removeListener(this.enabledListeners[index]!.callback);this.enabledListeners.splice(index,1);}}
  private setSemanticsEnabled(value:boolean):void{this.enabledNotificationDepth++;try{this.enabled.value=value;}finally{if(--this.enabledNotificationDepth===0&&!this.live)this.enabled.dispose();}}
  ensureSemantics():SemanticsHandle{invariant(this.live,'closed-semantics-binding','Cannot acquire semantics on a closed View');if(!this.accessibilityEnabled)return SemanticsHandle._create(()=>{});if(FoundationBuildMode.debug)invariant(this.outstandingHandles>=0,'invalid-semantics-handle-count','Semantics count must be nonnegative');this.outstandingHandles++;this.setSemanticsEnabled(true);return SemanticsHandle._create(()=>{if(FoundationBuildMode.debug)invariant(this.outstandingHandles>0,'invalid-semantics-handle-count','No semantics handle remains');this.outstandingHandles--;if(this.live)this.setSemanticsEnabled(this.outstandingHandles>0);});}
  createSemanticsUpdateBuilder():SemanticsUpdateBuilder{return new SemanticsUpdateBuilder();}
  addSemanticsActionListener(listener:SemanticsActionListener):void {invariant(this.live,'closed-semantics-binding','Semantics action binding is closed');this.listeners.add(listener);}
  removeSemanticsActionListener(listener:SemanticsActionListener):void {this.listeners.remove(listener);}
  /** The embedding supplies its validated, current-node action. Listeners run
   * first, with source snapshot/removal semantics; a throwing listener aborts. */
  handleSemanticsActionEvent(event:SemanticsActionEvent,perform:(event:SemanticsActionEvent)=>void):void {
    if(!this.live||!this.accessibilityEnabled)return;
    const value=event.arguments,bytes=value instanceof DataView?value:value instanceof Uint8Array?new DataView(value.buffer,value.byteOffset,value.byteLength):null;
    const decoded=bytes?event.copyWith({arguments:new StandardMessageCodec().decodeMessage(bytes)}):event;
    for(const listener of this.listeners.toList({growable:false}))if(this.live&&this.listeners.contains(listener))listener(decoded);
    if(this.live)perform(decoded);
  }
  dispose():void {
    if(!this.live)return;this.live=false;this.releasePlatformClosing?.();this.releasePlatformClosing=undefined;this.featureListeners.clear();this.listeners.clear();this.viewRects.clear();
    const errors:unknown[]=[];try{this.platformHandle?.dispose();}catch(error){errors.push(error);}this.platformHandle=null;
    const dispatcher=this.options.dispatcher,connection=this.platformConnection;this.platformConnection=null;
    if(dispatcher&&connection){connection.bindings.delete(this);try{connection.syncTree();}catch(error){errors.push(error);}if(!connection.bindings.size){connection.release?.();SemanticsBinding.connections.delete(dispatcher);}}
    for(const entry of this.enabledListeners)this.enabled.removeListener(entry.callback);this.enabledListeners.length=0;if(this.enabledNotificationDepth===0)this.enabled.dispose();if(errors.length)throw new AggregateError(errors,'Semantics binding cleanup failed');
  }
}
