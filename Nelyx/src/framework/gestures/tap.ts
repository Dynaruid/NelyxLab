// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {Diagnosticable} from '../../foundation/diagnosticable.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {EnumProperty,FlagProperty,IntProperty} from '../../foundation/diagnostic-properties.ts';
import {invariant} from '../../foundation/errors.ts';
import {Offset} from '../../ui/offset.ts';
import {PointerDeviceKind} from '../../ui/pointer.ts';
import type {TransformMatrix} from '../../ui/geometry.ts';
import type {PositionedGestureDetails} from './gesture-details.ts';
import {PrimaryPointerGestureRecognizer,GestureRecognizerState} from './recognizer.ts';
import type {PrimaryPointerGestureRecognizerOptions} from './recognizer.ts';
import {GestureDisposition} from './arena.ts';
import {kPressTimeout} from './constants.ts';
import {PointerDownEvent,PointerUpEvent,PointerMoveEvent,PointerCancelEvent,kPrimaryButton,kSecondaryButton,kTertiaryButton} from './events.ts';
import type {PointerEvent} from './events.ts';
export class TapDownDetails extends Diagnosticable(class {}) implements PositionedGestureDetails {
  readonly globalPosition:Offset;readonly localPosition:Offset;readonly kind:PointerDeviceKind|null;
  constructor({globalPosition=Offset.zero,localPosition=null,kind=null}:{readonly globalPosition?:Offset;readonly localPosition?:Offset|null;readonly kind?:PointerDeviceKind|null}={}){super();invariant(globalPosition instanceof Offset&&(localPosition===null||localPosition instanceof Offset)&&(kind===null||kind instanceof PointerDeviceKind),'invalid-tap-down-details','Invalid tap positions/device kind');this.globalPosition=globalPosition;this.localPosition=localPosition??globalPosition;this.kind=kind;if(new.target===TapDownDetails)Object.freeze(this);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('globalPosition',this.globalPosition));properties.add(new DiagnosticsProperty('localPosition',this.localPosition));properties.add(new EnumProperty('kind',this.kind));}
}
export class TapUpDetails extends Diagnosticable(class {}) implements PositionedGestureDetails {
  readonly globalPosition:Offset;readonly localPosition:Offset;readonly kind:PointerDeviceKind;
  constructor({globalPosition=Offset.zero,localPosition=null,kind}:{readonly globalPosition?:Offset;readonly localPosition?:Offset|null;readonly kind:PointerDeviceKind}){super();invariant(globalPosition instanceof Offset&&(localPosition===null||localPosition instanceof Offset)&&kind instanceof PointerDeviceKind,'invalid-tap-up-details','Invalid tap positions/device kind');this.globalPosition=globalPosition;this.localPosition=localPosition??globalPosition;this.kind=kind;if(new.target===TapUpDetails)Object.freeze(this);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('globalPosition',this.globalPosition));properties.add(new DiagnosticsProperty('localPosition',this.localPosition));properties.add(new EnumProperty('kind',this.kind));}
}
export class TapMoveDetails {
  readonly globalPosition:Offset;readonly localPosition:Offset;readonly kind:PointerDeviceKind;readonly delta:Offset;
  constructor({kind,globalPosition=Offset.zero,delta=Offset.zero,localPosition=null}:{readonly kind:PointerDeviceKind;readonly globalPosition?:Offset;readonly delta?:Offset;readonly localPosition?:Offset|null}){invariant(kind instanceof PointerDeviceKind&&globalPosition instanceof Offset&&delta instanceof Offset&&(localPosition===null||localPosition instanceof Offset),'invalid-tap-move-details','Invalid tap positions/delta/device kind');this.kind=kind;this.globalPosition=globalPosition;this.localPosition=localPosition??globalPosition;this.delta=delta;if(new.target===TapMoveDetails)Object.freeze(this);}
}
export type GestureTapDownCallback=(details:TapDownDetails)=>void;
export type GestureTapUpCallback=(details:TapUpDetails)=>void;
export type GestureTapCallback=()=>void;
export type GestureTapMoveCallback=(details:TapMoveDetails)=>void;
export type GestureTapCancelCallback=()=>void;
export type BaseTapGestureRecognizerOptions=Omit<PrimaryPointerGestureRecognizerOptions,'deadline'>;
export abstract class BaseTapGestureRecognizer extends PrimaryPointerGestureRecognizer {
  private sentTapDown=false;private wonArenaForPrimaryPointer=false;private down:PointerDownEvent|null=null;private up:PointerUpEvent|null=null;
  constructor(options:BaseTapGestureRecognizerOptions){super({...options,deadline:kPressTimeout});}
  protected abstract handleTapDown(options:{readonly down:PointerDownEvent}):void;
  protected abstract handleTapUp(options:{readonly down:PointerDownEvent;readonly up:PointerUpEvent}):void;
  /** Source default extension hook intentionally does nothing. */
  protected handleTapMove(_options:{readonly move:PointerMoveEvent}):void{}
  protected abstract handleTapCancel(options:{readonly down:PointerDownEvent;readonly cancel?:PointerCancelEvent|null;readonly reason:string}):void;
  protected override addAllowedPointer(event:PointerDownEvent):void{if(this.state===GestureRecognizerState.ready){if(this.down!==null&&this.up!==null){invariant(this.down.pointer===this.up.pointer,'mismatched-tap-sequence','Tap down/up pointers differ');this.reset();}invariant(this.down===null&&this.up===null,'unfinished-tap-sequence','The previous tap has not finished');this.down=event;}if(this.down!==null)super.addAllowedPointer(event);}
  protected override startTrackingPointer(pointer:number,matrix:TransformMatrix|null=null):void{invariant(this.down!==null,'missing-tap-down','Tap down must be captured before arena admission');super.startTrackingPointer(pointer,matrix);}
  protected override handlePrimaryPointer(event:PointerEvent):void {
    if(event instanceof PointerUpEvent){this.up=event;this.checkUp();}
    else if(event instanceof PointerCancelEvent){try{this.resolve(GestureDisposition.rejected);if(this.sentTapDown)this.checkCancel(event,'');}finally{this.reset();}}
    else{invariant(this.down,'missing-tap-down','Tap pointer has no down event');if(event.buttons!==this.down.buttons){this.resolve(GestureDisposition.rejected);this.stopTrackingPointer(this.primaryPointer!);}else if(event instanceof PointerMoveEvent)this.checkMove(event);}
  }
  protected override resolve(disposition:GestureDisposition):void {
    let failed=false,failure:unknown;
    if(this.wonArenaForPrimaryPointer&&disposition===GestureDisposition.rejected){invariant(this.sentTapDown,'missing-tap-down-callback','A won tap must have sent down');try{this.checkCancel(null,'spontaneous');}catch(error){failed=true;failure=error;}finally{this.reset();}}
    try{super.resolve(disposition);}catch(error){if(failed)throw new AggregateError([failure,error],'Tap cancellation failed');throw error;}if(failed)throw failure;
  }
  protected override didExceedDeadline():void{this.checkDown();}
  override acceptGesture(pointer:number):void{super.acceptGesture(pointer);if(pointer===this.primaryPointer&&!this.isDisposed){this.checkDown();if(this.isDisposed)return;this.wonArenaForPrimaryPointer=true;this.checkUp();}}
  override rejectGesture(pointer:number):void{super.rejectGesture(pointer);if(pointer===this.primaryPointer){invariant(this.state!==GestureRecognizerState.possible,'possible-rejected-tap','Rejected tap must be defunct or ready');try{if(this.sentTapDown)this.checkCancel(null,'forced');}finally{this.reset();}}}
  private checkDown():void{if(this.sentTapDown||this.isDisposed)return;invariant(this.down,'missing-tap-down','Tap has no down event');this.handleTapDown({down:this.down});if(!this.isDisposed)this.sentTapDown=true;}
  private checkUp():void{if(!this.wonArenaForPrimaryPointer||this.up===null||this.isDisposed)return;invariant(this.down&&this.up.pointer===this.down.pointer,'mismatched-tap-up','Tap up does not match its down');try{this.handleTapUp({down:this.down,up:this.up});}finally{this.reset();}}
  private checkCancel(cancel:PointerCancelEvent|null,note:string):void{invariant(this.down,'missing-tap-cancel-down','Tap cancel has no down event');this.handleTapCancel({down:this.down,cancel,reason:note});}
  private checkMove(move:PointerMoveEvent):void{invariant(this.down&&move.pointer===this.down.pointer,'mismatched-tap-move','Tap move does not match its down');this.handleTapMove({move});}
  private reset():void{this.sentTapDown=false;this.wonArenaForPrimaryPointer=false;this.up=null;this.down=null;}
  override dispose():void{if(this.isDisposed)return;try{super.dispose();}finally{this.reset();}}
  override get debugDescription():string{return 'base tap';}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new FlagProperty('wonArenaForPrimaryPointer',this.wonArenaForPrimaryPointer,{ifTrue:'won arena'}));properties.add(new DiagnosticsProperty('finalPosition',this.up?.position??null,{defaultValue:null}));properties.add(new DiagnosticsProperty('finalLocalPosition',this.up?.localPosition??null,{defaultValue:this.up?.position??null}));properties.add(new IntProperty('button',this.down?.buttons??null,{defaultValue:null}));properties.add(new FlagProperty('sentTapDown',this.sentTapDown,{ifTrue:'sent tap down'}));}
}
export class TapGestureRecognizer extends BaseTapGestureRecognizer {
  onTapDown:GestureTapDownCallback|null=null;onTapUp:GestureTapUpCallback|null=null;onTap:GestureTapCallback|null=null;onTapMove:GestureTapMoveCallback|null=null;onTapCancel:GestureTapCancelCallback|null=null;
  onSecondaryTap:GestureTapCallback|null=null;onSecondaryTapDown:GestureTapDownCallback|null=null;onSecondaryTapUp:GestureTapUpCallback|null=null;onSecondaryTapCancel:GestureTapCancelCallback|null=null;
  onTertiaryTapDown:GestureTapDownCallback|null=null;onTertiaryTapUp:GestureTapUpCallback|null=null;onTertiaryTapCancel:GestureTapCancelCallback|null=null;
  protected override isPointerAllowed(event:PointerDownEvent):boolean {
    switch(event.buttons){case kPrimaryButton:if(this.onTapDown===null&&this.onTap===null&&this.onTapUp===null&&this.onTapCancel===null&&this.onTapMove===null)return false;break;case kSecondaryButton:if(this.onSecondaryTap===null&&this.onSecondaryTapDown===null&&this.onSecondaryTapUp===null&&this.onSecondaryTapCancel===null)return false;break;case kTertiaryButton:if(this.onTertiaryTapDown===null&&this.onTertiaryTapUp===null&&this.onTertiaryTapCancel===null)return false;break;default:return false;}return super.isPointerAllowed(event);
  }
  protected override handleTapDown({down}:{readonly down:PointerDownEvent}):void {const details=new TapDownDetails({globalPosition:down.position,localPosition:down.localPosition,kind:this.getKindForPointer(down.pointer)});switch(down.buttons){case kPrimaryButton:if(this.onTapDown!==null)this.invokeCallback('onTapDown',()=>this.onTapDown!(details));break;case kSecondaryButton:if(this.onSecondaryTapDown!==null)this.invokeCallback('onSecondaryTapDown',()=>this.onSecondaryTapDown!(details));break;case kTertiaryButton:if(this.onTertiaryTapDown!==null)this.invokeCallback('onTertiaryTapDown',()=>this.onTertiaryTapDown!(details));break;}}
  protected override handleTapUp({down,up}:{readonly down:PointerDownEvent;readonly up:PointerUpEvent}):void {const details=new TapUpDetails({kind:up.kind,globalPosition:up.position,localPosition:up.localPosition});switch(down.buttons){case kPrimaryButton:if(this.onTapUp!==null)this.invokeCallback('onTapUp',()=>this.onTapUp!(details));if(this.onTap!==null)this.invokeCallback('onTap',this.onTap);break;case kSecondaryButton:if(this.onSecondaryTapUp!==null)this.invokeCallback('onSecondaryTapUp',()=>this.onSecondaryTapUp!(details));if(this.onSecondaryTap!==null)this.invokeCallback('onSecondaryTap',()=>this.onSecondaryTap!());break;case kTertiaryButton:if(this.onTertiaryTapUp!==null)this.invokeCallback('onTertiaryTapUp',()=>this.onTertiaryTapUp!(details));break;}}
  protected override handleTapMove({move}:{readonly move:PointerMoveEvent}):void{if(this.onTapMove!==null&&move.buttons===kPrimaryButton){const details=new TapMoveDetails({globalPosition:move.position,localPosition:move.localPosition,kind:this.getKindForPointer(move.pointer),delta:move.delta});this.invokeCallback('onTapMove',()=>this.onTapMove!(details));}}
  protected override handleTapCancel({down,reason}:{readonly down:PointerDownEvent;readonly cancel?:PointerCancelEvent|null;readonly reason:string}):void{const note=reason===''?'':reason+' ';switch(down.buttons){case kPrimaryButton:if(this.onTapCancel!==null)this.invokeCallback(note+'onTapCancel',this.onTapCancel);break;case kSecondaryButton:if(this.onSecondaryTapCancel!==null)this.invokeCallback(note+'onSecondaryTapCancel',this.onSecondaryTapCancel);break;case kTertiaryButton:if(this.onTertiaryTapCancel!==null)this.invokeCallback(note+'onTertiaryTapCancel',this.onTertiaryTapCancel);break;}}
  override get debugDescription():string{return 'tap';}
}
