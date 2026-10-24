// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed from the pinned Flutter gestures/events.dart; shared TS helpers replace Dart copy/transformed mixins.
import {Diagnosticable} from '../../foundation/diagnosticable.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import {IntProperty,DoubleProperty,EnumProperty,FlagProperty} from '../../foundation/diagnostic-properties.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {invariant} from '../../foundation/errors.ts';
import {Offset} from '../../ui/offset.ts';
import {PointerDeviceKind} from '../../ui/pointer.ts';
import {captureTransform,fullTransform,transform} from '../../ui/geometry.ts';
import type {TransformMatrix} from '../../ui/geometry.ts';
import {removePerspectiveMatrix4} from '../../ui/matrix4.ts';
import type {Matrix4Storage} from '../../ui/matrix4.ts';
import type {DeviceGestureSettings} from './gesture-settings.ts';
import {kTouchSlop,kPanSlop,kScaleSlop,kPrecisePointerHitSlop,kPrecisePointerPanSlop,kPrecisePointerScaleSlop} from './constants.ts';
export const kPrimaryButton=0x01;
export const kSecondaryButton=0x02;
export const kPrimaryMouseButton=kPrimaryButton;
export const kSecondaryMouseButton=kSecondaryButton;
export const kStylusContact=kPrimaryButton;
export const kPrimaryStylusButton=kSecondaryButton;
export const kTertiaryButton=0x04;
export const kMiddleMouseButton=kTertiaryButton;
export const kSecondaryStylusButton=kTertiaryButton;
export const kBackMouseButton=0x08;
export const kForwardMouseButton=0x10;
export const kTouchContact=kPrimaryButton;
/** Button masks use the exact JavaScript safe-integer range (53 bits), an
 * explicit host adaptation of VM SMI/web bit widths. */
export function nthMouseButton(number:number):number{invariant(Number.isSafeInteger(number)&&number>=1,'invalid-button-number','Button numbers start at one');return number<=53?2**(number-1):0;}
export function nthStylusButton(number:number):number{invariant(Number.isSafeInteger(number)&&number>=1,'invalid-button-number','Button numbers start at one');return number<=52?2**number:0;}
export function smallestButton(buttons:number):number{invariant(Number.isSafeInteger(buttons),'invalid-button-mask','Button mask must be a safe integer');let value=Math.abs(buttons),bit=1;if(!value)return 0;while(value%2===0){value/=2;bit*=2;}return bit;}
export function isSingleButton(buttons:number):boolean{return buttons!==0&&smallestButton(buttons)===buttons;}
export type RespondPointerEventCallback=(options:{readonly allowPlatformDefault:boolean})=>void;
export interface PointerEventOptions {
  readonly viewId?:number|string|undefined;readonly embedderId?:number|undefined;readonly timeStamp?:number|undefined;
  readonly pointer?:number|undefined;readonly kind?:PointerDeviceKind|undefined;readonly device?:number|undefined;
  readonly position?:Offset|undefined;readonly delta?:Offset|undefined;readonly buttons?:number|undefined;readonly down?:boolean|undefined;
  readonly obscured?:boolean|undefined;readonly pressure?:number|undefined;readonly pressureMin?:number|undefined;readonly pressureMax?:number|undefined;
  readonly distance?:number|undefined;readonly distanceMax?:number|undefined;readonly size?:number|undefined;
  readonly radiusMajor?:number|undefined;readonly radiusMinor?:number|undefined;readonly radiusMin?:number|undefined;readonly radiusMax?:number|undefined;
  readonly orientation?:number|undefined;readonly tilt?:number|undefined;readonly platformData?:number|undefined;readonly synthesized?:boolean|undefined;
  readonly transform?:TransformMatrix|null|undefined;readonly original?:PointerEvent|null|undefined;
}
export type PointerEventCopyOptions=Omit<PointerEventOptions,'down'|'platformData'|'transform'|'original'>;
interface ExtraPointerOptions {readonly scrollDelta?:Offset|undefined;readonly onRespond?:RespondPointerEventCallback|undefined;readonly pan?:Offset|undefined;readonly panDelta?:Offset|undefined;readonly scale?:number|undefined;readonly rotation?:number|undefined}
const defaults=Object.freeze({viewId:0 as number|string,embedderId:0,timeStamp:0,pointer:0,kind:PointerDeviceKind.touch,device:0,position:Offset.zero,delta:Offset.zero,buttons:0,down:false,obscured:false,pressure:1,pressureMin:1,pressureMax:1,distance:0,distanceMax:0,size:0,radiusMajor:0,radiusMinor:0,radiusMin:0,radiusMax:0,orientation:0,tilt:0,platformData:0,synthesized:false});
type PointerValues=typeof defaults&ExtraPointerOptions;
interface PointerState {readonly values:PointerValues;readonly transform:TransformMatrix|null;readonly transformInput:TransformMatrix|null;readonly original:PointerEvent|null;readonly transformed:boolean;localPosition?:Offset;localDelta?:Offset;localPan?:Offset;localPanDelta?:Offset}
const pointerStates=new WeakMap<PointerEvent,PointerState>();
function pointerState(event:PointerEvent):PointerState{const state=pointerStates.get(event);invariant(state,'invalid-pointer-event','PointerEvent does not have live event data');return state;}
function transformedEvent<T extends PointerEvent>(event:T,matrix:TransformMatrix|null,prototype:object):T{
  const state=pointerState(event);if(state.transformed)return state.original!.transformed(matrix) as T;
  if(matrix===null||matrix===state.transformInput)return event;
  const original=state.original??event;invariant(Object.prototype.isPrototypeOf.call(prototype,original),'invalid-pointer-original','Original event has a different event type');
  const wrapper=Object.create(prototype) as T;pointerStates.set(wrapper,{values:pointerState(original).values,transform:captureTransform(matrix),transformInput:matrix,original,transformed:true});Object.freeze(wrapper);return wrapper;
}
/** Time uses monotonic milliseconds. String View IDs adapt existing Nelyx owners.
 * Positions/deltas retain their global values; local getters apply a captured transform. */
export abstract class PointerEvent extends Diagnosticable(class {}) {
  protected constructor(options:PointerEventOptions&ExtraPointerOptions={}){super();
    const values={...defaults,...options};for(const key of Object.keys(defaults) as (keyof typeof defaults)[])if(options[key]===undefined)(values as Record<string,unknown>)[key]=defaults[key];
    invariant(values.kind instanceof PointerDeviceKind,'invalid-pointer-kind','Expected PointerDeviceKind');
    for(const key of ['pointer','device','embedderId','buttons','platformData'] as const)invariant(Number.isSafeInteger(values[key]),'invalid-pointer-integer','Pointer integer exceeds JavaScript safe range');
    invariant(typeof values.viewId==='string'?values.viewId.length>0:Number.isSafeInteger(values.viewId),'invalid-pointer-view','Invalid View identity');
    invariant(values.position instanceof Offset&&values.delta instanceof Offset,'invalid-pointer-offset','Pointer positions and deltas require Offset values');
    const matrix=options.transform??null;pointerStates.set(this,{values:Object.freeze(values) as PointerValues,transform:matrix===null?null:captureTransform(matrix),transformInput:matrix,original:options.original??null,transformed:false});
  }
  get viewId():number|string{return pointerState(this).values.viewId;}
  get embedderId():number{return pointerState(this).values.embedderId;}
  get timeStamp():number{return pointerState(this).values.timeStamp;}
  get pointer():number{return pointerState(this).values.pointer;}
  get kind():PointerDeviceKind{return pointerState(this).values.kind;}
  get device():number{return pointerState(this).values.device;}
  get position():Offset{return pointerState(this).values.position;}
  get delta():Offset{return pointerState(this).values.delta;}
  get buttons():number{return pointerState(this).values.buttons;}
  get down():boolean{return pointerState(this).values.down;}
  get obscured():boolean{return pointerState(this).values.obscured;}
  get pressure():number{return pointerState(this).values.pressure;}
  get pressureMin():number{return pointerState(this).values.pressureMin;}
  get pressureMax():number{return pointerState(this).values.pressureMax;}
  get distance():number{return pointerState(this).values.distance;}
  get distanceMax():number{return pointerState(this).values.distanceMax;}
  get size():number{return pointerState(this).values.size;}
  get radiusMajor():number{return pointerState(this).values.radiusMajor;}
  get radiusMinor():number{return pointerState(this).values.radiusMinor;}
  get radiusMin():number{return pointerState(this).values.radiusMin;}
  get radiusMax():number{return pointerState(this).values.radiusMax;}
  get orientation():number{return pointerState(this).values.orientation;}
  get tilt():number{return pointerState(this).values.tilt;}
  get platformData():number{return pointerState(this).values.platformData;}
  get synthesized():boolean{return pointerState(this).values.synthesized;}
  get distanceMin():number{return 0;}
  get transform():TransformMatrix|null{return pointerState(this).transform;}
  get original():PointerEvent|null{return pointerState(this).original;}
  get localPosition():Offset{const state=pointerState(this);return state.transformed?(state.localPosition??=PointerEvent.transformPosition(state.transform,this.position)):this.position;}
  get localDelta():Offset{const state=pointerState(this);return state.transformed?(state.localDelta??=PointerEvent.transformDeltaViaPositions({transform:state.transform,untransformedDelta:this.delta,untransformedEndPosition:this.position,transformedEndPosition:this.localPosition})):this.delta;}
  abstract transformed(matrix:TransformMatrix|null):PointerEvent;
  abstract copyWith(options?:PointerEventCopyOptions):PointerEvent;
  static transformPosition(matrix:TransformMatrix|null,position:Offset):Offset{if(matrix===null)return position;const local=transform(matrix,position);return new Offset(local.x,local.y);}
  static transformDeltaViaPositions({transform:matrix,untransformedEndPosition,transformedEndPosition,untransformedDelta}:{readonly transform:TransformMatrix|null;readonly untransformedEndPosition:Offset;readonly transformedEndPosition?:Offset;readonly untransformedDelta:Offset}):Offset{if(matrix===null)return untransformedDelta;return (transformedEndPosition??PointerEvent.transformPosition(matrix,untransformedEndPosition)).subtract(PointerEvent.transformPosition(matrix,untransformedEndPosition.subtract(untransformedDelta)));}
  static removePerspectiveTransform(matrix:TransformMatrix):Matrix4Storage{return removePerspectiveMatrix4(fullTransform(matrix));}
  toStringFull():string{return this.toString({minLevel:'fine'});}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('position',this.position));properties.add(new DiagnosticsProperty('localPosition',this.localPosition,{defaultValue:this.position,level:'debug'}));properties.add(new DiagnosticsProperty('delta',this.delta,{defaultValue:Offset.zero,level:'debug'}));properties.add(new DiagnosticsProperty('localDelta',this.localDelta,{defaultValue:this.delta,level:'debug'}));properties.add(new DiagnosticsProperty('timeStamp',this.timeStamp,{defaultValue:0,level:'debug'}));
    properties.add(new IntProperty('pointer',this.pointer,{level:'debug'}));properties.add(new EnumProperty('kind',this.kind,{level:'debug'}));properties.add(new IntProperty('device',this.device,{defaultValue:0,level:'debug'}));properties.add(new IntProperty('buttons',this.buttons,{defaultValue:0,level:'debug'}));properties.add(new DiagnosticsProperty('down',this.down,{level:'debug'}));
    properties.add(new DoubleProperty('pressure',this.pressure,{defaultValue:1,level:'debug'}));
    properties.add(new DoubleProperty('pressureMin',this.pressureMin,{defaultValue:1,level:'debug'}));
    properties.add(new DoubleProperty('pressureMax',this.pressureMax,{defaultValue:1,level:'debug'}));
    properties.add(new DoubleProperty('distance',this.distance,{defaultValue:0,level:'debug'}));
    properties.add(new DoubleProperty('distanceMin',this.distanceMin,{defaultValue:0,level:'debug'}));
    properties.add(new DoubleProperty('distanceMax',this.distanceMax,{defaultValue:0,level:'debug'}));
    properties.add(new DoubleProperty('size',this.size,{defaultValue:0,level:'debug'}));
    properties.add(new DoubleProperty('radiusMajor',this.radiusMajor,{defaultValue:0,level:'debug'}));
    properties.add(new DoubleProperty('radiusMinor',this.radiusMinor,{defaultValue:0,level:'debug'}));
    properties.add(new DoubleProperty('radiusMin',this.radiusMin,{defaultValue:0,level:'debug'}));
    properties.add(new DoubleProperty('radiusMax',this.radiusMax,{defaultValue:0,level:'debug'}));
    properties.add(new DoubleProperty('orientation',this.orientation,{defaultValue:0,level:'debug'}));
    properties.add(new DoubleProperty('tilt',this.tilt,{defaultValue:0,level:'debug'}));
    properties.add(new IntProperty('platformData',this.platformData,{defaultValue:0,level:'debug'}));properties.add(new FlagProperty('obscured',this.obscured,{ifTrue:'obscured',level:'debug'}));properties.add(new FlagProperty('synthesized',this.synthesized,{ifTrue:'synthesized',level:'debug'}));properties.add(new IntProperty('embedderId',this.embedderId,{defaultValue:0,level:'debug'}));properties.add(typeof this.viewId==='number'?new IntProperty('viewId',this.viewId,{defaultValue:0,level:'debug'}):new DiagnosticsProperty('viewId',this.viewId,{level:'debug'}));
  }
}
export abstract class PointerSignalEvent extends PointerEvent {
  protected constructor(options:PointerEventOptions&ExtraPointerOptions={}){super({...options,kind:options.kind??PointerDeviceKind.mouse});}
  /** The source default response does nothing; scroll overrides it with the actual producer callback. */
  respond(_options:{readonly allowPlatformDefault:boolean}):void{}
}
export type PointerAddedEventOptions=Pick<PointerEventOptions,'viewId'|'timeStamp'|'pointer'|'kind'|'device'|'position'|'obscured'|'pressureMin'|'pressureMax'|'distance'|'distanceMax'|'radiusMin'|'radiusMax'|'orientation'|'tilt'|'embedderId'>;
export class PointerAddedEvent extends PointerEvent {
  constructor(options:PointerAddedEventOptions={}){
    super({viewId:options.viewId,timeStamp:options.timeStamp,pointer:options.pointer,kind:options.kind,device:options.device,position:options.position,obscured:options.obscured,pressureMin:options.pressureMin,pressureMax:options.pressureMax,distance:options.distance,distanceMax:options.distanceMax,radiusMin:options.radiusMin,radiusMax:options.radiusMax,orientation:options.orientation,tilt:options.tilt,embedderId:options.embedderId,pressure: 0.0});
    if(new.target===PointerAddedEvent)Object.freeze(this);
  }
  override transformed(matrix:TransformMatrix|null):PointerAddedEvent{return transformedEvent(this,matrix,PointerAddedEvent.prototype);}
  override copyWith(options:PointerEventCopyOptions={}):PointerAddedEvent{
    return new PointerAddedEvent({viewId:options.viewId??this.viewId,timeStamp:options.timeStamp??this.timeStamp,kind:options.kind??this.kind,device:options.device??this.device,position:options.position??this.position,obscured:options.obscured??this.obscured,pressureMin:options.pressureMin??this.pressureMin,pressureMax:options.pressureMax??this.pressureMax,distance:options.distance??this.distance,distanceMax:options.distanceMax??this.distanceMax,radiusMin:options.radiusMin??this.radiusMin,radiusMax:options.radiusMax??this.radiusMax,orientation:options.orientation??this.orientation,tilt:options.tilt??this.tilt,embedderId:options.embedderId??this.embedderId}).transformed(this.transform);
  }
}
export type PointerRemovedEventOptions=Pick<PointerEventOptions,'viewId'|'timeStamp'|'pointer'|'kind'|'device'|'position'|'obscured'|'pressureMin'|'pressureMax'|'distanceMax'|'radiusMin'|'radiusMax'|'original'|'embedderId'>;
export class PointerRemovedEvent extends PointerEvent {
  constructor(options:PointerRemovedEventOptions={}){
    super({viewId:options.viewId,timeStamp:options.timeStamp,pointer:options.pointer,kind:options.kind,device:options.device,position:options.position,obscured:options.obscured,pressureMin:options.pressureMin,pressureMax:options.pressureMax,distanceMax:options.distanceMax,radiusMin:options.radiusMin,radiusMax:options.radiusMax,original:options.original,embedderId:options.embedderId,pressure: 0.0});
    if(new.target===PointerRemovedEvent)Object.freeze(this);
  }
  override transformed(matrix:TransformMatrix|null):PointerRemovedEvent{return transformedEvent(this,matrix,PointerRemovedEvent.prototype);}
  override copyWith(options:PointerEventCopyOptions={}):PointerRemovedEvent{
    return new PointerRemovedEvent({viewId:options.viewId??this.viewId,timeStamp:options.timeStamp??this.timeStamp,kind:options.kind??this.kind,device:options.device??this.device,position:options.position??this.position,obscured:options.obscured??this.obscured,pressureMin:options.pressureMin??this.pressureMin,pressureMax:options.pressureMax??this.pressureMax,distanceMax:options.distanceMax??this.distanceMax,radiusMin:options.radiusMin??this.radiusMin,radiusMax:options.radiusMax??this.radiusMax,embedderId:options.embedderId??this.embedderId}).transformed(this.transform);
  }
}
export type PointerHoverEventOptions=Pick<PointerEventOptions,'viewId'|'timeStamp'|'kind'|'pointer'|'device'|'position'|'delta'|'buttons'|'obscured'|'pressureMin'|'pressureMax'|'distance'|'distanceMax'|'size'|'radiusMajor'|'radiusMinor'|'radiusMin'|'radiusMax'|'orientation'|'tilt'|'synthesized'|'embedderId'>;
export class PointerHoverEvent extends PointerEvent {
  constructor(options:PointerHoverEventOptions={}){
    super({viewId:options.viewId,timeStamp:options.timeStamp,kind:options.kind,pointer:options.pointer,device:options.device,position:options.position,delta:options.delta,buttons:options.buttons,obscured:options.obscured,pressureMin:options.pressureMin,pressureMax:options.pressureMax,distance:options.distance,distanceMax:options.distanceMax,size:options.size,radiusMajor:options.radiusMajor,radiusMinor:options.radiusMinor,radiusMin:options.radiusMin,radiusMax:options.radiusMax,orientation:options.orientation,tilt:options.tilt,synthesized:options.synthesized,embedderId:options.embedderId,down: false, pressure: 0.0});
    if(new.target===PointerHoverEvent)Object.freeze(this);
  }
  override transformed(matrix:TransformMatrix|null):PointerHoverEvent{return transformedEvent(this,matrix,PointerHoverEvent.prototype);}
  override copyWith(options:PointerEventCopyOptions={}):PointerHoverEvent{
    return new PointerHoverEvent({viewId:options.viewId??this.viewId,timeStamp:options.timeStamp??this.timeStamp,kind:options.kind??this.kind,device:options.device??this.device,position:options.position??this.position,delta:options.delta??this.delta,buttons:options.buttons??this.buttons,obscured:options.obscured??this.obscured,pressureMin:options.pressureMin??this.pressureMin,pressureMax:options.pressureMax??this.pressureMax,distance:options.distance??this.distance,distanceMax:options.distanceMax??this.distanceMax,size:options.size??this.size,radiusMajor:options.radiusMajor??this.radiusMajor,radiusMinor:options.radiusMinor??this.radiusMinor,radiusMin:options.radiusMin??this.radiusMin,radiusMax:options.radiusMax??this.radiusMax,orientation:options.orientation??this.orientation,tilt:options.tilt??this.tilt,synthesized:options.synthesized??this.synthesized,embedderId:options.embedderId??this.embedderId}).transformed(this.transform);
  }
}
export type PointerEnterEventOptions=Pick<PointerEventOptions,'viewId'|'timeStamp'|'pointer'|'kind'|'device'|'position'|'delta'|'buttons'|'obscured'|'pressureMin'|'pressureMax'|'distance'|'distanceMax'|'size'|'radiusMajor'|'radiusMinor'|'radiusMin'|'radiusMax'|'orientation'|'tilt'|'down'|'synthesized'|'embedderId'>;
export class PointerEnterEvent extends PointerEvent {
  constructor(options:PointerEnterEventOptions={}){
    invariant(options.kind!==PointerDeviceKind.trackpad,'invalid-trackpad-event','Trackpad uses pan-zoom events');
    super({viewId:options.viewId,timeStamp:options.timeStamp,pointer:options.pointer,kind:options.kind,device:options.device,position:options.position,delta:options.delta,buttons:options.buttons,obscured:options.obscured,pressureMin:options.pressureMin,pressureMax:options.pressureMax,distance:options.distance,distanceMax:options.distanceMax,size:options.size,radiusMajor:options.radiusMajor,radiusMinor:options.radiusMinor,radiusMin:options.radiusMin,radiusMax:options.radiusMax,orientation:options.orientation,tilt:options.tilt,down:options.down,synthesized:options.synthesized,embedderId:options.embedderId,pressure: 0.0});
    if(new.target===PointerEnterEvent)Object.freeze(this);
  }
  override transformed(matrix:TransformMatrix|null):PointerEnterEvent{return transformedEvent(this,matrix,PointerEnterEvent.prototype);}
  override copyWith(options:PointerEventCopyOptions={}):PointerEnterEvent{
    return new PointerEnterEvent({viewId:options.viewId??this.viewId,timeStamp:options.timeStamp??this.timeStamp,kind:options.kind??this.kind,device:options.device??this.device,position:options.position??this.position,delta:options.delta??this.delta,buttons:options.buttons??this.buttons,obscured:options.obscured??this.obscured,pressureMin:options.pressureMin??this.pressureMin,pressureMax:options.pressureMax??this.pressureMax,distance:options.distance??this.distance,distanceMax:options.distanceMax??this.distanceMax,size:options.size??this.size,radiusMajor:options.radiusMajor??this.radiusMajor,radiusMinor:options.radiusMinor??this.radiusMinor,radiusMin:options.radiusMin??this.radiusMin,radiusMax:options.radiusMax??this.radiusMax,orientation:options.orientation??this.orientation,tilt:options.tilt??this.tilt,synthesized:options.synthesized??this.synthesized,embedderId:options.embedderId??this.embedderId}).transformed(this.transform);
  }
  static fromMouseEvent(event:PointerEvent):PointerEnterEvent{return new PointerEnterEvent({viewId:event.viewId,timeStamp:event.timeStamp,pointer:event.pointer,kind:event.kind,device:event.device,position:event.position,delta:event.delta,buttons:event.buttons,obscured:event.obscured,pressureMin:event.pressureMin,pressureMax:event.pressureMax,distance:event.distance,distanceMax:event.distanceMax,size:event.size,radiusMajor:event.radiusMajor,radiusMinor:event.radiusMinor,radiusMin:event.radiusMin,radiusMax:event.radiusMax,orientation:event.orientation,tilt:event.tilt,down:event.down,synthesized:event.synthesized}).transformed(event.transform);}
}
export type PointerExitEventOptions=Pick<PointerEventOptions,'viewId'|'timeStamp'|'kind'|'pointer'|'device'|'position'|'delta'|'buttons'|'obscured'|'pressureMin'|'pressureMax'|'distance'|'distanceMax'|'size'|'radiusMajor'|'radiusMinor'|'radiusMin'|'radiusMax'|'orientation'|'tilt'|'down'|'synthesized'|'embedderId'>;
export class PointerExitEvent extends PointerEvent {
  constructor(options:PointerExitEventOptions={}){
    invariant(options.kind!==PointerDeviceKind.trackpad,'invalid-trackpad-event','Trackpad uses pan-zoom events');
    super({viewId:options.viewId,timeStamp:options.timeStamp,kind:options.kind,pointer:options.pointer,device:options.device,position:options.position,delta:options.delta,buttons:options.buttons,obscured:options.obscured,pressureMin:options.pressureMin,pressureMax:options.pressureMax,distance:options.distance,distanceMax:options.distanceMax,size:options.size,radiusMajor:options.radiusMajor,radiusMinor:options.radiusMinor,radiusMin:options.radiusMin,radiusMax:options.radiusMax,orientation:options.orientation,tilt:options.tilt,down:options.down,synthesized:options.synthesized,embedderId:options.embedderId,pressure: 0.0});
    if(new.target===PointerExitEvent)Object.freeze(this);
  }
  override transformed(matrix:TransformMatrix|null):PointerExitEvent{return transformedEvent(this,matrix,PointerExitEvent.prototype);}
  override copyWith(options:PointerEventCopyOptions={}):PointerExitEvent{
    return new PointerExitEvent({viewId:options.viewId??this.viewId,timeStamp:options.timeStamp??this.timeStamp,kind:options.kind??this.kind,device:options.device??this.device,position:options.position??this.position,delta:options.delta??this.delta,buttons:options.buttons??this.buttons,obscured:options.obscured??this.obscured,pressureMin:options.pressureMin??this.pressureMin,pressureMax:options.pressureMax??this.pressureMax,distance:options.distance??this.distance,distanceMax:options.distanceMax??this.distanceMax,size:options.size??this.size,radiusMajor:options.radiusMajor??this.radiusMajor,radiusMinor:options.radiusMinor??this.radiusMinor,radiusMin:options.radiusMin??this.radiusMin,radiusMax:options.radiusMax??this.radiusMax,orientation:options.orientation??this.orientation,tilt:options.tilt??this.tilt,synthesized:options.synthesized??this.synthesized,embedderId:options.embedderId??this.embedderId}).transformed(this.transform);
  }
  static fromMouseEvent(event:PointerEvent):PointerExitEvent{return new PointerExitEvent({viewId:event.viewId,timeStamp:event.timeStamp,pointer:event.pointer,kind:event.kind,device:event.device,position:event.position,delta:event.delta,buttons:event.buttons,obscured:event.obscured,pressureMin:event.pressureMin,pressureMax:event.pressureMax,distance:event.distance,distanceMax:event.distanceMax,size:event.size,radiusMajor:event.radiusMajor,radiusMinor:event.radiusMinor,radiusMin:event.radiusMin,radiusMax:event.radiusMax,orientation:event.orientation,tilt:event.tilt,down:event.down,synthesized:event.synthesized}).transformed(event.transform);}
}
export type PointerDownEventOptions=Pick<PointerEventOptions,'viewId'|'timeStamp'|'pointer'|'kind'|'device'|'position'|'buttons'|'obscured'|'pressure'|'pressureMin'|'pressureMax'|'distanceMax'|'size'|'radiusMajor'|'radiusMinor'|'radiusMin'|'radiusMax'|'orientation'|'tilt'|'embedderId'>;
export class PointerDownEvent extends PointerEvent {
  constructor(options:PointerDownEventOptions={}){
    invariant(options.kind!==PointerDeviceKind.trackpad,'invalid-trackpad-event','Trackpad uses pan-zoom events');
    super({viewId:options.viewId,timeStamp:options.timeStamp,pointer:options.pointer,kind:options.kind,device:options.device,position:options.position,buttons:options.buttons??kPrimaryButton,obscured:options.obscured,pressure:options.pressure,pressureMin:options.pressureMin,pressureMax:options.pressureMax,distanceMax:options.distanceMax,size:options.size,radiusMajor:options.radiusMajor,radiusMinor:options.radiusMinor,radiusMin:options.radiusMin,radiusMax:options.radiusMax,orientation:options.orientation,tilt:options.tilt,embedderId:options.embedderId,down: true, distance: 0.0});
    if(new.target===PointerDownEvent)Object.freeze(this);
  }
  override transformed(matrix:TransformMatrix|null):PointerDownEvent{return transformedEvent(this,matrix,PointerDownEvent.prototype);}
  override copyWith(options:PointerEventCopyOptions={}):PointerDownEvent{
    return new PointerDownEvent({viewId:options.viewId??this.viewId,timeStamp:options.timeStamp??this.timeStamp,pointer:options.pointer??this.pointer,kind:options.kind??this.kind,device:options.device??this.device,position:options.position??this.position,buttons:options.buttons??this.buttons,obscured:options.obscured??this.obscured,pressure:options.pressure??this.pressure,pressureMin:options.pressureMin??this.pressureMin,pressureMax:options.pressureMax??this.pressureMax,distanceMax:options.distanceMax??this.distanceMax,size:options.size??this.size,radiusMajor:options.radiusMajor??this.radiusMajor,radiusMinor:options.radiusMinor??this.radiusMinor,radiusMin:options.radiusMin??this.radiusMin,radiusMax:options.radiusMax??this.radiusMax,orientation:options.orientation??this.orientation,tilt:options.tilt??this.tilt,embedderId:options.embedderId??this.embedderId}).transformed(this.transform);
  }
}
export type PointerMoveEventOptions=Pick<PointerEventOptions,'viewId'|'timeStamp'|'pointer'|'kind'|'device'|'position'|'delta'|'buttons'|'obscured'|'pressure'|'pressureMin'|'pressureMax'|'distanceMax'|'size'|'radiusMajor'|'radiusMinor'|'radiusMin'|'radiusMax'|'orientation'|'tilt'|'platformData'|'synthesized'|'embedderId'>;
export class PointerMoveEvent extends PointerEvent {
  constructor(options:PointerMoveEventOptions={}){
    invariant(options.kind!==PointerDeviceKind.trackpad,'invalid-trackpad-event','Trackpad uses pan-zoom events');
    super({viewId:options.viewId,timeStamp:options.timeStamp,pointer:options.pointer,kind:options.kind,device:options.device,position:options.position,delta:options.delta,buttons:options.buttons??kPrimaryButton,obscured:options.obscured,pressure:options.pressure,pressureMin:options.pressureMin,pressureMax:options.pressureMax,distanceMax:options.distanceMax,size:options.size,radiusMajor:options.radiusMajor,radiusMinor:options.radiusMinor,radiusMin:options.radiusMin,radiusMax:options.radiusMax,orientation:options.orientation,tilt:options.tilt,platformData:options.platformData,synthesized:options.synthesized,embedderId:options.embedderId,down: true, distance: 0.0});
    if(new.target===PointerMoveEvent)Object.freeze(this);
  }
  override transformed(matrix:TransformMatrix|null):PointerMoveEvent{return transformedEvent(this,matrix,PointerMoveEvent.prototype);}
  override copyWith(options:PointerEventCopyOptions={}):PointerMoveEvent{
    return new PointerMoveEvent({viewId:options.viewId??this.viewId,timeStamp:options.timeStamp??this.timeStamp,pointer:options.pointer??this.pointer,kind:options.kind??this.kind,device:options.device??this.device,position:options.position??this.position,delta:options.delta??this.delta,buttons:options.buttons??this.buttons,obscured:options.obscured??this.obscured,pressure:options.pressure??this.pressure,pressureMin:options.pressureMin??this.pressureMin,pressureMax:options.pressureMax??this.pressureMax,distanceMax:options.distanceMax??this.distanceMax,size:options.size??this.size,radiusMajor:options.radiusMajor??this.radiusMajor,radiusMinor:options.radiusMinor??this.radiusMinor,radiusMin:options.radiusMin??this.radiusMin,radiusMax:options.radiusMax??this.radiusMax,orientation:options.orientation??this.orientation,tilt:options.tilt??this.tilt,synthesized:options.synthesized??this.synthesized,embedderId:options.embedderId??this.embedderId}).transformed(this.transform);
  }
}
export type PointerUpEventOptions=Pick<PointerEventOptions,'viewId'|'timeStamp'|'pointer'|'kind'|'device'|'position'|'buttons'|'obscured'|'pressure'|'pressureMin'|'pressureMax'|'distance'|'distanceMax'|'size'|'radiusMajor'|'radiusMinor'|'radiusMin'|'radiusMax'|'orientation'|'tilt'|'embedderId'>;
export class PointerUpEvent extends PointerEvent {
  constructor(options:PointerUpEventOptions={}){
    invariant(options.kind!==PointerDeviceKind.trackpad,'invalid-trackpad-event','Trackpad uses pan-zoom events');
    super({viewId:options.viewId,timeStamp:options.timeStamp,pointer:options.pointer,kind:options.kind,device:options.device,position:options.position,buttons:options.buttons,obscured:options.obscured,pressure:options.pressure??0.0,pressureMin:options.pressureMin,pressureMax:options.pressureMax,distance:options.distance,distanceMax:options.distanceMax,size:options.size,radiusMajor:options.radiusMajor,radiusMinor:options.radiusMinor,radiusMin:options.radiusMin,radiusMax:options.radiusMax,orientation:options.orientation,tilt:options.tilt,embedderId:options.embedderId,down: false});
    if(new.target===PointerUpEvent)Object.freeze(this);
  }
  override transformed(matrix:TransformMatrix|null):PointerUpEvent{return transformedEvent(this,matrix,PointerUpEvent.prototype);}
  override copyWith(options:PointerEventCopyOptions={}):PointerUpEvent{
    return new PointerUpEvent({viewId:options.viewId??this.viewId,timeStamp:options.timeStamp??this.timeStamp,pointer:options.pointer??this.pointer,kind:options.kind??this.kind,device:options.device??this.device,position:options.position??this.position,buttons:options.buttons??this.buttons,obscured:options.obscured??this.obscured,pressure:options.pressure??this.pressure,pressureMin:options.pressureMin??this.pressureMin,pressureMax:options.pressureMax??this.pressureMax,distance:options.distance??this.distance,distanceMax:options.distanceMax??this.distanceMax,size:options.size??this.size,radiusMajor:options.radiusMajor??this.radiusMajor,radiusMinor:options.radiusMinor??this.radiusMinor,radiusMin:options.radiusMin??this.radiusMin,radiusMax:options.radiusMax??this.radiusMax,orientation:options.orientation??this.orientation,tilt:options.tilt??this.tilt,embedderId:options.embedderId??this.embedderId}).transformed(this.transform);
  }
}
export type PointerScrollEventOptions=Pick<PointerEventOptions,'viewId'|'timeStamp'|'kind'|'device'|'position'|'embedderId'>&Pick<ExtraPointerOptions,'scrollDelta'|'onRespond'>;
export class PointerScrollEvent extends PointerSignalEvent {
  constructor(options:PointerScrollEventOptions={}){
    super({viewId:options.viewId,timeStamp:options.timeStamp,kind:options.kind,device:options.device,position:options.position,scrollDelta:options.scrollDelta??Offset.zero,embedderId:options.embedderId,onRespond:options.onRespond});
    if(new.target===PointerScrollEvent)Object.freeze(this);
  }
  override transformed(matrix:TransformMatrix|null):PointerScrollEvent{return transformedEvent(this,matrix,PointerScrollEvent.prototype);}
  override copyWith(options:PointerEventCopyOptions&Pick<ExtraPointerOptions,'onRespond'>={}):PointerScrollEvent{
    return new PointerScrollEvent({viewId:options.viewId??this.viewId,timeStamp:options.timeStamp??this.timeStamp,kind:options.kind??this.kind,device:options.device??this.device,position:options.position??this.position,scrollDelta:this.scrollDelta,embedderId:options.embedderId??this.embedderId,onRespond:options.onRespond??(options=>this.respond(options))}).transformed(this.transform);
  }
  get scrollDelta():Offset{return pointerState(this).values.scrollDelta??Offset.zero;}
  override respond(options:{readonly allowPlatformDefault:boolean}):void{pointerState(this).values.onRespond?.(options);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('scrollDelta',this.scrollDelta));}
}
export type PointerScrollInertiaCancelEventOptions=Pick<PointerEventOptions,'viewId'|'timeStamp'|'kind'|'device'|'position'|'embedderId'>;
export class PointerScrollInertiaCancelEvent extends PointerSignalEvent {
  constructor(options:PointerScrollInertiaCancelEventOptions={}){
    super({viewId:options.viewId,timeStamp:options.timeStamp,kind:options.kind,device:options.device,position:options.position,embedderId:options.embedderId});
    if(new.target===PointerScrollInertiaCancelEvent)Object.freeze(this);
  }
  override transformed(matrix:TransformMatrix|null):PointerScrollInertiaCancelEvent{return transformedEvent(this,matrix,PointerScrollInertiaCancelEvent.prototype);}
  override copyWith(options:PointerEventCopyOptions={}):PointerScrollInertiaCancelEvent{
    return new PointerScrollInertiaCancelEvent({viewId:options.viewId??this.viewId,timeStamp:options.timeStamp??this.timeStamp,kind:options.kind??this.kind,device:options.device??this.device,position:options.position??this.position,embedderId:options.embedderId??this.embedderId}).transformed(this.transform);
  }
}
export type PointerScaleEventOptions=Pick<PointerEventOptions,'viewId'|'timeStamp'|'kind'|'device'|'position'|'embedderId'>&Pick<ExtraPointerOptions,'scale'>;
export class PointerScaleEvent extends PointerSignalEvent {
  constructor(options:PointerScaleEventOptions={}){
    super({viewId:options.viewId,timeStamp:options.timeStamp,kind:options.kind,device:options.device,position:options.position,embedderId:options.embedderId,scale:options.scale??1.0});
    if(new.target===PointerScaleEvent)Object.freeze(this);
  }
  override transformed(matrix:TransformMatrix|null):PointerScaleEvent{return transformedEvent(this,matrix,PointerScaleEvent.prototype);}
  override copyWith(options:PointerEventCopyOptions&Pick<ExtraPointerOptions,'scale'>={}):PointerScaleEvent{
    return new PointerScaleEvent({viewId:options.viewId??this.viewId,timeStamp:options.timeStamp??this.timeStamp,kind:options.kind??this.kind,device:options.device??this.device,position:options.position??this.position,embedderId:options.embedderId??this.embedderId,scale:options.scale??this.scale}).transformed(this.transform);
  }
  get scale():number{return pointerState(this).values.scale??1;}
}
export type PointerPanZoomStartEventOptions=Pick<PointerEventOptions,'viewId'|'timeStamp'|'device'|'pointer'|'position'|'embedderId'|'synthesized'>;
export class PointerPanZoomStartEvent extends PointerEvent {
  constructor(options:PointerPanZoomStartEventOptions={}){
    super({viewId:options.viewId,timeStamp:options.timeStamp,device:options.device,pointer:options.pointer,position:options.position,embedderId:options.embedderId,synthesized:options.synthesized,kind: PointerDeviceKind.trackpad});
    if(new.target===PointerPanZoomStartEvent)Object.freeze(this);
  }
  override transformed(matrix:TransformMatrix|null):PointerPanZoomStartEvent{return transformedEvent(this,matrix,PointerPanZoomStartEvent.prototype);}
  override copyWith(options:PointerEventCopyOptions={}):PointerPanZoomStartEvent{
    invariant(options.kind==null||options.kind===PointerDeviceKind.trackpad,'invalid-panzoom-kind','Pan zoom kind must be trackpad');
    return new PointerPanZoomStartEvent({viewId:options.viewId??this.viewId,timeStamp:options.timeStamp??this.timeStamp,device:options.device??this.device,position:options.position??this.position,embedderId:options.embedderId??this.embedderId}).transformed(this.transform);
  }
}
export type PointerPanZoomUpdateEventOptions=Pick<PointerEventOptions,'viewId'|'timeStamp'|'device'|'pointer'|'position'|'embedderId'|'synthesized'>&Pick<ExtraPointerOptions,'pan'|'panDelta'|'scale'|'rotation'>;
export class PointerPanZoomUpdateEvent extends PointerEvent {
  constructor(options:PointerPanZoomUpdateEventOptions={}){
    super({viewId:options.viewId,timeStamp:options.timeStamp,device:options.device,pointer:options.pointer,position:options.position,embedderId:options.embedderId,pan:options.pan??Offset.zero,panDelta:options.panDelta??Offset.zero,scale:options.scale??1.0,rotation:options.rotation??0.0,synthesized:options.synthesized,kind: PointerDeviceKind.trackpad});
    if(new.target===PointerPanZoomUpdateEvent)Object.freeze(this);
  }
  override transformed(matrix:TransformMatrix|null):PointerPanZoomUpdateEvent{return transformedEvent(this,matrix,PointerPanZoomUpdateEvent.prototype);}
  override copyWith(options:PointerEventCopyOptions&Pick<ExtraPointerOptions,'scale'|'pan'|'panDelta'|'rotation'>={}):PointerPanZoomUpdateEvent{
    invariant(options.kind==null||options.kind===PointerDeviceKind.trackpad,'invalid-panzoom-kind','Pan zoom kind must be trackpad');
    return new PointerPanZoomUpdateEvent({viewId:options.viewId??this.viewId,timeStamp:options.timeStamp??this.timeStamp,device:options.device??this.device,position:options.position??this.position,embedderId:options.embedderId??this.embedderId,pan:options.pan??this.pan,panDelta:options.panDelta??this.panDelta,scale:options.scale??this.scale,rotation:options.rotation??this.rotation}).transformed(this.transform);
  }
  get scale():number{return pointerState(this).values.scale??1;}
  get pan():Offset{return pointerState(this).values.pan??Offset.zero;}
  get panDelta():Offset{return pointerState(this).values.panDelta??Offset.zero;}
  get rotation():number{return pointerState(this).values.rotation??0;}
  get localPan():Offset{const state=pointerState(this);return state.transformed?(state.localPan??=PointerEvent.transformPosition(state.transform,this.pan)):this.pan;}
  get localPanDelta():Offset{const state=pointerState(this);return state.transformed?(state.localPanDelta??=PointerEvent.transformDeltaViaPositions({transform:state.transform,untransformedEndPosition:this.pan,transformedEndPosition:this.localPan,untransformedDelta:this.panDelta})):this.panDelta;}
}
export type PointerPanZoomEndEventOptions=Pick<PointerEventOptions,'viewId'|'timeStamp'|'device'|'pointer'|'position'|'embedderId'|'synthesized'>;
export class PointerPanZoomEndEvent extends PointerEvent {
  constructor(options:PointerPanZoomEndEventOptions={}){
    super({viewId:options.viewId,timeStamp:options.timeStamp,device:options.device,pointer:options.pointer,position:options.position,embedderId:options.embedderId,synthesized:options.synthesized,kind: PointerDeviceKind.trackpad});
    if(new.target===PointerPanZoomEndEvent)Object.freeze(this);
  }
  override transformed(matrix:TransformMatrix|null):PointerPanZoomEndEvent{return transformedEvent(this,matrix,PointerPanZoomEndEvent.prototype);}
  override copyWith(options:PointerEventCopyOptions={}):PointerPanZoomEndEvent{
    invariant(options.kind==null||options.kind===PointerDeviceKind.trackpad,'invalid-panzoom-kind','Pan zoom kind must be trackpad');
    return new PointerPanZoomEndEvent({viewId:options.viewId??this.viewId,timeStamp:options.timeStamp??this.timeStamp,device:options.device??this.device,position:options.position??this.position,embedderId:options.embedderId??this.embedderId}).transformed(this.transform);
  }
}
export type PointerCancelEventOptions=Pick<PointerEventOptions,'viewId'|'timeStamp'|'pointer'|'kind'|'device'|'position'|'buttons'|'obscured'|'pressureMin'|'pressureMax'|'distance'|'distanceMax'|'size'|'radiusMajor'|'radiusMinor'|'radiusMin'|'radiusMax'|'orientation'|'tilt'|'embedderId'>;
export class PointerCancelEvent extends PointerEvent {
  constructor(options:PointerCancelEventOptions={}){
    invariant(options.kind!==PointerDeviceKind.trackpad,'invalid-trackpad-event','Trackpad uses pan-zoom events');
    super({viewId:options.viewId,timeStamp:options.timeStamp,pointer:options.pointer,kind:options.kind,device:options.device,position:options.position,buttons:options.buttons,obscured:options.obscured,pressureMin:options.pressureMin,pressureMax:options.pressureMax,distance:options.distance,distanceMax:options.distanceMax,size:options.size,radiusMajor:options.radiusMajor,radiusMinor:options.radiusMinor,radiusMin:options.radiusMin,radiusMax:options.radiusMax,orientation:options.orientation,tilt:options.tilt,embedderId:options.embedderId,down: false, pressure: 0.0});
    if(new.target===PointerCancelEvent)Object.freeze(this);
  }
  override transformed(matrix:TransformMatrix|null):PointerCancelEvent{return transformedEvent(this,matrix,PointerCancelEvent.prototype);}
  override copyWith(options:PointerEventCopyOptions={}):PointerCancelEvent{
    return new PointerCancelEvent({viewId:options.viewId??this.viewId,timeStamp:options.timeStamp??this.timeStamp,pointer:options.pointer??this.pointer,kind:options.kind??this.kind,device:options.device??this.device,position:options.position??this.position,buttons:options.buttons??this.buttons,obscured:options.obscured??this.obscured,pressureMin:options.pressureMin??this.pressureMin,pressureMax:options.pressureMax??this.pressureMax,distance:options.distance??this.distance,distanceMax:options.distanceMax??this.distanceMax,size:options.size??this.size,radiusMajor:options.radiusMajor??this.radiusMajor,radiusMinor:options.radiusMinor??this.radiusMinor,radiusMin:options.radiusMin??this.radiusMin,radiusMax:options.radiusMax??this.radiusMax,orientation:options.orientation??this.orientation,tilt:options.tilt??this.tilt,embedderId:options.embedderId??this.embedderId}).transformed(this.transform);
  }
}
export function computeHitSlop(kind:PointerDeviceKind,settings:DeviceGestureSettings|null=null):number{return kind===PointerDeviceKind.mouse?kPrecisePointerHitSlop:settings?.touchSlop??kTouchSlop;}
export function computePanSlop(kind:PointerDeviceKind,settings:DeviceGestureSettings|null=null):number{return kind===PointerDeviceKind.mouse?kPrecisePointerPanSlop:settings?.panSlop??kPanSlop;}
export function computeScaleSlop(kind:PointerDeviceKind):number{return kind===PointerDeviceKind.mouse?kPrecisePointerScaleSlop:kScaleSlop;}
