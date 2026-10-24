// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {AnimationController} from '../animation/animation-controller.ts';
import type {TickerProvider} from '../animation/ticker.ts';
import type {Curve} from '../animation/curves.ts';
import type {Simulation} from '../physics/simulation.ts';
import type {ScrollMetrics} from './scroll-metrics.ts';
import type {BuildContext} from './framework.ts';
import {AxisDirection,axisDirectionIsReversed} from '../painting/basic-types.ts';
import {DragStartDetails,DragUpdateDetails,DragEndDetails} from '../gestures/drag-details.ts';
import type {Drag} from '../gestures/drag.ts';
import {PointerDeviceKind} from '../../ui/pointer.ts';
import {ScrollStartNotification,ScrollUpdateNotification,ScrollEndNotification,OverscrollNotification} from './scroll-notification.ts';
import {precisionErrorTolerance} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import {describeIdentity} from '../../foundation/diagnostics-identity.ts';
export abstract class ScrollActivityDelegate {
  abstract get axisDirection():AxisDirection;
  abstract setPixels(pixels:number):number;abstract applyUserOffset(delta:number):void;abstract goIdle():void;abstract goBallistic(velocity:number):void;
}
export abstract class ScrollActivity {
  protected isDisposed=false;
  constructor(private currentDelegate:ScrollActivityDelegate){}
  get delegate():ScrollActivityDelegate{return this.currentDelegate;}
  updateDelegate(value:ScrollActivityDelegate):void{invariant(!this.isDisposed&&value!==this.delegate,'invalid-scroll-activity-transfer','Activity transfer requires a live distinct delegate');this.currentDelegate=value;}
  resetActivity():void{}
  dispatchScrollStartNotification(metrics:ScrollMetrics,context:BuildContext|null):void{new ScrollStartNotification({metrics,context}).dispatch(context);}
  dispatchScrollUpdateNotification(metrics:ScrollMetrics,context:BuildContext,scrollDelta:number):void{new ScrollUpdateNotification({metrics,context,scrollDelta}).dispatch(context);}
  dispatchOverscrollNotification(metrics:ScrollMetrics,context:BuildContext,overscroll:number):void{new OverscrollNotification({metrics,context,overscroll}).dispatch(context);}
  dispatchScrollEndNotification(metrics:ScrollMetrics,context:BuildContext):void{new ScrollEndNotification({metrics,context}).dispatch(context);}
  applyNewDimensions():void{}
  abstract get shouldIgnorePointer():boolean;abstract get isScrolling():boolean;abstract get velocity():number;
  dispose():void{this.isDisposed=true;}
  toString():string{return describeIdentity(this);}
}
export class IdleScrollActivity extends ScrollActivity {
  override applyNewDimensions():void{this.delegate.goBallistic(0);}
  get shouldIgnorePointer():boolean{return false;}get isScrolling():boolean{return false;}get velocity():number{return 0;}
}
export abstract class ScrollHoldController {abstract cancel():void;}
export class HoldScrollActivity extends ScrollActivity implements ScrollHoldController {
  readonly onHoldCanceled:(()=>void)|null;
  constructor({delegate,onHoldCanceled=null}:{readonly delegate:ScrollActivityDelegate;readonly onHoldCanceled?:(()=>void)|null}){super(delegate);this.onHoldCanceled=onHoldCanceled;}
  get shouldIgnorePointer():boolean{return false;}get isScrolling():boolean{return false;}get velocity():number{return 0;}
  cancel():void{if(!this.isDisposed)this.delegate.goBallistic(0);}
  override dispose():void{if(this.isDisposed)return;super.dispose();this.onHoldCanceled?.();}
}
export interface ScrollDragControllerOptions {readonly delegate:ScrollActivityDelegate;readonly details:DragStartDetails;readonly onDragCanceled?:(()=>void)|null;readonly carriedVelocity?:number|null;readonly motionStartDistanceThreshold?:number|null}
export class ScrollDragController implements Drag {
  static readonly momentumRetainStationaryDurationThreshold=20;static readonly momentumRetainVelocityThresholdFactor=0.5;static readonly motionStoppedDurationThreshold=50;private static readonly bigThresholdBreakDistance=24;
  readonly onDragCanceled:(()=>void)|null;readonly carriedVelocity:number|null;readonly motionStartDistanceThreshold:number|null;
  private currentDelegate:ScrollActivityDelegate;private lastTimestamp:number|null;private retainMomentum:boolean;private offsetSinceLastStop:number|null;private details:DragStartDetails|DragUpdateDetails|DragEndDetails|null;private disposed=false;
  /** Source private kind is exposed only to its owning DragScrollActivity in this library. */
  readonly _kind:PointerDeviceKind|null;
  constructor({delegate,details,onDragCanceled=null,carriedVelocity=null,motionStartDistanceThreshold=null}:ScrollDragControllerOptions){invariant(motionStartDistanceThreshold===null||motionStartDistanceThreshold>0,'invalid-scroll-drag-threshold','Motion threshold must be positive or null');this.currentDelegate=delegate;this.details=details;this.onDragCanceled=onDragCanceled;this.carriedVelocity=carriedVelocity;this.motionStartDistanceThreshold=motionStartDistanceThreshold;this.lastTimestamp=details.sourceTimeStamp;this.retainMomentum=carriedVelocity!==null&&carriedVelocity!==0;this._kind=details.kind;this.offsetSinceLastStop=motionStartDistanceThreshold===null?null:0;}
  get delegate():ScrollActivityDelegate{return this.currentDelegate;}get lastDetails():DragStartDetails|DragUpdateDetails|DragEndDetails|null{return this.details;}
  updateDelegate(value:ScrollActivityDelegate):void{invariant(!this.disposed&&value!==this.delegate,'invalid-scroll-drag-transfer','Drag transfer requires a live distinct delegate');this.currentDelegate=value;}
  private maybeLoseMomentum(offset:number,timestamp:number|null):void{if(this.retainMomentum&&offset===0&&(timestamp===null||this.lastTimestamp===null||timestamp-this.lastTimestamp>ScrollDragController.momentumRetainStationaryDurationThreshold))this.retainMomentum=false;}
  private adjustForThreshold(offset:number,timestamp:number|null):number{
    if(timestamp===null)return offset;
    if(offset===0){if(this.motionStartDistanceThreshold!==null&&this.offsetSinceLastStop===null&&this.lastTimestamp!==null&&timestamp-this.lastTimestamp>ScrollDragController.motionStoppedDurationThreshold)this.offsetSinceLastStop=0;return 0;}
    if(this.offsetSinceLastStop===null)return offset;this.offsetSinceLastStop+=offset;
    if(Math.abs(this.offsetSinceLastStop)>this.motionStartDistanceThreshold!){this.offsetSinceLastStop=null;return Math.abs(offset)>ScrollDragController.bigThresholdBreakDistance?offset:Math.min(this.motionStartDistanceThreshold!/3,Math.abs(offset))*Math.sign(offset);}return 0;
  }
  update(details:DragUpdateDetails):void{invariant(!this.disposed&&details.primaryDelta!==null,'invalid-scroll-drag-update','Live scrolling drags require a primary delta');this.details=details;let offset=details.primaryDelta;if(offset!==0)this.lastTimestamp=details.sourceTimeStamp;this.maybeLoseMomentum(offset,details.sourceTimeStamp);offset=this.adjustForThreshold(offset,details.sourceTimeStamp);if(offset===0)return;if(axisDirectionIsReversed(this.delegate.axisDirection))offset=-offset;this.delegate.applyUserOffset(offset);}
  end(details:DragEndDetails):void{invariant(!this.disposed&&details.primaryVelocity!==null,'invalid-scroll-drag-end','Live scrolling drags require a primary velocity');let velocity=-details.primaryVelocity;if(axisDirectionIsReversed(this.delegate.axisDirection))velocity=-velocity;this.details=details;if(this.retainMomentum&&Math.sign(velocity)===Math.sign(this.carriedVelocity!)&&Math.abs(velocity)>Math.abs(this.carriedVelocity!)*ScrollDragController.momentumRetainVelocityThresholdFactor)velocity+=this.carriedVelocity!;this.delegate.goBallistic(velocity);}
  cancel():void{if(!this.disposed)this.delegate.goBallistic(0);}
  dispose():void{if(this.disposed)return;this.disposed=true;this.details=null;this.onDragCanceled?.();}
  toString():string{return describeIdentity(this);}
}
export class DragScrollActivity extends ScrollActivity {
  constructor(delegate:ScrollActivityDelegate,private controller:ScrollDragController|null){super(delegate);}
  override dispatchScrollStartNotification(metrics:ScrollMetrics,context:BuildContext|null):void{const details=this.controller?.lastDetails;invariant(details instanceof DragStartDetails,'invalid-drag-start-notification','Drag activity must start with DragStartDetails');new ScrollStartNotification({metrics,context,dragDetails:details}).dispatch(context);}
  override dispatchScrollUpdateNotification(metrics:ScrollMetrics,context:BuildContext,scrollDelta:number):void{const details=this.controller?.lastDetails;invariant(details instanceof DragUpdateDetails,'invalid-drag-update-notification','Drag update requires DragUpdateDetails');new ScrollUpdateNotification({metrics,context,scrollDelta,dragDetails:details}).dispatch(context);}
  override dispatchOverscrollNotification(metrics:ScrollMetrics,context:BuildContext,overscroll:number):void{const details=this.controller?.lastDetails;invariant(details instanceof DragUpdateDetails,'invalid-drag-overscroll-notification','Drag overscroll requires DragUpdateDetails');new OverscrollNotification({metrics,context,overscroll,dragDetails:details}).dispatch(context);}
  override dispatchScrollEndNotification(metrics:ScrollMetrics,context:BuildContext):void{const details=this.controller?.lastDetails;new ScrollEndNotification({metrics,context,dragDetails:details instanceof DragEndDetails?details:null}).dispatch(context);}
  get shouldIgnorePointer():boolean{return this.controller?._kind!==PointerDeviceKind.trackpad;}get isScrolling():boolean{return true;}get velocity():number{return 0;}
  override dispose():void{this.controller=null;super.dispose();}
}
export class BallisticScrollActivity extends ScrollActivity {
  private readonly controller:AnimationController;
  constructor(delegate:ScrollActivityDelegate,simulation:Simulation,vsync:TickerProvider,readonly shouldIgnorePointer:boolean){super(delegate);this.controller=AnimationController.unbounded({vsync,debugLabel:'BallisticScrollActivity'});this.controller.addListener(()=>this.tick());void this.controller.animateWith(simulation).then(()=>{if(!this.isDisposed)this.delegate.goBallistic(0);});}
  override resetActivity():void{this.delegate.goBallistic(this.velocity);}override applyNewDimensions():void{this.delegate.goBallistic(this.velocity);}
  private tick():void{if(!this.applyMoveTo(this.controller.value))this.delegate.goIdle();}
  protected applyMoveTo(value:number):boolean{return Math.abs(this.delegate.setPixels(value))<precisionErrorTolerance;}
  override dispatchOverscrollNotification(metrics:ScrollMetrics,context:BuildContext,overscroll:number):void{new OverscrollNotification({metrics,context,overscroll,velocity:this.velocity}).dispatch(context);}
  get isScrolling():boolean{return true;}get velocity():number{return this.controller.velocity;}
  override dispose():void{if(this.isDisposed)return;super.dispose();this.controller.dispose();}
}
export interface DrivenScrollActivityOptions {readonly from:number;readonly to:number;readonly duration:number;readonly curve:Curve;readonly vsync:TickerProvider}
export class DrivenScrollActivity extends ScrollActivity {
  private controller:AnimationController;private readonly completion:Promise<void>;private finish!:()=>void;
  constructor(delegate:ScrollActivityDelegate,options:DrivenScrollActivityOptions);
  constructor(delegate:ScrollActivityDelegate,options:{readonly simulation:Simulation;readonly vsync:TickerProvider});
  constructor(delegate:ScrollActivityDelegate,options:DrivenScrollActivityOptions|{readonly simulation:Simulation;readonly vsync:TickerProvider}){
    super(delegate);this.completion=new Promise(resolve=>{this.finish=resolve;});this.controller=AnimationController.unbounded({vsync:options.vsync,value:'simulation'in options?0:options.from,debugLabel:'DrivenScrollActivity'});this.controller.addListener(()=>this.tick());
    const future='simulation'in options?this.controller.animateWith(options.simulation):this.controller.animateTo(options.to,{duration:options.duration,curve:options.curve});void future.then(()=>{if(!this.isDisposed)this.delegate.goBallistic(this.velocity);});
  }
  static simulation(delegate:ScrollActivityDelegate,simulation:Simulation,{vsync}:{readonly vsync:TickerProvider}):DrivenScrollActivity{return new DrivenScrollActivity(delegate,{simulation,vsync});}
  get done():Promise<void>{return this.completion;}
  private tick():void{if(!this.applyMoveTo(this.controller.value))this.delegate.goIdle();}
  protected applyMoveTo(value:number):boolean{return Math.abs(this.delegate.setPixels(value))<precisionErrorTolerance;}
  override dispatchOverscrollNotification(metrics:ScrollMetrics,context:BuildContext,overscroll:number):void{new OverscrollNotification({metrics,context,overscroll,velocity:this.velocity}).dispatch(context);}
  get shouldIgnorePointer():boolean{return true;}get isScrolling():boolean{return true;}get velocity():number{return this.controller.velocity;}
  override dispose():void{if(this.isDisposed)return;super.dispose();try{this.finish();}finally{this.controller.dispose();}}
}
