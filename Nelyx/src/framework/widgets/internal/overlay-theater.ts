// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Bounded Overlay/Navigator theater; pinned overlay.dart lays out onstage children.
import {invariant} from '../../../foundation/errors.ts';
import {RenderObjectWidget} from '../framework.ts';
import type {Widget,BuildContext} from '../framework.ts';
import {Directionality} from '../app-data.ts';
import {RenderStack} from '../../rendering/boxes.ts';
import type {BoxConstraints} from '../../rendering/constraints.ts';
import type {RenderBox,RenderObject,HitTestEntry} from '../../rendering/object.ts';
import type {PaintingContext} from '../../painting/context.ts';
import {contains,identity,inversePaintTransform,transform,multiply,bounds,intersect} from '../../../ui/geometry.ts';
import type {Offset,TransformMatrix,Size} from '../../../ui/geometry.ts';
import type {SemanticsNode,Rect} from '../../../ui/types.ts';
import type {Clip} from '../../../ui/clip.ts';
class RenderTheater extends RenderStack {
  protected override get stackLayoutChildren():readonly RenderBox<RenderObject>[]{return this.children.slice(this.skipCount);}
  override laysOutChild(child:RenderObject):boolean{return this.paintsChild(child);}
  private skipped=0;
  override paintsChild(child:RenderObject):boolean{invariant(child.parent===this,'foreign-overlay-child','Overlay paint child must belong to this theater');return this.children.findIndex(value=>value===child)>=this.skipCount;}
  get skipCount():number{return this.skipped;}
  set skipCount(value:number){this.assertCanMutateLayoutProperty();invariant(Number.isSafeInteger(value)&&value>=0,'invalid-overlay-skip','Skip count must be nonnegative');if(value!==this.skipped){this.skipped=value;this.markNeedsLayout();}}
  protected override computeDryLayout(constraints:BoxConstraints):Size{invariant(constraints.hasBoundedWidth&&constraints.hasBoundedHeight,'unbounded-overlay','This overlay requires actual bounded View constraints; source content sizing is not implemented');return super.computeDryLayout(constraints);}
  protected override performLayout(constraints:BoxConstraints):Size{invariant(constraints.hasBoundedWidth&&constraints.hasBoundedHeight,'unbounded-overlay','This overlay requires actual bounded View constraints; source content sizing is not implemented');return super.performLayout(constraints);}
  protected override paintStack(context:PaintingContext):void{for(const child of this.children.slice(this.skipCount))this.paintChild(context,child);}
  override hitTest(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{if(!contains({x:0,y:0,...this.size},position))return false;for(const child of this.children.slice(this.skipCount).reverse()){const matrix=inversePaintTransform(this.childTransform(child));if(matrix&&child.hitTest(transform(matrix,position),result,multiply(matrix,toLocal))){result.push({target:this,transform:toLocal});return true;}}return false;}
  override visitChildrenForSemantics(visitor:(child:RenderObject)=>void):void{for(const child of this.children.slice(this.skipCount))visitor(child);}
  override collectSemantics(output:SemanticsNode[],matrix:TransformMatrix=identity,clip?:Rect):void{const own=bounds(matrix,this.size),next=this.clips?(clip?intersect(clip,own):own):clip;for(const child of this.children.slice(this.skipCount))child.collectSemantics(output,multiply(matrix,this.childTransform(child)),next);}
}
export class OverlayTheater extends RenderObjectWidget {
  constructor(readonly children:readonly Widget[],readonly skipCount:number,readonly clipBehavior:Clip){super();}
  get childWidgets():readonly Widget[]{return this.children;}
  createRenderObject(context:BuildContext):RenderTheater{const render=new RenderTheater({fit:'expand',clipBehavior:this.clipBehavior,textDirection:context.maybeDependOn(Directionality)?.direction??'ltr'});render.skipCount=this.skipCount;return render;}
  updateRenderObject(context:BuildContext,object:RenderBox):void{const render=object as RenderTheater;render.skipCount=this.skipCount;render.clipBehavior=this.clipBehavior;render.textDirection=context.maybeDependOn(Directionality)?.direction??'ltr';}
}
