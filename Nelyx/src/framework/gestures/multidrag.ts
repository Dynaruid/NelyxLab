// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter gestures/multidrag.dart with actual View ownership and cancellable timers.
import {invariant} from '../../foundation/errors.ts';
import type {Disposable} from '../../foundation/disposable.ts';
import {Offset} from '../../ui/offset.ts';
import {PointerDeviceKind} from '../../ui/pointer.ts';
import {GestureRecognizer} from './recognizer.ts';
import type {GestureRecognizerOptions,GestureRecognizerTimerPort} from './recognizer.ts';
import {GestureDisposition} from './arena.ts';
import type {GestureArenaEntry} from './arena.ts';
import type {SamplingClock} from './binding.ts';
import type {DeviceGestureSettings} from './gesture-settings.ts';
import {PointerDownEvent,PointerMoveEvent,PointerUpEvent,PointerCancelEvent,computeHitSlop,kPrimaryButton} from './events.ts';
import type {PointerEvent} from './events.ts';
import {DragUpdateDetails,DragEndDetails} from './drag-details.ts';
import {VelocityTracker} from './velocity-tracker.ts';
import type {Drag} from './drag.ts';
import {kLongPressTimeout} from './constants.ts';
export type GestureMultiDragStartCallback=(position:Offset)=>Drag|null;
function cleanup(operations:readonly (()=>void)[],message:string):void{const errors:unknown[]=[];for(const operation of operations)try{operation();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,message);}
export interface MultiDragPointerStateOptions {readonly clock?:SamplingClock}
export abstract class MultiDragPointerState {
  private readonly velocityTracker:VelocityTracker;private client:Drag|null=null;private pendingDeltaValue:Offset|null=Offset.zero;private lastPendingEventTimestamp:number|null=null;private arenaEntry:GestureArenaEntry|null=null;private live=true;
  constructor(readonly initialPosition:Offset,readonly kind:PointerDeviceKind,readonly gestureSettings:DeviceGestureSettings|null,options:MultiDragPointerStateOptions={}){this.velocityTracker=VelocityTracker.withKind(kind,options);}
  get pendingDelta():Offset|null{return this.pendingDeltaValue;}
  protected get isDisposed():boolean{return !this.live;}
  /** Library-private source collaboration, exposed only to the actual recognizer. */
  setArenaEntry(entry:GestureArenaEntry):void{invariant(this.live&&this.arenaEntry===null&&this.pendingDelta!==null&&this.client===null,'invalid-multidrag-entry','Pointer state cannot take another arena entry');this.arenaEntry=entry;}
  protected resolve(disposition:GestureDisposition):void{invariant(this.arenaEntry,'missing-multidrag-entry','Pointer state requires its actual arena entry');this.arenaEntry.resolve(disposition);}
  move(event:PointerMoveEvent):void{if(!this.live)return;invariant(this.arenaEntry,'missing-multidrag-entry','No arena entry');if(!event.synthesized)this.velocityTracker.addPosition(event.timeStamp,event.position);if(this.client!==null){invariant(this.pendingDelta===null,'started-multidrag-pending','An active drag cannot have pending delta');this.client.update(new DragUpdateDetails({sourceTimeStamp:event.timeStamp,delta:event.delta,globalPosition:event.position}));}else{invariant(this.pendingDelta!==null,'missing-multidrag-pending','Pending delta was cleared');this.pendingDeltaValue=this.pendingDelta.add(event.delta);this.lastPendingEventTimestamp=event.timeStamp;this.checkForResolutionAfterMove();}}
  /** Genuine source extension hook. */
  protected checkForResolutionAfterMove():void{}
  abstract accepted(starter:GestureMultiDragStartCallback):void;
  rejected():void{invariant(this.arenaEntry&&this.client===null&&this.pendingDelta!==null,'invalid-multidrag-rejection','Only a pending drag can be rejected');this.pendingDeltaValue=null;this.lastPendingEventTimestamp=null;this.arenaEntry=null;}
  startDrag(client:Drag):void{invariant(this.live&&this.arenaEntry&&this.client===null&&this.pendingDelta!==null,'invalid-multidrag-start','Cannot start this pointer drag');this.client=client;const details=new DragUpdateDetails({sourceTimeStamp:this.lastPendingEventTimestamp,delta:this.pendingDelta,globalPosition:this.initialPosition});this.pendingDeltaValue=null;this.lastPendingEventTimestamp=null;client.update(details);}
  up():void{if(!this.live)return;invariant(this.arenaEntry,'missing-multidrag-entry','No arena entry');const client=this.client;this.client=null;if(client!==null)client.end(new DragEndDetails({velocity:this.velocityTracker.getVelocity()}));else{this.pendingDeltaValue=null;this.lastPendingEventTimestamp=null;}}
  cancel():void{if(!this.live)return;invariant(this.arenaEntry,'missing-multidrag-entry','No arena entry');const client=this.client;this.client=null;if(client!==null)client.cancel();else{this.pendingDeltaValue=null;this.lastPendingEventTimestamp=null;}}
  dispose():void{if(!this.live)return;this.live=false;const entry=this.arenaEntry,client=this.client;this.arenaEntry=null;this.client=null;this.pendingDeltaValue=null;this.lastPendingEventTimestamp=null;cleanup([()=>entry?.resolve(GestureDisposition.rejected),()=>client?.cancel()],'Multi-drag pointer retirement failed');}
}
export abstract class MultiDragGestureRecognizer extends GestureRecognizer {
  onStart:GestureMultiDragStartCallback|null=null;private pointers:Map<number,MultiDragPointerState>|null=new Map();
  constructor(options:GestureRecognizerOptions){super({...options,allowedButtonsFilter:options.allowedButtonsFilter??(buttons=>buttons===kPrimaryButton)});}
  protected override addAllowedPointer(event:PointerDownEvent):void{const pointers=this.pointers;invariant(pointers&&!pointers.has(event.pointer),'duplicate-multidrag-pointer','Multi-drag requires a new Source contact');const state=this.createNewPointerState(event);if(this.isDisposed){state.dispose();return;}pointers.set(event.pointer,state);let routed=false;try{this.binding.pointerRouter.addRoute(event.pointer,this.handleEvent);routed=true;state.setArenaEntry(this.binding.gestureArena.add(event.pointer,this));}catch(error){pointers.delete(event.pointer);cleanup([()=>{if(routed)this.binding.pointerRouter.removeRoute(event.pointer,this.handleEvent);},()=>state.dispose(),()=>{throw error;}],'Multi-drag admission failed');}}
  protected abstract createNewPointerState(event:PointerDownEvent):MultiDragPointerState;
  private readonly handleEvent=(event:PointerEvent):void=>{if(this.isDisposed||this.binding.isClosed&&!(event instanceof PointerCancelEvent))return;const state=this.pointers?.get(event.pointer);invariant(state,'unknown-multidrag-pointer','No actual pointer state is registered');try{if(event instanceof PointerMoveEvent)state.move(event);else if(event instanceof PointerUpEvent)state.up();else if(event instanceof PointerCancelEvent)state.cancel();else invariant(event instanceof PointerDownEvent,'unsupported-multidrag-event','Unexpected routed event');}catch(error){try{this.removeState(event.pointer,state);}catch(retirement){throw new AggregateError([error,retirement],'Multi-drag dispatch failed');}throw error;}finally{if(event instanceof PointerUpEvent||event instanceof PointerCancelEvent)this.removeState(event.pointer,state);}};
  override acceptGesture(pointer:number):void{if(this.isDisposed)return;const state=this.pointers?.get(pointer);state?.accepted(position=>this.startDrag(position,pointer,state));}
  private startDrag(position:Offset,pointer:number,state:MultiDragPointerState):Drag|null{if(this.isDisposed||this.pointers?.get(pointer)!==state)return null;let drag:Drag|null=null;try{if(this.onStart!==null)drag=this.invokeCallback('onStart',()=>this.onStart!(position));if(this.isDisposed||this.pointers?.get(pointer)!==state){drag?.cancel();return null;}if(drag!==null)state.startDrag(drag);else this.removeState(pointer,state);return drag;}catch(error){try{this.removeState(pointer,state);}catch(retirement){throw new AggregateError([error,retirement],'Multi-drag start failed');}throw error;}}
  override rejectGesture(pointer:number):void{if(this.isDisposed)return;const state=this.pointers?.get(pointer);if(state)try{state.rejected();}finally{this.removeState(pointer,state);}}
  private removeState(pointer:number,state:MultiDragPointerState):void{if(this.pointers?.get(pointer)!==state)return;this.pointers.delete(pointer);cleanup([()=>this.binding.pointerRouter.removeRoute(pointer,this.handleEvent),()=>state.dispose()],'Multi-drag route retirement failed');}
  override dispose():void{if(!this.beginDispose())return;const pointers=this.pointers;this.pointers=null;try{cleanup([...(pointers??[]).entries()].flatMap(([pointer,state])=>[()=>this.binding.pointerRouter.removeRoute(pointer,this.handleEvent),()=>state.dispose()]),'Multi-drag recognizer retirement failed');}finally{pointers?.clear();this.finishDispose();}}
}
class ImmediatePointerState extends MultiDragPointerState {
  protected override checkForResolutionAfterMove():void{invariant(this.pendingDelta!==null,'missing-multidrag-pending','No pending delta');if(this.pendingDelta.distance>computeHitSlop(this.kind,this.gestureSettings))this.resolve(GestureDisposition.accepted);}
  accepted(starter:GestureMultiDragStartCallback):void{if(!this.isDisposed)starter(this.initialPosition);}
}
export class ImmediateMultiDragGestureRecognizer extends MultiDragGestureRecognizer {
  protected createNewPointerState(event:PointerDownEvent):MultiDragPointerState{return new ImmediatePointerState(event.position,event.kind,this.gestureSettings,{clock:this.binding.samplingClock});}
  override get debugDescription():string{return 'multidrag';}
}
class HorizontalPointerState extends MultiDragPointerState {
  protected override checkForResolutionAfterMove():void{invariant(this.pendingDelta!==null,'missing-multidrag-pending','No pending delta');if(Math.abs(this.pendingDelta.dx)>computeHitSlop(this.kind,this.gestureSettings))this.resolve(GestureDisposition.accepted);}
  accepted(starter:GestureMultiDragStartCallback):void{if(!this.isDisposed)starter(this.initialPosition);}
}
export class HorizontalMultiDragGestureRecognizer extends MultiDragGestureRecognizer {
  protected createNewPointerState(event:PointerDownEvent):MultiDragPointerState{return new HorizontalPointerState(event.position,event.kind,this.gestureSettings,{clock:this.binding.samplingClock});}
  override get debugDescription():string{return 'horizontal multidrag';}
}
class VerticalPointerState extends MultiDragPointerState {
  protected override checkForResolutionAfterMove():void{invariant(this.pendingDelta!==null,'missing-multidrag-pending','No pending delta');if(Math.abs(this.pendingDelta.dy)>computeHitSlop(this.kind,this.gestureSettings))this.resolve(GestureDisposition.accepted);}
  accepted(starter:GestureMultiDragStartCallback):void{if(!this.isDisposed)starter(this.initialPosition);}
}
export class VerticalMultiDragGestureRecognizer extends MultiDragGestureRecognizer {
  protected createNewPointerState(event:PointerDownEvent):MultiDragPointerState{return new VerticalPointerState(event.position,event.kind,this.gestureSettings,{clock:this.binding.samplingClock});}
  override get debugDescription():string{return 'vertical multidrag';}
}
class DelayedPointerState extends MultiDragPointerState {
  private timer:Disposable|null=null;private starter:GestureMultiDragStartCallback|null=null;
  constructor(position:Offset,delay:number,kind:PointerDeviceKind,settings:DeviceGestureSettings|null,options:MultiDragPointerStateOptions,timers:GestureRecognizerTimerPort){super(position,kind,settings,options);this.timer=timers.after(delay,()=>this.delayPassed());}
  private delayPassed():void{if(this.isDisposed)return;invariant(this.timer&&this.pendingDelta!==null&&this.pendingDelta.distance<=computeHitSlop(this.kind,this.gestureSettings),'invalid-delayed-drag-deadline','Delay can finish only for a live in-tolerance pointer');this.timer=null;const starter=this.starter;this.starter=null;if(starter!==null)starter(this.initialPosition);else this.resolve(GestureDisposition.accepted);}
  private ensureTimerStopped():void{const timer=this.timer;this.timer=null;timer?.dispose();}
  accepted(starter:GestureMultiDragStartCallback):void{if(this.isDisposed)return;invariant(this.starter===null,'duplicate-delayed-drag-starter','A starter is already registered');if(this.timer===null)starter(this.initialPosition);else this.starter=starter;}
  protected override checkForResolutionAfterMove():void{if(this.timer===null)return;invariant(this.pendingDelta!==null,'missing-multidrag-pending','No pending delta');if(this.pendingDelta.distance>computeHitSlop(this.kind,this.gestureSettings))try{this.resolve(GestureDisposition.rejected);}finally{this.ensureTimerStopped();}}
  override dispose():void{this.starter=null;cleanup([()=>this.ensureTimerStopped(),()=>super.dispose()],'Delayed multi-drag retirement failed');}
}
export interface DelayedMultiDragGestureRecognizerOptions extends GestureRecognizerOptions {readonly delay?:number}
export class DelayedMultiDragGestureRecognizer extends MultiDragGestureRecognizer {
  readonly delay:number;
  constructor(options:DelayedMultiDragGestureRecognizerOptions){super(options);this.delay=options.delay??kLongPressTimeout;invariant(Number.isFinite(this.delay)&&this.delay>=0,'invalid-multidrag-delay','Delay must be nonnegative finite milliseconds');}
  protected createNewPointerState(event:PointerDownEvent):MultiDragPointerState{return new DelayedPointerState(event.position,this.delay,event.kind,this.gestureSettings,{clock:this.binding.samplingClock},this.timers);}
  override get debugDescription():string{return 'long multidrag';}
}
