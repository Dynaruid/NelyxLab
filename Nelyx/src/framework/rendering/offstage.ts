// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter rendering/proxy_box.dart at the recorded pin.
import {invariant} from '../../foundation/errors.ts';import {RenderProxyBox} from './boxes.ts';import type {RenderBox,RenderObject,TextBaseline,HitTestEntry} from './object.ts';import type {BoxConstraints} from './constraints.ts';import type {Size,Offset,TransformMatrix} from '../../ui/geometry.ts';import type {SemanticsNode,Rect} from '../../ui/types.ts';import type {PaintingContext} from '../painting/context.ts';
export interface RenderOffstageOptions {readonly offstage?:boolean;readonly child?:RenderBox<RenderObject>}
export class RenderOffstage extends RenderProxyBox {
  private _offstage:boolean;
  constructor({offstage=true,child}:RenderOffstageOptions={}){invariant(typeof offstage==='boolean','invalid-offstage','offstage must be boolean');super();this._offstage=offstage;if(child)this.insert(child);}
  get offstage():boolean{return this._offstage;}set offstage(value:boolean){this.assertCanMutateLayoutProperty();invariant(typeof value==='boolean','invalid-offstage','offstage must be boolean');if(this._offstage===value)return;this._offstage=value;this.markNeedsLayoutForSizedByParentChange();}
  override get sizedByParent():boolean{return this.offstage;}
  override get isDisplayed():boolean{return !this.offstage&&super.isDisplayed;}
  protected override computeMinIntrinsicWidth(height:number):number{return this.offstage?0:super.computeMinIntrinsicWidth(height);}
  protected override computeMaxIntrinsicWidth(height:number):number{return this.offstage?0:super.computeMaxIntrinsicWidth(height);}
  protected override computeMinIntrinsicHeight(width:number):number{return this.offstage?0:super.computeMinIntrinsicHeight(width);}
  protected override computeMaxIntrinsicHeight(width:number):number{return this.offstage?0:super.computeMaxIntrinsicHeight(width);}
  protected override computeDistanceToActualBaseline(b:TextBaseline):number|null{return this.offstage?null:super.computeDistanceToActualBaseline(b);}
  protected override computeDryBaseline(c:BoxConstraints,b:TextBaseline):number|null{return this.offstage?null:super.computeDryBaseline(c,b);}
  protected override computeDryLayout(c:BoxConstraints):Size{return this.offstage?c.smallest:super.computeDryLayout(c);}
  protected override performResize():void{invariant(this.offstage,'invalid-offstage-resize','Only offstage boxes resize independently');super.performResize();}
  protected override performLayout(c:BoxConstraints):Size{if(!this.offstage)return super.performLayout(c);if(this.child){this.child.layout(c);this.child.layoutOffset={x:0,y:0};}return this.size;}
  override hitTest(position:Offset,result:HitTestEntry[],toLocal?:TransformMatrix):boolean{return !this.offstage&&super.hitTest(position,result,toLocal);}
  paintsChild(child:RenderBox<RenderObject>):boolean{invariant(child.parent===this,'invalid-offstage-child','Painted child must belong to this Offstage');return !this.offstage;}
  override paint(context:PaintingContext):void{if(!this.offstage)super.paint(context);}
  visitChildrenForSemantics(visitor:(child:RenderObject)=>void):void{if(!this.offstage&&this.child)visitor(this.child);}
  override collectSemantics(output:SemanticsNode[],matrix?:TransformMatrix,clip?:Rect):void{if(!this.offstage)super.collectSemantics(output,matrix,clip);}
}
