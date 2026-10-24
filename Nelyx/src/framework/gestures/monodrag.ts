// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter gestures/monodrag.dart with the actual View's arena, clock and frame epoch.
import {Offset} from '../../ui/offset.ts';
import {PointerDeviceKind} from '../../ui/pointer.ts';
import {inverse} from '../../ui/geometry.ts';
import type {TransformMatrix} from '../../ui/geometry.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import {EnumProperty} from '../../foundation/diagnostic-properties.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {OneSequenceGestureRecognizer,DragStartBehavior,MultitouchDragStrategy,OffsetPair} from './recognizer.ts';
import type {GestureRecognizerOptions} from './recognizer.ts';
import {GestureDisposition} from './arena.ts';
import {PointerEvent,PointerDownEvent,PointerMoveEvent,PointerUpEvent,PointerCancelEvent,PointerPanZoomStartEvent,PointerPanZoomUpdateEvent,PointerPanZoomEndEvent,kPrimaryButton,computeHitSlop,computePanSlop} from './events.ts';
import {DragDownDetails,DragStartDetails,DragUpdateDetails,DragEndDetails} from './drag-details.ts';
import type {GestureDragDownCallback,GestureDragStartCallback,GestureDragUpdateCallback,GestureDragEndCallback,GestureDragCancelCallback} from './drag-details.ts';
import {VelocityTracker,Velocity} from './velocity-tracker.ts';
import type {VelocityEstimate} from './velocity-tracker.ts';
import {kMinFlingVelocity,kMaxFlingVelocity} from './constants.ts';
export type GestureVelocityTrackerBuilder=(event:PointerEvent)=>VelocityTracker;
type DragState='ready'|'possible'|'accepted';type DragDirection='horizontal'|'vertical';
export interface DragGestureRecognizerOptions extends GestureRecognizerOptions {readonly dragStartBehavior?:DragStartBehavior;readonly multitouchDragStrategy?:MultitouchDragStrategy;readonly velocityTrackerBuilder?:GestureVelocityTrackerBuilder;readonly onlyAcceptDragOnThreshold?:boolean}
export abstract class DragGestureRecognizer extends OneSequenceGestureRecognizer {
  dragStartBehavior:DragStartBehavior;multitouchDragStrategy:MultitouchDragStrategy;velocityTrackerBuilder:GestureVelocityTrackerBuilder;onlyAcceptDragOnThreshold:boolean;
  onDown:GestureDragDownCallback|null=null;onStart:GestureDragStartCallback|null=null;onUpdate:GestureDragUpdateCallback|null=null;onEnd:GestureDragEndCallback|null=null;onCancel:GestureDragCancelCallback|null=null;
  minFlingDistance:number|null=null;minFlingVelocity:number|null=null;maxFlingVelocity:number|null=null;
  private state:DragState='ready';private initialPosition:OffsetPair|undefined;private pendingDragOffset:OffsetPair|undefined;private lastPositionValue:OffsetPair|undefined;private lastPendingEventTimestamp:number|null=null;private initialButtons:number|null=null;private lastTransform:TransformMatrix|null=null;private globalDistanceMovedValue:number|undefined;
  private hasDragThresholdBeenMet=false;private readonly velocityTrackers=new Map<number,VelocityTracker>();private readonly moveDeltaBeforeFrame=new Map<number,Offset>();private frameTimeStamp:number|null=null;private lastUpdatedDeltaForPan=Offset.zero;private readonly acceptedActivePointers:number[]=[];private activePointer:number|null=null;
  constructor(options:DragGestureRecognizerOptions){super({...options,allowedButtonsFilter:options.allowedButtonsFilter??(buttons=>buttons===kPrimaryButton)});this.dragStartBehavior=options.dragStartBehavior??DragStartBehavior.start;this.multitouchDragStrategy=options.multitouchDragStrategy??MultitouchDragStrategy.latestPointer;this.velocityTrackerBuilder=options.velocityTrackerBuilder??(event=>VelocityTracker.withKind(event.kind,{clock:this.binding.samplingClock}));this.onlyAcceptDragOnThreshold=options.onlyAcceptDragOnThreshold??false;}
  get lastPosition():OffsetPair{invariant(this.lastPositionValue,'uninitialized-drag-position','No drag position has been recorded');return this.lastPositionValue;}
  get globalDistanceMoved():number{invariant(this.globalDistanceMovedValue!==undefined,'uninitialized-drag-distance','No drag has started');return this.globalDistanceMovedValue;}
  get debugLastPendingEventTimestamp():number|null{return FoundationBuildMode.debug?this.lastPendingEventTimestamp:null;}
  abstract isFlingGesture(estimate:VelocityEstimate,kind:PointerDeviceKind):boolean;
  abstract considerFling(estimate:VelocityEstimate,kind:PointerDeviceKind):DragEndDetails|null;
  protected abstract getDeltaForDetails(delta:Offset):Offset;
  protected abstract getPrimaryValueFromOffset(value:Offset):number|null;
  protected getPrimaryDragAxis():DragDirection|null{return null;}
  abstract hasSufficientGlobalDistanceToAccept(kind:PointerDeviceKind,deviceTouchSlop:number|null):boolean;
  protected override isPointerAllowed(event:PointerEvent):boolean{if(this.initialButtons===null){if(this.onDown===null&&this.onStart===null&&this.onUpdate===null&&this.onEnd===null&&this.onCancel===null)return false;}else if(event.buttons!==this.initialButtons)return false;invariant(event instanceof PointerDownEvent,'invalid-drag-down-event','Drag admission requires PointerDownEvent after callback/button filtering');return super.isPointerAllowed(event);}
  private addDragPointer(event:PointerEvent):void{this.velocityTrackers.set(event.pointer,this.velocityTrackerBuilder(event));switch(this.state){case 'ready':this.state='possible';this.initialPosition=new OffsetPair({global:event.position,local:event.localPosition});this.lastPositionValue=this.initialPosition;this.pendingDragOffset=OffsetPair.zero;this.globalDistanceMovedValue=0;this.lastPendingEventTimestamp=event.timeStamp;this.lastTransform=event.transform;this.checkDown();break;case 'possible':break;case 'accepted':this.resolve(GestureDisposition.accepted);}}
  protected override addAllowedPointer(event:PointerDownEvent):void{super.addAllowedPointer(event);if(this.state==='ready')this.initialButtons=event.buttons;this.addDragPointer(event);}
  protected override addAllowedPointerPanZoom(event:PointerPanZoomStartEvent):void{super.addAllowedPointerPanZoom(event);this.startTrackingPointer(event.pointer,event.transform);if(this.state==='ready')this.initialButtons=kPrimaryButton;this.addDragPointer(event);}
  private shouldTrackMoveEvent(pointer:number):boolean{return this.multitouchDragStrategy!==MultitouchDragStrategy.latestPointer||this.activePointer===null||pointer===this.activePointer;}
  private recordMoveDeltaForMultitouch(pointer:number,localDelta:Offset):void{if(this.multitouchDragStrategy!==MultitouchDragStrategy.averageBoundaryPointers){if(FoundationBuildMode.debug)invariant(this.frameTimeStamp===null&&this.moveDeltaBeforeFrame.size===0,'stale-drag-frame-state','Unexpected boundary pointer state');return;}if(FoundationBuildMode.debug)invariant(this.frameTimeStamp===this.binding.currentSystemFrameTimeStamp,'changed-drag-frame','The frame epoch changed during pointer dispatch');if(this.state!=='accepted'||localDelta.equals(Offset.zero))return;this.moveDeltaBeforeFrame.set(pointer,(this.moveDeltaBeforeFrame.get(pointer)??Offset.zero).add(localDelta));}
  private getSumDelta(pointer:number,positive:boolean,axis:DragDirection):number{const offset=this.moveDeltaBeforeFrame.get(pointer);if(!offset)return 0;const value=axis==='vertical'?offset.dy:offset.dx;return positive?Math.max(value,0):Math.min(value,0);}
  private getMaxSumDeltaPointer(positive:boolean,axis:DragDirection):number|null{let ret:number|null=null,max:number|undefined;for(const pointer of this.moveDeltaBeforeFrame.keys()){const sum=this.getSumDelta(pointer,positive,axis);if(ret===null||(positive?sum>max!:sum<max!)){ret=pointer;max=sum;}}return ret;}
  private resolveLocalDeltaForMultitouch(pointer:number,localDelta:Offset):Offset {
    if(this.multitouchDragStrategy!==MultitouchDragStrategy.averageBoundaryPointers){if(this.frameTimeStamp!==null){this.moveDeltaBeforeFrame.clear();this.frameTimeStamp=null;this.lastUpdatedDeltaForPan=Offset.zero;}return localDelta;}
    const frame=this.binding.currentSystemFrameTimeStamp;if(this.frameTimeStamp!==frame){this.moveDeltaBeforeFrame.clear();this.lastUpdatedDeltaForPan=Offset.zero;this.frameTimeStamp=frame;}
    const axis=this.getPrimaryDragAxis();if(this.state!=='accepted'||localDelta.equals(Offset.zero)||this.moveDeltaBeforeFrame.size===0&&axis!==null)return localDelta;
    if(axis==='horizontal')return new Offset(this.resolveDelta(pointer,axis,localDelta),0);
    if(axis==='vertical')return new Offset(0,this.resolveDelta(pointer,axis,localDelta));
    const average=new Offset(this.resolveDeltaForPanGesture('horizontal',localDelta),this.resolveDeltaForPanGesture('vertical',localDelta)),updated=average.subtract(this.lastUpdatedDeltaForPan);this.lastUpdatedDeltaForPan=average;return updated;
  }
  private resolveDelta(pointer:number,axis:DragDirection,localDelta:Offset):number{const delta=axis==='horizontal'?localDelta.dx:localDelta.dy,positive=delta>0,maxPointer=this.getMaxSumDeltaPointer(positive,axis);invariant(maxPointer!==null,'missing-drag-boundary-pointer','No boundary pointer exists');if(maxPointer===pointer)return delta;const max=this.getSumDelta(maxPointer,positive,axis),current=this.getSumDelta(pointer,positive,axis);return (positive?current+delta>max:current+delta<max)?current+delta-max:0;}
  private resolveDeltaForPanGesture(axis:DragDirection,localDelta:Offset):number{const count=this.acceptedActivePointers.length;invariant(count>=1,'missing-accepted-pan-pointer','Pan aggregation requires an accepted pointer');let sum=axis==='horizontal'?localDelta.dx:localDelta.dy;for(const offset of this.moveDeltaBeforeFrame.values())sum+=axis==='horizontal'?offset.dx:offset.dy;return sum/count;}
  protected override handleEvent(event:PointerEvent):void {
    invariant(this.state!=='ready','ready-drag-dispatch','No drag is tracking');
    const terminal=event instanceof PointerUpEvent||event instanceof PointerCancelEvent||event instanceof PointerPanZoomEndEvent;
    try{
      if(!event.synthesized&&(event instanceof PointerDownEvent||event instanceof PointerMoveEvent||event instanceof PointerPanZoomStartEvent||event instanceof PointerPanZoomUpdateEvent)){const position=event instanceof PointerPanZoomStartEvent?Offset.zero:event instanceof PointerPanZoomUpdateEvent?event.pan:event.localPosition;this.velocityTrackers.get(event.pointer)!.addPosition(event.timeStamp,position);}
      if(event instanceof PointerMoveEvent&&event.buttons!==this.initialButtons){this.giveUpPointer(event.pointer);return;}
      if((event instanceof PointerMoveEvent||event instanceof PointerPanZoomUpdateEvent)&&this.shouldTrackMoveEvent(event.pointer)){
        const delta=event instanceof PointerMoveEvent?event.delta:event.panDelta,localDelta=event instanceof PointerMoveEvent?event.localDelta:event.localPanDelta,position=event instanceof PointerMoveEvent?event.position:event.position.add(event.pan),localPosition=event instanceof PointerMoveEvent?event.localPosition:event.localPosition.add(event.localPan);
        this.lastPositionValue=new OffsetPair({local:localPosition,global:position});const resolvedDelta=this.resolveLocalDeltaForMultitouch(event.pointer,localDelta);
        if(this.state==='possible'){
          this.pendingDragOffset=this.pendingDragOffset!.add(new OffsetPair({local:localDelta,global:delta}));this.lastPendingEventTimestamp=event.timeStamp;this.lastTransform=event.transform;
          const movedLocally=this.getDeltaForDetails(localDelta),localToGlobal=event.transform===null?null:inverse(event.transform);
          this.globalDistanceMovedValue=this.globalDistanceMoved+PointerEvent.transformDeltaViaPositions({transform:localToGlobal,untransformedDelta:movedLocally,untransformedEndPosition:localPosition}).distance*Math.sign(this.getPrimaryValueFromOffset(movedLocally)??1);
          if(this.hasSufficientGlobalDistanceToAccept(event.kind,this.gestureSettings?.touchSlop??null)){this.hasDragThresholdBeenMet=true;if(this.acceptedActivePointers.includes(event.pointer))this.checkDrag(event.pointer);else this.resolve(GestureDisposition.accepted);}
        }else if(this.state==='accepted')this.checkUpdate(event.timeStamp,this.getDeltaForDetails(resolvedDelta),this.getPrimaryValueFromOffset(resolvedDelta),position,localPosition,event.pointer);
        if(!this.isDisposed)this.recordMoveDeltaForMultitouch(event.pointer,localDelta);
      }
    }finally{if(terminal&&!this.isDisposed)this.giveUpPointer(event.pointer);}
  }
  override acceptGesture(pointer:number):void{if(this.isDisposed)return;invariant(!this.acceptedActivePointers.includes(pointer),'duplicate-drag-acceptance','Pointer already accepted');this.acceptedActivePointers.push(pointer);this.activePointer=pointer;if(!this.onlyAcceptDragOnThreshold||this.hasDragThresholdBeenMet)this.checkDrag(pointer);}
  override rejectGesture(pointer:number):void{if(!this.isDisposed)this.giveUpPointer(pointer);}
  protected override didStopTrackingLastPointer(pointer:number):void{invariant(this.state!=='ready','ready-drag-stop','No drag is tracking');try{if(this.state==='possible'){this.resolve(GestureDisposition.rejected);this.checkCancel();}else this.checkEnd(pointer);}finally{this.hasDragThresholdBeenMet=false;this.velocityTrackers.clear();this.initialButtons=null;this.state='ready';}}
  private giveUpPointer(pointer:number):void{try{this.stopTrackingPointer(pointer);}finally{const index=this.acceptedActivePointers.indexOf(pointer);try{if(index<0)this.resolvePointer(pointer,GestureDisposition.rejected);else this.acceptedActivePointers.splice(index,1);}finally{this.moveDeltaBeforeFrame.delete(pointer);if(this.activePointer===pointer)this.activePointer=this.acceptedActivePointers[0]??null;}}}
  private checkDown():void{if(this.onDown!==null){const details=new DragDownDetails({globalPosition:this.initialPosition!.global,localPosition:this.initialPosition!.local});this.invokeCallback('onDown',()=>this.onDown!(details));}}
  private checkDrag(pointer:number):void{if(this.state==='accepted'||this.isDisposed)return;this.state='accepted';const delta=this.pendingDragOffset!,timestamp=this.lastPendingEventTimestamp,transform=this.lastTransform;let localUpdateDelta:Offset;if(this.dragStartBehavior===DragStartBehavior.start){this.initialPosition=this.initialPosition!.add(delta);localUpdateDelta=Offset.zero;}else localUpdateDelta=this.getDeltaForDetails(delta.local);this.pendingDragOffset=OffsetPair.zero;this.lastPendingEventTimestamp=null;this.lastTransform=null;this.checkStart(timestamp,pointer);if(this.isDisposed)return;if(!localUpdateDelta.equals(Offset.zero)&&this.onUpdate!==null){const correctedLocal=this.initialPosition!.local.add(localUpdateDelta),globalDelta=PointerEvent.transformDeltaViaPositions({untransformedEndPosition:correctedLocal,untransformedDelta:localUpdateDelta,transform:transform===null?null:inverse(transform)}),corrected=this.initialPosition!.add(new OffsetPair({local:localUpdateDelta,global:globalDelta}));this.checkUpdate(timestamp,localUpdateDelta,this.getPrimaryValueFromOffset(localUpdateDelta),corrected.global,corrected.local,pointer);}if(!this.isDisposed)this.resolve(GestureDisposition.accepted);}
  private checkStart(timestamp:number|null,pointer:number):void{if(this.onStart!==null){const details=new DragStartDetails({sourceTimeStamp:timestamp,globalPosition:this.initialPosition!.global,localPosition:this.initialPosition!.local,kind:this.getKindForPointer(pointer)});this.invokeCallback('onStart',()=>this.onStart!(details));}}
  private checkUpdate(timestamp:number|null,delta:Offset,primaryDelta:number|null,globalPosition:Offset,localPosition:Offset,pointer:number):void{if(this.isDisposed)return;if(this.onUpdate!==null){const details=new DragUpdateDetails({sourceTimeStamp:timestamp,delta,primaryDelta,globalPosition,localPosition,kind:this.getKindForPointer(pointer)});this.invokeCallback('onUpdate',()=>this.onUpdate!(details));}}
  private checkEnd(pointer:number):void{if(this.onEnd===null||this.isDisposed)return;const tracker=this.velocityTrackers.get(pointer)!;const estimate=tracker.getVelocityEstimate();let details:DragEndDetails|null=null,debugReport:()=>string;if(estimate===null)debugReport=()=>'Could not estimate velocity.';else{details=this.considerFling(estimate,tracker.kind);debugReport=details!==null?()=>estimate+'; fling at '+details!.velocity+'.':()=>estimate+'; judged to not be a fling.';}details??=new DragEndDetails({primaryVelocity:0,globalPosition:this.lastPosition.global,localPosition:this.lastPosition.local});this.invokeCallback('onEnd',()=>this.onEnd!(details!),{debugReport});}
  private checkCancel():void{if(this.onCancel!==null)this.invokeCallback('onCancel',this.onCancel);}
  override dispose():void{if(this.isDisposed)return;try{super.dispose();}finally{this.velocityTrackers.clear();this.moveDeltaBeforeFrame.clear();this.acceptedActivePointers.length=0;this.activePointer=null;this.frameTimeStamp=null;this.lastUpdatedDeltaForPan=Offset.zero;this.lastTransform=null;this.initialPosition=undefined;this.pendingDragOffset=undefined;this.lastPositionValue=undefined;this.state='ready';this.initialButtons=null;}}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new EnumProperty('start behavior',this.dragStartBehavior));}
}
export class VerticalDragGestureRecognizer extends DragGestureRecognizer {
  override isFlingGesture(estimate:VelocityEstimate,kind:PointerDeviceKind):boolean{return Math.abs(estimate.pixelsPerSecond.dy)>(this.minFlingVelocity??kMinFlingVelocity)&&Math.abs(estimate.offset.dy)>(this.minFlingDistance??computeHitSlop(kind,this.gestureSettings));}
  override considerFling(estimate:VelocityEstimate,kind:PointerDeviceKind):DragEndDetails|null{if(!this.isFlingGesture(estimate,kind))return null;const max=this.maxFlingVelocity??kMaxFlingVelocity,dy=Math.max(-max,Math.min(max,estimate.pixelsPerSecond.dy));return new DragEndDetails({velocity:new Velocity({pixelsPerSecond:new Offset(0,dy)}),primaryVelocity:dy,globalPosition:this.lastPosition.global,localPosition:this.lastPosition.local});}
  override hasSufficientGlobalDistanceToAccept(kind:PointerDeviceKind,_deviceTouchSlop:number|null):boolean{return Math.abs(this.globalDistanceMoved)>computeHitSlop(kind,this.gestureSettings);}
  protected override getDeltaForDetails(delta:Offset):Offset{return new Offset(0,delta.dy);}
  protected override getPrimaryValueFromOffset(value:Offset):number{return value.dy;}
  protected override getPrimaryDragAxis():DragDirection{return 'vertical';}
  override get debugDescription():string{return 'vertical drag';}
}
export class HorizontalDragGestureRecognizer extends DragGestureRecognizer {
  override isFlingGesture(estimate:VelocityEstimate,kind:PointerDeviceKind):boolean{return Math.abs(estimate.pixelsPerSecond.dx)>(this.minFlingVelocity??kMinFlingVelocity)&&Math.abs(estimate.offset.dx)>(this.minFlingDistance??computeHitSlop(kind,this.gestureSettings));}
  override considerFling(estimate:VelocityEstimate,kind:PointerDeviceKind):DragEndDetails|null{if(!this.isFlingGesture(estimate,kind))return null;const max=this.maxFlingVelocity??kMaxFlingVelocity,dx=Math.max(-max,Math.min(max,estimate.pixelsPerSecond.dx));return new DragEndDetails({velocity:new Velocity({pixelsPerSecond:new Offset(dx,0)}),primaryVelocity:dx,globalPosition:this.lastPosition.global,localPosition:this.lastPosition.local});}
  override hasSufficientGlobalDistanceToAccept(kind:PointerDeviceKind,_deviceTouchSlop:number|null):boolean{return Math.abs(this.globalDistanceMoved)>computeHitSlop(kind,this.gestureSettings);}
  protected override getDeltaForDetails(delta:Offset):Offset{return new Offset(delta.dx,0);}
  protected override getPrimaryValueFromOffset(value:Offset):number{return value.dx;}
  protected override getPrimaryDragAxis():DragDirection{return 'horizontal';}
  override get debugDescription():string{return 'horizontal drag';}
}
export class PanGestureRecognizer extends DragGestureRecognizer {
  override isFlingGesture(estimate:VelocityEstimate,kind:PointerDeviceKind):boolean{const minVelocity=this.minFlingVelocity??kMinFlingVelocity,minDistance=this.minFlingDistance??computeHitSlop(kind,this.gestureSettings);return estimate.pixelsPerSecond.distanceSquared>minVelocity*minVelocity&&estimate.offset.distanceSquared>minDistance*minDistance;}
  override considerFling(estimate:VelocityEstimate,kind:PointerDeviceKind):DragEndDetails|null{if(!this.isFlingGesture(estimate,kind))return null;return new DragEndDetails({velocity:new Velocity({pixelsPerSecond:estimate.pixelsPerSecond}).clampMagnitude(this.minFlingVelocity??kMinFlingVelocity,this.maxFlingVelocity??kMaxFlingVelocity),globalPosition:this.lastPosition.global,localPosition:this.lastPosition.local});}
  override hasSufficientGlobalDistanceToAccept(kind:PointerDeviceKind,_deviceTouchSlop:number|null):boolean{return Math.abs(this.globalDistanceMoved)>computePanSlop(kind,this.gestureSettings);}
  protected override getDeltaForDetails(delta:Offset):Offset{return delta;}
  protected override getPrimaryValueFromOffset(_value:Offset):null{return null;}
  override get debugDescription():string{return 'pan';}
}
