// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter gestures/drag_details.dart; Duration fields use milliseconds.
import {Diagnosticable} from '../../foundation/diagnosticable.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {EnumProperty,DoubleProperty} from '../../foundation/diagnostic-properties.ts';
import {invariant} from '../../foundation/errors.ts';
import {Offset} from '../../ui/offset.ts';
import {PointerDeviceKind} from '../../ui/pointer.ts';
import type {PositionedGestureDetails} from './gesture-details.ts';
import {Velocity} from './velocity-tracker.ts';
interface Positions {readonly globalPosition?:Offset;readonly localPosition?:Offset|null}
function validatePositions(global:Offset,local:Offset|null):void{invariant(global instanceof Offset&&(local===null||local instanceof Offset),'invalid-drag-position','Drag positions require Offset values');}
export class DragDownDetails extends Diagnosticable(class {}) implements PositionedGestureDetails {
  readonly globalPosition:Offset;readonly localPosition:Offset;
  constructor({globalPosition=Offset.zero,localPosition=null}:Positions={}){super();validatePositions(globalPosition,localPosition);this.globalPosition=globalPosition;this.localPosition=localPosition??globalPosition;if(new.target===DragDownDetails)Object.freeze(this);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('globalPosition',this.globalPosition));properties.add(new DiagnosticsProperty('localPosition',this.localPosition));}
}
export type GestureDragDownCallback=(details:DragDownDetails)=>void;
export class DragStartDetails extends Diagnosticable(class {}) implements PositionedGestureDetails {
  readonly globalPosition:Offset;readonly localPosition:Offset;readonly sourceTimeStamp:number|null;readonly kind:PointerDeviceKind|null;
  constructor({globalPosition=Offset.zero,localPosition=null,sourceTimeStamp=null,kind=null}:Positions&{readonly sourceTimeStamp?:number|null;readonly kind?:PointerDeviceKind|null}={}){super();validatePositions(globalPosition,localPosition);this.globalPosition=globalPosition;this.localPosition=localPosition??globalPosition;this.sourceTimeStamp=sourceTimeStamp;this.kind=kind;if(new.target===DragStartDetails)Object.freeze(this);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('globalPosition',this.globalPosition));properties.add(new DiagnosticsProperty('localPosition',this.localPosition));properties.add(new DiagnosticsProperty('sourceTimeStamp',this.sourceTimeStamp));properties.add(new EnumProperty('kind',this.kind));}
}
export type GestureDragStartCallback=(details:DragStartDetails)=>void;
export class DragUpdateDetails extends Diagnosticable(class {}) implements PositionedGestureDetails {
  readonly globalPosition:Offset;readonly localPosition:Offset;readonly sourceTimeStamp:number|null;readonly delta:Offset;readonly primaryDelta:number|null;readonly kind:PointerDeviceKind|null;
  constructor({globalPosition,localPosition=null,sourceTimeStamp=null,delta=Offset.zero,primaryDelta=null,kind=null}:{readonly globalPosition:Offset;readonly localPosition?:Offset|null;readonly sourceTimeStamp?:number|null;readonly delta?:Offset;readonly primaryDelta?:number|null;readonly kind?:PointerDeviceKind|null}){super();validatePositions(globalPosition,localPosition);invariant(delta instanceof Offset&&(primaryDelta===null||primaryDelta===delta.dx&&delta.dy===0||primaryDelta===delta.dy&&delta.dx===0),'invalid-primary-drag-delta','Primary delta must equal the nonzero axis');this.globalPosition=globalPosition;this.localPosition=localPosition??globalPosition;this.sourceTimeStamp=sourceTimeStamp;this.delta=delta;this.primaryDelta=primaryDelta;this.kind=kind;if(new.target===DragUpdateDetails)Object.freeze(this);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('globalPosition',this.globalPosition));properties.add(new DiagnosticsProperty('localPosition',this.localPosition));properties.add(new DiagnosticsProperty('sourceTimeStamp',this.sourceTimeStamp));properties.add(new DiagnosticsProperty('delta',this.delta));properties.add(new DoubleProperty('primaryDelta',this.primaryDelta));}
}
export type GestureDragUpdateCallback=(details:DragUpdateDetails)=>void;
export type GestureDragCancelCallback=()=>void;
export class DragEndDetails extends Diagnosticable(class {}) implements PositionedGestureDetails {
  readonly globalPosition:Offset;readonly localPosition:Offset;readonly velocity:Velocity;readonly primaryVelocity:number|null;
  constructor({globalPosition=Offset.zero,localPosition=null,velocity=Velocity.zero,primaryVelocity=null}:Positions&{readonly velocity?:Velocity;readonly primaryVelocity?:number|null}={}){super();validatePositions(globalPosition,localPosition);invariant(velocity instanceof Velocity&&(primaryVelocity===null||primaryVelocity===velocity.pixelsPerSecond.dx&&velocity.pixelsPerSecond.dy===0||primaryVelocity===velocity.pixelsPerSecond.dy&&velocity.pixelsPerSecond.dx===0),'invalid-primary-drag-velocity','Primary velocity must equal the nonzero axis');this.globalPosition=globalPosition;this.localPosition=localPosition??globalPosition;this.velocity=velocity;this.primaryVelocity=primaryVelocity;if(new.target===DragEndDetails)Object.freeze(this);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('globalPosition',this.globalPosition));properties.add(new DiagnosticsProperty('localPosition',this.localPosition));properties.add(new DiagnosticsProperty('velocity',this.velocity));properties.add(new DoubleProperty('primaryVelocity',this.primaryVelocity));}
}
export type GestureDragEndCallback=(details:DragEndDetails)=>void;
