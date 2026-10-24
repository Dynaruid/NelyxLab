// SPDX-License-Identifier: BSD-3-Clause
import type {Offset} from './geometry.ts';
import type {TransformMatrix} from './geometry.ts';
/** Nelyx host metadata. Input timestamps retain the originating View's native
 * monotonic millisecond timebase; restoration does not create new input intent. */
export interface InputFocusRequest {readonly inputTimestamp?:number;readonly restore?:boolean}
export interface PointerEvent extends Offset {
  readonly kind:'down'|'move'|'up'|'cancel'|'hover'|'wheel'|'leave'|'panZoomStart'|'panZoomUpdate'|'panZoomEnd'|'inertiaCancel';
  readonly pointer:number;readonly device:'mouse'|'touch'|'pen'|'trackpad'|'unknown';readonly buttons:number;
  /** Logical coordinates; monotonic milliseconds in the host clock's timebase. */
  readonly timestamp:number;readonly deltaX?:number;readonly deltaY?:number;
  readonly panX?:number;readonly panY?:number;readonly scale?:number;readonly rotation?:number;
  readonly inputSequence?:number;
  readonly viewportGeneration:number;
  /** Root hit-test metadata preserves global coordinates for source event adapters. */
  readonly viewId?:number|string;readonly globalPosition?:Offset;readonly globalDelta?:Offset;readonly localTransform?:TransformMatrix;
  readonly respondToSignal?:(allowPlatformDefault:boolean)=>void;
}
/** Embedding transport. Framework callbacks receive the regularized services KeyEvent. */
export interface KeyEvent {
  readonly kind:'down'|'up';readonly key:string;readonly shift:boolean;readonly control:boolean;readonly alt:boolean;readonly meta:boolean;readonly repeat:boolean;
  readonly code?:string;readonly location?:number;readonly timestamp?:number;readonly character?:string|null;
  readonly platform?:'web'|'windows'|'android';
  readonly android?:Readonly<{keyCode:number;scanCode:number;deviceId:number;source:number;metaState:number;flags?:number}>;
  readonly windows?:Readonly<{keyCode:number;scanCode:number;characterCodePoint:number;modifiers:number}>;
  readonly locks?:Readonly<{capsLock:boolean;numLock:boolean;scrollLock:boolean}>;
}
