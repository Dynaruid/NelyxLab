// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter gestures/force_press.dart, with actual View ownership and observed pressure only.
import {Diagnosticable} from '../../foundation/diagnosticable.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {DoubleProperty} from '../../foundation/diagnostic-properties.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import {Offset} from '../../ui/offset.ts';
import {OneSequenceGestureRecognizer,OffsetPair} from './recognizer.ts';
import type {GestureRecognizerOptions} from './recognizer.ts';
import type {PositionedGestureDetails} from './gesture-details.ts';
import {GestureDisposition} from './arena.ts';
import {PointerEvent,PointerDownEvent,PointerMoveEvent,computeHitSlop} from './events.ts';
export class ForcePressDetails extends Diagnosticable(class {}) implements PositionedGestureDetails {
  readonly globalPosition:Offset;readonly localPosition:Offset;readonly pressure:number;
  constructor({globalPosition,localPosition=null,pressure}:{readonly globalPosition:Offset;readonly localPosition?:Offset|null;readonly pressure:number}){super();invariant(globalPosition instanceof Offset&&(localPosition===null||localPosition instanceof Offset)&&typeof pressure==='number','invalid-force-press-details','Force press details require Offset positions and a numeric pressure');this.globalPosition=globalPosition;this.localPosition=localPosition??globalPosition;this.pressure=pressure;if(new.target===ForcePressDetails)Object.freeze(this);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('globalPosition',this.globalPosition));properties.add(new DiagnosticsProperty('localPosition',this.localPosition));properties.add(new DoubleProperty('pressure',this.pressure));}
}
export type GestureForcePressStartCallback=(details:ForcePressDetails)=>void;
export type GestureForcePressPeakCallback=(details:ForcePressDetails)=>void;
export type GestureForcePressUpdateCallback=(details:ForcePressDetails)=>void;
export type GestureForcePressEndCallback=(details:ForcePressDetails)=>void;
export type GestureForceInterpolation=(pressureMin:number,pressureMax:number,pressure:number)=>number;
type ForceState='ready'|'possible'|'accepted'|'started'|'peaked';
export interface ForcePressGestureRecognizerOptions extends GestureRecognizerOptions {readonly startPressure?:number;readonly peakPressure?:number;readonly interpolation?:GestureForceInterpolation}
export class ForcePressGestureRecognizer extends OneSequenceGestureRecognizer {
  onStart:GestureForcePressStartCallback|null=null;onUpdate:GestureForcePressUpdateCallback|null=null;onPeak:GestureForcePressPeakCallback|null=null;onEnd:GestureForcePressEndCallback|null=null;
  readonly startPressure:number;readonly peakPressure:number;readonly interpolation:GestureForceInterpolation;
  private lastPosition:OffsetPair|undefined;private lastPressure:number|undefined;private state:ForceState='ready';
  constructor(options:ForcePressGestureRecognizerOptions){super(options);this.startPressure=options.startPressure??0.4;this.peakPressure=options.peakPressure??0.85;this.interpolation=options.interpolation??ForcePressGestureRecognizer.inverseLerp;invariant(this.peakPressure>this.startPressure,'invalid-force-thresholds','Peak pressure must exceed start pressure');}
  protected override addAllowedPointer(event:PointerDownEvent):void{if(event.pressureMax<=1)this.resolve(GestureDisposition.rejected);else{super.addAllowedPointer(event);if(this.state==='ready'){this.state='possible';this.lastPosition=OffsetPair.fromEventPosition(event);}}}
  protected override handleEvent(event:PointerEvent):void {
    invariant(this.state!=='ready','ready-force-press-dispatch','Force press is not tracking');
    try{if(event instanceof PointerMoveEvent||event instanceof PointerDownEvent){const pressure=this.interpolation(event.pressureMin,event.pressureMax,event.pressure);if(FoundationBuildMode.debug)invariant(pressure>=0&&pressure<=1||Number.isNaN(pressure),'invalid-interpolated-pressure','Interpolated pressure must be in [0,1] or NaN');this.lastPosition=OffsetPair.fromEventPosition(event);this.lastPressure=pressure;
      if(this.state==='possible'){if(pressure>this.startPressure){this.state='started';this.resolve(GestureDisposition.accepted);}else if(event.delta.distanceSquared>computeHitSlop(event.kind,this.gestureSettings))this.resolve(GestureDisposition.rejected);}
      if(this.isDisposed)return;
      if(pressure>this.startPressure&&this.state==='accepted'){this.state='started';if(this.onStart!==null){const details=this.details(pressure,this.lastPosition);this.invokeCallback('onStart',()=>this.onStart!(details));}}
      if(this.isDisposed)return;
      if(this.onPeak!==null&&pressure>this.peakPressure&&this.state==='started'){this.state='peaked';const details=new ForcePressDetails({pressure,globalPosition:event.position,localPosition:event.localPosition});this.invokeCallback('onPeak',()=>this.onPeak!(details));}
      if(!this.isDisposed&&this.onUpdate!==null&&!Number.isNaN(pressure)&&(this.state==='started'||this.state==='peaked')){const details=new ForcePressDetails({pressure,globalPosition:event.position,localPosition:event.localPosition});this.invokeCallback('onUpdate',()=>this.onUpdate!(details));}
    }}finally{if(!this.isDisposed)this.stopTrackingIfPointerNoLongerDown(event);}
  }
  private details(pressure:number,position:OffsetPair):ForcePressDetails{return new ForcePressDetails({pressure,globalPosition:position.global,localPosition:position.local});}
  override acceptGesture(_pointer:number):void{if(this.isDisposed)return;if(this.state==='possible')this.state='accepted';if(this.onStart!==null&&this.state==='started'){invariant(this.lastPosition&&this.lastPressure!==undefined,'missing-force-position','No observed force position/pressure');const details=this.details(this.lastPressure,this.lastPosition);this.invokeCallback('onStart',()=>this.onStart!(details));}}
  protected override didStopTrackingLastPointer(_pointer:number):void{const wasAccepted=this.state==='started'||this.state==='peaked';if(this.state==='possible'){this.resolve(GestureDisposition.rejected);return;}try{if(wasAccepted&&this.onEnd!==null&&this.lastPosition){const details=this.details(0,this.lastPosition);this.invokeCallback('onEnd',()=>this.onEnd!(details));}}finally{if(!this.isDisposed)this.state='ready';}}
  override rejectGesture(pointer:number):void{if(this.isDisposed)return;try{this.stopTrackingPointer(pointer);}finally{if(!this.isDisposed)this.didStopTrackingLastPointer(pointer);}}
  private static inverseLerp(min:number,max:number,t:number):number{if(FoundationBuildMode.debug)invariant(min<=max,'invalid-pressure-range','Pressure limits must be ordered');const value=(t-min)/(max-min);return Number.isNaN(value)?value:Math.max(0,Math.min(1,value));}
  override get debugDescription():string{return 'force press';}
  override dispose():void{if(this.isDisposed)return;try{super.dispose();}finally{this.lastPosition=undefined;this.lastPressure=undefined;this.state='ready';}}
}
