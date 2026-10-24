// SPDX-License-Identifier: BSD-3-Clause
// Representation and CustomPainter ownership boundaries; geometry stays generated.
import {invariant} from '../../foundation/errors.ts';
import {ChangeNotifier} from '../../foundation/notifier.ts';
import {Color} from '../../ui/color.ts';
import {Paint} from '../../ui/paint.ts';
import {Size} from '../../ui/size.ts';
import {Offset} from '../../ui/offset.ts';
import type {Canvas} from '../../ui/canvas.ts';
import type {Size as HostSize,Offset as HostOffset} from '../../ui/geometry.ts';
import {CustomPainter} from '../rendering/custom-paint.ts';
import type {CustomPainterSemantics,SemanticsBuilderCallback} from '../rendering/custom-paint.ts';
import {EdgeInsetsDirectional} from '../painting/edge-insets.ts';
import {ShapeBorder} from '../painting/borders.ts';

export type ScrollbarTextDirection='ltr'|'rtl';
export type ScrollbarSourceList<T>=readonly T[];
export interface ScrollbarCustomPainterContract {
  addListener(listener:()=>void):void;
  removeListener(listener:()=>void):void;
  paint(canvas:Canvas,size:Size):void;
  hitTest(position:Offset):boolean|null;
  shouldRepaint(oldDelegate:ScrollbarCustomPainterContract):boolean;
  shouldRebuildSemantics(oldDelegate:ScrollbarCustomPainterContract):boolean;
  readonly semanticsBuilder:((size:Size)=>readonly CustomPainterSemantics[])|null;
}
/** Nominal source interface boundary; all paint algorithms are supplied by generation. */
export abstract class ScrollbarPainterNotifier extends ChangeNotifier implements ScrollbarCustomPainterContract {
  abstract paint(canvas:Canvas,size:Size):void;
  abstract hitTest(position:Offset):boolean|null;
  abstract shouldRepaint(oldDelegate:ScrollbarCustomPainterContract):boolean;
  abstract shouldRebuildSemantics(oldDelegate:ScrollbarCustomPainterContract):boolean;
  abstract get semanticsBuilder():((size:Size)=>readonly CustomPainterSemantics[])|null;
}
export function scrollbarIsPainter(value:unknown):value is ScrollbarCustomPainterContract{return value instanceof ScrollbarPainterNotifier||value instanceof CustomPainter;}
export function scrollbarCastPainter(value:unknown):ScrollbarCustomPainterContract{invariant(scrollbarIsPainter(value),'invalid-scrollbar-painter-cast','Expected an admitted Core/source painter');return value;}
/** Source Paint.color is a Color; Core's recorded paint wire explicitly uses ARGB8. */
export class ScrollbarSourcePaint extends Paint {
  get sourceColor():Color{return new Color(this.color);}
  set sourceColor(value:Color){invariant(value instanceof Color,'invalid-scrollbar-color','Expected the actual Core Color');this.color=value.toARGB32();}
}
export function scrollbarValueEquals(value:{equals(other:unknown):boolean}|null,other:unknown):boolean{return value===null?other===null:value.equals(other);}
/** ShapeBorder's source operator is virtual; other selected Object comparisons are identity. */
export function scrollbarObjectEquals(value:unknown,other:unknown):boolean{
  if(value===other)return true;
  if(value instanceof ShapeBorder){const equals=(value as ShapeBorder&{equals?:(other:unknown)=>boolean}).equals;if(equals)return equals.call(value,other);}
  return false;
}
export function scrollbarIsDirectional(value:unknown):value is EdgeInsetsDirectional{return value instanceof EdgeInsetsDirectional;}
export function scrollbarCastDirectional(value:unknown):EdgeInsetsDirectional{invariant(value instanceof EdgeInsetsDirectional,'invalid-scrollbar-padding-cast','Expected EdgeInsetsDirectional');return value;}
export function scrollbarIsInfinite(value:number):boolean{return value===Infinity||value===-Infinity;}
export function scrollbarDouble(value:number):number{return value;}
export function scrollbarEnumString(value:{toString():string}):string{return value.toString();}

class ScrollbarPainterBridge extends CustomPainter {
  constructor(readonly source:ScrollbarCustomPainterContract){super({typeToken:source.constructor});}
  override addListener(listener:()=>void):void{this.source.addListener(listener);}
  override removeListener(listener:()=>void):void{this.source.removeListener(listener);}
  override paint(canvas:Canvas,size:HostSize):void{this.source.paint(canvas,new Size(size.width,size.height));}
  override hitTest(position:HostOffset):boolean|null{return this.source.hitTest(new Offset(position.x,position.y));}
  override shouldRepaint(old:CustomPainter):boolean{return !(old instanceof ScrollbarPainterBridge)||this.source.shouldRepaint(old.source);}
  override shouldRebuildSemantics(old:CustomPainter):boolean{return !(old instanceof ScrollbarPainterBridge)||this.source.shouldRebuildSemantics(old.source);}
  override get semanticsBuilder():SemanticsBuilderCallback|null{const builder=this.source.semanticsBuilder;return builder===null?null:size=>builder(new Size(size.width,size.height));}
}
// A bridge has no independent subscriptions or disposal ownership. The source
// State owns its ChangeNotifier; the renderer adds/removes the same listener.
const bridges=new WeakMap<ScrollbarCustomPainterContract,ScrollbarPainterBridge>();
export function scrollbarCorePainter(source:ScrollbarCustomPainterContract):CustomPainter{let bridge=bridges.get(source);if(!bridge){bridge=new ScrollbarPainterBridge(source);bridges.set(source,bridge);}return bridge;}
export function scrollbarSourcePainter(painter:CustomPainter|null):ScrollbarCustomPainterContract|null{return painter instanceof ScrollbarPainterBridge?painter.source:null;}
