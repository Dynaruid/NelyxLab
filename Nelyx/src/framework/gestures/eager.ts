// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {OneSequenceGestureRecognizer} from './recognizer.ts';
import {GestureDisposition} from './arena.ts';
import type {PointerDownEvent,PointerEvent} from './events.ts';
export class EagerGestureRecognizer extends OneSequenceGestureRecognizer {
  protected override addAllowedPointer(event:PointerDownEvent):void{super.addAllowedPointer(event);this.resolve(GestureDisposition.accepted);if(!this.isDisposed)this.stopTrackingPointer(event.pointer);}
  override get debugDescription():string{return 'eager';}
  /** Source has no retained route after eager admission. */
  protected override didStopTrackingLastPointer(_pointer:number):void{}
  protected override handleEvent(_event:PointerEvent):void{}
}
