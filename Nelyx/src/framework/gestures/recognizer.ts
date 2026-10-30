// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter gestures/recognizer.dart with explicit live View binding and timer ports.
import {DiagnosticableTree} from '../../foundation/diagnosticable.ts';
import {DiagnosticsProperty,ErrorDescription,StringProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {EnumProperty} from '../../foundation/diagnostic-properties.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import {invariant,exceptionStack} from '../../foundation/errors.ts';
import {objectRuntimeType} from '../../foundation/object.ts';
import {debugPrint} from '../../foundation/print.ts';
import type {Disposable} from '../../foundation/disposable.ts';
import {Offset} from '../../ui/offset.ts';
import {PointerDeviceKind} from '../../ui/pointer.ts';
import type {TransformMatrix} from '../../ui/geometry.ts';
import {GestureDisposition} from './arena.ts';
import type {GestureArenaMember,GestureArenaEntry} from './arena.ts';
import type {GestureBinding} from './binding.ts';
import {GestureDebug} from './debug.ts';
import type {GestureArenaTeam} from './team.ts';
import type {DeviceGestureSettings} from './gesture-settings.ts';
import {kTouchSlop} from './constants.ts';
import {PointerEvent,PointerDownEvent,PointerPanZoomStartEvent,PointerMoveEvent,PointerUpEvent,PointerCancelEvent,PointerPanZoomEndEvent} from './events.ts';
export type RecognizerCallback<T>=()=>T;
export type AllowedButtonsFilter=(buttons:number)=>boolean;
export class DragStartBehavior {
  static readonly down=new DragStartBehavior(0,'down');static readonly start=new DragStartBehavior(1,'start');static readonly values=Object.freeze([DragStartBehavior.down,DragStartBehavior.start]);
  private constructor(readonly index:number,readonly name:string){Object.freeze(this);}toString():string{return 'DragStartBehavior.'+this.name;}
}
export class MultitouchDragStrategy {
  static readonly latestPointer=new MultitouchDragStrategy(0,'latestPointer');static readonly averageBoundaryPointers=new MultitouchDragStrategy(1,'averageBoundaryPointers');static readonly sumAllPointers=new MultitouchDragStrategy(2,'sumAllPointers');static readonly values=Object.freeze([MultitouchDragStrategy.latestPointer,MultitouchDragStrategy.averageBoundaryPointers,MultitouchDragStrategy.sumAllPointers]);
  private constructor(readonly index:number,readonly name:string){Object.freeze(this);}toString():string{return 'MultitouchDragStrategy.'+this.name;}
}
export class GestureRecognizerState {
  static readonly ready=new GestureRecognizerState(0,'ready');static readonly possible=new GestureRecognizerState(1,'possible');static readonly defunct=new GestureRecognizerState(2,'defunct');static readonly values=Object.freeze([GestureRecognizerState.ready,GestureRecognizerState.possible,GestureRecognizerState.defunct]);
  private constructor(readonly index:number,readonly name:string){Object.freeze(this);}toString():string{return 'GestureRecognizerState.'+this.name;}
}
export interface GestureRecognizerTimerPort {after(milliseconds:number,callback:()=>void):Disposable}
interface GestureTimerHost {setTimeout?:(callback:()=>void,delay:number)=>unknown;clearTimeout?:(handle:unknown)=>void}
const defaultTimers:GestureRecognizerTimerPort={after(delay,callback){const host=globalThis as unknown as GestureTimerHost;invariant(host.setTimeout&&host.clearTimeout,'missing-gesture-deadline-timer','This host must inject actual one-shot gesture timers');let active=true;const handle=host.setTimeout(()=>{if(!active)return;active=false;callback();},delay);return {dispose(){if(!active)return;active=false;host.clearTimeout!(handle);}};}};
export interface GestureRecognizerOptions {
  readonly binding:GestureBinding;readonly debugOwner?:unknown;readonly supportedDevices?:Set<PointerDeviceKind>|null|undefined;readonly allowedButtonsFilter?:AllowedButtonsFilter|undefined;readonly timers?:GestureRecognizerTimerPort|undefined;
}
class RecognizerEventData {constructor(readonly kind:PointerDeviceKind,readonly buttons:number){Object.freeze(this);}}
export abstract class GestureRecognizer extends DiagnosticableTree implements GestureArenaMember {
  readonly debugOwner:unknown;gestureSettings:DeviceGestureSettings|null=null;supportedDevices:Set<PointerDeviceKind>|null;readonly allowedButtonsFilter:AllowedButtonsFilter;
  protected readonly binding:GestureBinding;protected readonly timers:GestureRecognizerTimerPort;
  private readonly pointerToEventData=new Map<number,RecognizerEventData>();private disposed=false;private retiring=false;private inputTimestamp:number|null=null;
  constructor(options:GestureRecognizerOptions){super();invariant(!options.binding.isClosed,'closed-recognizer-binding','Recognizer requires a live View binding');this.binding=options.binding;this.debugOwner=options.debugOwner??null;this.supportedDevices=options.supportedDevices??null;this.allowedButtonsFilter=options.allowedButtonsFilter??GestureRecognizer.defaultButtonAcceptBehavior;this.timers=options.timers??defaultTimers;}
  private static defaultButtonAcceptBehavior(_buttons:number):boolean{return true;}
  get isDisposed():boolean{return this.disposed||this.retiring;}
  /** Factory ownership validation without exposing a process-wide binding. */
  belongsToBinding(binding:GestureBinding):boolean{return this.binding===binding;}
  protected checkOpen():void{invariant(!this.isDisposed&&!this.binding.isClosed,'closed-gesture-recognizer','Gesture recognizer or its View is closed');}
  protected recordInput(event:PointerEvent):void{this.inputTimestamp=event.timeStamp;}
  addPointerPanZoom(event:PointerPanZoomStartEvent):void{this.checkOpen();this.recordInput(event);this.pointerToEventData.set(event.pointer,new RecognizerEventData(event.kind,event.buttons));if(this.isPointerPanZoomAllowed(event))this.addAllowedPointerPanZoom(event);else this.handleNonAllowedPointerPanZoom(event);}
  addPointer(event:PointerDownEvent):void{this.checkOpen();this.recordInput(event);this.pointerToEventData.set(event.pointer,new RecognizerEventData(event.kind,event.buttons));if(this.isPointerAllowed(event))this.addAllowedPointer(event);else this.handleNonAllowedPointer(event);}
  /** These are deliberately empty source extension hooks, not concrete recognizers. */
  protected addAllowedPointerPanZoom(_event:PointerPanZoomStartEvent):void{}
  protected addAllowedPointer(_event:PointerDownEvent):void{}
  protected handleNonAllowedPointer(_event:PointerDownEvent):void{}
  protected handleNonAllowedPointerPanZoom(_event:PointerPanZoomStartEvent):void{}
  protected isPointerAllowed(event:PointerDownEvent):boolean{return (this.supportedDevices===null||this.supportedDevices.has(event.kind))&&this.allowedButtonsFilter(event.buttons);}
  protected isPointerPanZoomAllowed(event:PointerPanZoomStartEvent):boolean{return this.supportedDevices===null||this.supportedDevices.has(event.kind);}
  protected getKindForPointer(pointer:number):PointerDeviceKind{const data=this.pointerToEventData.get(pointer);invariant(data,'unknown-recognizer-pointer','No recorded device kind for this pointer');return data.kind;}
  protected getButtonsForPointer(pointer:number):number{const data=this.pointerToEventData.get(pointer);invariant(data,'unknown-recognizer-pointer','No recorded button mask for this pointer');return data.buttons;}
  abstract acceptGesture(pointer:number):void;
  abstract rejectGesture(pointer:number):void;
  abstract get debugDescription():string;
  protected invokeCallback<T>(name:string,callback:RecognizerCallback<T>,{debugReport,inputTimestamp=this.inputTimestamp}:{readonly debugReport?:()=>string;readonly inputTimestamp?:number|null}={}):T|null {
    if(this.disposed)return null;let result:T|null=null;
    try{if(FoundationBuildMode.debug&&GestureDebug.debugPrintRecognizerCallbacksTrace){const report=debugReport?.()??null,prefix=GestureDebug.debugPrintGestureArenaDiagnostics?' '.repeat(19)+'❙ ':'';debugPrint(prefix+this+' calling '+name+' callback.'+(report?.length?' '+report:''));}if(!this.disposed)result=this.binding.invokeCallback(inputTimestamp,callback);}
    catch(exception){FlutterError.reportError(new FlutterErrorDetails({exception,stack:exceptionStack(exception),library:'gesture',context:new ErrorDescription('while handling a gesture'),...(FoundationBuildMode.debug?{informationCollector:()=>[new StringProperty('Handler',name),new DiagnosticsProperty('Recognizer',this,{style:'errorProperty'})]}:{})}));}
    return result;
  }
  protected beginDispose():boolean{if(this.isDisposed)return false;this.retiring=true;return true;}
  protected finishDispose():void{this.pointerToEventData.clear();this.disposed=true;this.retiring=false;}
  dispose():void{if(this.beginDispose())this.finishDispose();}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('debugOwner',this.debugOwner,{defaultValue:null}));}
}
export abstract class OneSequenceGestureRecognizer extends GestureRecognizer {
  private readonly entries=new Map<number,GestureArenaEntry>();private readonly trackedPointers=new Set<number>();private teamValue:GestureArenaTeam|null=null;private disposalEntries:Set<GestureArenaEntry>|null=null;
  private readonly route=(event:PointerEvent)=>{if(this.isDisposed||this.binding.isClosed&&!(event instanceof PointerCancelEvent))return;this.recordInput(event);this.handleEvent(event);};
  protected override addAllowedPointer(event:PointerDownEvent):void{this.startTrackingPointer(event.pointer,event.transform);}
  protected override handleNonAllowedPointer(_event:PointerDownEvent):void{this.resolve(GestureDisposition.rejected);}
  protected abstract handleEvent(event:PointerEvent):void;
  /** Source default arena hooks intentionally do nothing. */
  override acceptGesture(_pointer:number):void{}
  override rejectGesture(_pointer:number):void{}
  protected abstract didStopTrackingLastPointer(pointer:number):void;
  protected resolve(disposition:GestureDisposition):void{const entries=[...this.entries.values()];this.entries.clear();for(const entry of entries){this.disposalEntries?.delete(entry);entry.resolve(disposition);}}
  protected resolvePointer(pointer:number,disposition:GestureDisposition):void{const entry=this.entries.get(pointer);if(entry){this.entries.delete(pointer);this.disposalEntries?.delete(entry);entry.resolve(disposition);}}
  get team():GestureArenaTeam|null{return this.teamValue;}
  set team(value:GestureArenaTeam|null){this.checkOpen();invariant(value!==null&&this.entries.size===0&&this.trackedPointers.size===0&&this.teamValue===null,'invalid-recognizer-team','Assign a non-null team once before tracking any pointer');invariant(value.arena===this.binding.gestureArena,'foreign-recognizer-team','The team must use this View\'s actual arena');this.teamValue=value;}
  private addPointerToArena(pointer:number):GestureArenaEntry{return this.teamValue?.add(pointer,this)??this.binding.gestureArena.add(pointer,this);}
  protected startTrackingPointer(pointer:number,matrix:TransformMatrix|null=null):void{this.checkOpen();this.binding.pointerRouter.addRoute(pointer,this.route,matrix);this.trackedPointers.add(pointer);try{this.entries.set(pointer,this.addPointerToArena(pointer));}catch(error){this.trackedPointers.delete(pointer);this.binding.pointerRouter.removeRoute(pointer,this.route);throw error;}}
  protected stopTrackingPointer(pointer:number):void{if(this.trackedPointers.has(pointer)){this.binding.pointerRouter.removeRoute(pointer,this.route);this.trackedPointers.delete(pointer);if(this.trackedPointers.size===0)this.didStopTrackingLastPointer(pointer);}}
  protected stopTrackingIfPointerNoLongerDown(event:PointerEvent):void{if(event instanceof PointerUpEvent||event instanceof PointerCancelEvent||event instanceof PointerPanZoomEndEvent)this.stopTrackingPointer(event.pointer);}
  override dispose():void {
    if(!this.beginDispose())return;const errors:unknown[]=[];this.disposalEntries=new Set(this.entries.values());
    try{try{this.resolve(GestureDisposition.rejected);}catch(error){errors.push(error);}const snapshot=[...this.disposalEntries];for(const entry of snapshot){this.disposalEntries.delete(entry);try{entry.resolve(GestureDisposition.rejected);}catch(error){errors.push(error);}}this.entries.clear();const snapshot1=[...this.trackedPointers];for(const pointer of snapshot1)try{this.binding.pointerRouter.removeRoute(pointer,this.route);}catch(error){errors.push(error);}this.trackedPointers.clear();}
    finally{this.disposalEntries=null;this.finishDispose();}
    if(errors.length)throw new AggregateError(errors,'Gesture recognizer retirement failed');
  }
}
const unsetTouchSlop=-1;
export interface PrimaryPointerGestureRecognizerOptions extends GestureRecognizerOptions {readonly deadline?:number|null|undefined;readonly preAcceptSlopTolerance?:number|null|undefined;readonly postAcceptSlopTolerance?:number|null|undefined}
export abstract class PrimaryPointerGestureRecognizer extends OneSequenceGestureRecognizer {
  readonly deadline:number|null;private readonly preAccept:number|null;private readonly postAccept:number|null;
  private stateValue=GestureRecognizerState.ready;private primaryPointerValue:number|null=null;private initialPositionValue:OffsetPair|null=null;private gestureAccepted=false;private timer:Disposable|null=null;private timerGeneration=0;
  constructor(options:PrimaryPointerGestureRecognizerOptions){super(options);this.deadline=options.deadline??null;this.preAccept=options.preAcceptSlopTolerance===undefined?unsetTouchSlop:options.preAcceptSlopTolerance;this.postAccept=options.postAcceptSlopTolerance===undefined?unsetTouchSlop:options.postAcceptSlopTolerance;for(const value of [this.preAccept,this.postAccept])invariant(value===null||Number.isFinite(value)&&(value===unsetTouchSlop||value>=0),'invalid-gesture-slop','Slop must be unspecified, nonnegative or null');invariant(this.deadline===null||Number.isFinite(this.deadline)&&this.deadline>=0,'invalid-gesture-deadline','Deadline must be a nonnegative finite millisecond duration');}
  get preAcceptSlopTolerance():number|null{return this.preAccept===unsetTouchSlop?this.defaultTouchSlop:this.preAccept;}
  get postAcceptSlopTolerance():number|null{return this.postAccept===unsetTouchSlop?this.defaultTouchSlop:this.postAccept;}
  private get defaultTouchSlop():number{return this.gestureSettings?.touchSlop??kTouchSlop;}
  get state():GestureRecognizerState{return this.stateValue;}
  get primaryPointer():number|null{return this.primaryPointerValue;}
  get initialPosition():OffsetPair|null{return this.initialPositionValue;}
  protected override addAllowedPointer(event:PointerDownEvent):void{super.addAllowedPointer(event);if(this.state===GestureRecognizerState.ready){this.stateValue=GestureRecognizerState.possible;this.primaryPointerValue=event.pointer;this.initialPositionValue=OffsetPair.fromEventPosition(event);if(this.deadline!==null){const generation=++this.timerGeneration;const timer=this.timers.after(this.deadline,()=>{if(!this.isDisposed&&!this.binding.isClosed&&this.timerGeneration===generation&&this.state===GestureRecognizerState.possible&&this.primaryPointer===event.pointer)this.didExceedDeadlineWithEvent(event);});if(this.isDisposed||this.timerGeneration!==generation)timer.dispose();else this.timer=timer;}}}
  protected override handleNonAllowedPointer(event:PointerDownEvent):void{if(!this.gestureAccepted)super.handleNonAllowedPointer(event);}
  protected override handleEvent(event:PointerEvent):void {
    invariant(this.state!==GestureRecognizerState.ready,'ready-primary-pointer-dispatch','Primary recognizer is not tracking');
    try{if(this.state===GestureRecognizerState.possible&&event.pointer===this.primaryPointer){const before=!this.gestureAccepted&&this.preAcceptSlopTolerance!==null&&this.getGlobalDistance(event)>this.preAcceptSlopTolerance,after=this.gestureAccepted&&this.postAcceptSlopTolerance!==null&&this.getGlobalDistance(event)>this.postAcceptSlopTolerance;if(event instanceof PointerMoveEvent&&(before||after)){this.resolve(GestureDisposition.rejected);this.stopTrackingPointer(this.primaryPointer!);}else this.handlePrimaryPointer(event);}}
    finally{this.stopTrackingIfPointerNoLongerDown(event);}
  }
  protected abstract handlePrimaryPointer(event:PointerEvent):void;
  protected didExceedDeadline():void{invariant(this.deadline===null,'unimplemented-gesture-deadline','Override didExceedDeadline when specifying a deadline');}
  protected didExceedDeadlineWithEvent(_event:PointerDownEvent):void{this.didExceedDeadline();}
  override acceptGesture(pointer:number):void{if(pointer===this.primaryPointer){this.stopTimer();this.gestureAccepted=true;}}
  override rejectGesture(pointer:number):void{if(pointer===this.primaryPointer&&this.state===GestureRecognizerState.possible){this.stopTimer();this.stateValue=GestureRecognizerState.defunct;}}
  protected override didStopTrackingLastPointer(_pointer:number):void{invariant(this.state!==GestureRecognizerState.ready,'ready-primary-pointer-stop','No primary sequence is tracking');this.stopTimer();this.stateValue=GestureRecognizerState.ready;this.initialPositionValue=null;this.gestureAccepted=false;}
  override dispose():void{if(this.isDisposed)return;const errors:unknown[]=[];try{this.stopTimer();}catch(error){errors.push(error);}try{super.dispose();}catch(error){errors.push(error);}finally{this.initialPositionValue=null;this.stateValue=GestureRecognizerState.ready;this.gestureAccepted=false;}if(errors.length)throw new AggregateError(errors,'Primary pointer retirement failed');}
  private stopTimer():void{this.timerGeneration++;const timer=this.timer;this.timer=null;timer?.dispose();}
  private getGlobalDistance(event:PointerEvent):number{invariant(this.initialPosition,'missing-primary-position','No initial pointer position');return event.position.subtract(this.initialPosition.global).distance;}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new EnumProperty('state',this.state));}
}
export class OffsetPair {
  readonly local:Offset;readonly global:Offset;
  constructor({local,global}:{readonly local:Offset;readonly global:Offset}){invariant(local instanceof Offset&&global instanceof Offset,'invalid-offset-pair','OffsetPair requires Offset values');this.local=local;this.global=global;if(new.target===OffsetPair)Object.freeze(this);}
  static readonly zero=new OffsetPair({local:Offset.zero,global:Offset.zero});
  static fromEventPosition(event:PointerEvent):OffsetPair{return new OffsetPair({local:event.localPosition,global:event.position});}
  static fromEventDelta(event:PointerEvent):OffsetPair{return new OffsetPair({local:event.localDelta,global:event.delta});}
  add(other:OffsetPair):OffsetPair{return new OffsetPair({local:this.local.add(other.local),global:this.global.add(other.global)});}
  subtract(other:OffsetPair):OffsetPair{return new OffsetPair({local:this.local.subtract(other.local),global:this.global.subtract(other.global)});}
  toString():string{return objectRuntimeType(this,'OffsetPair')+'(local: '+this.local+', global: '+this.global+')';}
}
