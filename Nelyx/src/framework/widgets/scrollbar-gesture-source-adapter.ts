// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../../foundation/errors.ts';
import {Offset} from '../../ui/offset.ts';
import {State,Element} from './framework.ts';
import type {BuildContext} from './framework.ts';
import {GlobalKey} from './global-key.ts';
import {CustomPaint} from './custom-paint.ts';
import {RenderBox} from '../rendering/object.ts';
import {TapGestureRecognizer} from '../gestures/tap.ts';
import {VerticalDragGestureRecognizer,HorizontalDragGestureRecognizer} from '../gestures/monodrag.ts';
import {scrollbarSourcePainter} from './scrollbar-painter-source-adapter.ts';
import type {ScrollbarCustomPainterContract} from './scrollbar-painter-source-adapter.ts';
/** Source debugOwner is the mounted scrollbar State, identifying the owning View. */
function options(debugOwner:unknown){invariant(debugOwner instanceof State&&debugOwner.mounted&&debugOwner.context instanceof Element,'invalid-scrollbar-gesture-owner','Scrollbar recognizers require their mounted State and actual View binding');return{debugOwner,binding:debugOwner.context.owner.gestureBinding};}
export class ScrollbarTapHost extends TapGestureRecognizer{constructor({debugOwner}:{debugOwner:unknown}){super(options(debugOwner));}}
export class ScrollbarVerticalDragHost extends VerticalDragGestureRecognizer{constructor({debugOwner}:{debugOwner:unknown}){super(options(debugOwner));}}
export class ScrollbarHorizontalDragHost extends HorizontalDragGestureRecognizer{constructor({debugOwner}:{debugOwner:unknown}){super(options(debugOwner));}}
export function scrollbarKeyContext(key:GlobalKey):BuildContext|null{return key.currentContext??null;}
export function scrollbarRenderObject(context:BuildContext){return context.findRenderObject()??null;}
export function scrollbarGlobalToLocal(render:RenderBox,position:Offset):Offset{const value=render.globalToLocal(position);return new Offset(value.x,value.y);}
export function scrollbarIsRenderBox(value:unknown):value is RenderBox{return value instanceof RenderBox;}
export function scrollbarCastRenderBox(value:unknown):RenderBox{invariant(scrollbarIsRenderBox(value),'invalid-scrollbar-render-box','Expected the actual Core RenderBox');return value;}
export function scrollbarIsCustomPaint(value:unknown):value is CustomPaint{return value instanceof CustomPaint;}
export function scrollbarCastCustomPaint(value:unknown):CustomPaint{invariant(scrollbarIsCustomPaint(value),'invalid-scrollbar-custom-paint','Expected the actual Core CustomPaint');return value;}
/** Read the source delegate rather than treating the nominal renderer bridge as it. */
export function scrollbarForegroundPainter(widget:CustomPaint):ScrollbarCustomPainterContract|null{return scrollbarSourcePainter(widget.foregroundPainter);}
