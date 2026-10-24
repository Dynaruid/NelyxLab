// SPDX-License-Identifier: BSD-3-Clause
// Reviewed Flutter rendering/list_body.dart; source-pin corrections are recorded in coverage.
import {invariant} from '../../foundation/errors.ts';
import type {Size,Offset} from '../../ui/geometry.ts';
import {BoxConstraints} from './constraints.ts';
import {RenderBox,ContainerBoxParentData} from './object.ts';
import type {RenderObject,TextBaseline} from './object.ts';
export type ListBodyAxisDirection='right'|'left'|'up'|'down';
export interface RenderListBodyOptions {readonly children?:readonly RenderBox<RenderObject>[];readonly axisDirection?:ListBodyAxisDirection}
export class ListBodyParentData extends ContainerBoxParentData<RenderBox<RenderObject>> {}
interface Measurement {readonly size:Size;readonly inner:BoxConstraints;readonly offsets:ReadonlyMap<RenderBox<RenderObject>,Offset>}
export class RenderListBody extends RenderBox {
  private axis:ListBodyAxisDirection;
  constructor(options:RenderListBodyOptions={}){super();this.validateDirection(options.axisDirection??'down');this.axis=options.axisDirection??'down';if(options.children)this.setChildren(options.children);}
  private validateDirection(value:ListBodyAxisDirection):void{invariant(['left','right','up','down'].includes(value),'invalid-list-direction','Unknown ListBody axisDirection');}
  get axisDirection():ListBodyAxisDirection{return this.axis;}set axisDirection(value:ListBodyAxisDirection){this.assertCanMutateLayoutProperty();this.validateDirection(value);if(this.axis!==value){this.axis=value;this.markNeedsLayout();}}
  get mainAxis():'horizontal'|'vertical'{return this.axis==='left'||this.axis==='right'?'horizontal':'vertical';}
  override setupParentData(child:RenderObject):void{invariant(child instanceof RenderBox,'invalid-list-child','ListBody requires box children');if(!(child.parentData instanceof ListBodyParentData))child.parentData=new ListBodyParentData();}
  private measure(constraints:BoxConstraints,dry:boolean):Measurement{
    const horizontal=this.mainAxis==='horizontal';invariant(horizontal?!constraints.hasBoundedWidth:!constraints.hasBoundedHeight,'bounded-list-main-axis','ListBody requires unlimited space along its main axis');invariant(horizontal?constraints.hasBoundedHeight:constraints.hasBoundedWidth,'unbounded-list-cross-axis','ListBody requires finite space along its cross axis');
    const inner=horizontal?BoxConstraints.tightFor(undefined,constraints.maxHeight):BoxConstraints.tightFor(constraints.maxWidth),sizes=new Map<RenderBox<RenderObject>,Size>();let extent=0;
    for(const child of this.children){let size:Size;if(dry)size=child.getDryLayout(inner);else{child.layout(inner,{parentUsesSize:true});size=child.size;}sizes.set(child,size);extent+=horizontal?size.width:size.height;}
    const size=constraints.constrain(horizontal?{width:extent,height:constraints.maxHeight}:{width:constraints.maxWidth,height:extent}),reverse=this.axis==='left'||this.axis==='up',offsets=new Map<RenderBox<RenderObject>,Offset>();let cursor=0;
    for(const child of this.children){const size=sizes.get(child)!,length=horizontal?size.width:size.height,offset=reverse?extent-cursor-length:cursor;offsets.set(child,horizontal?{x:offset,y:0}:{x:0,y:offset});cursor+=length;}return {size,inner,offsets};
  }
  protected override performLayout(constraints:BoxConstraints):Size{const result=this.measure(constraints,false);for(const [child,offset]of result.offsets)child.layoutOffset=offset;return result.size;}
  protected override computeDryLayout(constraints:BoxConstraints):Size{return this.measure(constraints,true).size;}
  protected override computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{const result=this.measure(constraints,true);for(const child of this.children){const value=child.getDryBaseline(result.inner,baseline);if(value!==null)return value+result.offsets.get(child)!.y;}return null;}
  protected override computeDistanceToActualBaseline(baseline:TextBaseline):number|null{for(const child of this.children){const value=child.getDistanceToActualBaseline(baseline);if(value!==null)return value+child.layoutOffset.y;}return null;}
  private measureIntrinsicExtent(dimension:'width'|'height',min:boolean,input:number):number{const sum=(dimension==='width')===(this.mainAxis==='horizontal');let extent=0;for(const child of this.children){const value=dimension==='width'?(min?child.getMinIntrinsicWidth(input):child.getMaxIntrinsicWidth(input)):(min?child.getMinIntrinsicHeight(input):child.getMaxIntrinsicHeight(input));extent=sum?extent+value:Math.max(extent,value);}return extent;}
  protected override computeMinIntrinsicWidth(height:number):number{return this.measureIntrinsicExtent('width',true,height);}
  protected override computeMaxIntrinsicWidth(height:number):number{return this.measureIntrinsicExtent('width',false,height);}
  protected override computeMinIntrinsicHeight(width:number):number{return this.measureIntrinsicExtent('height',true,width);}
  protected override computeMaxIntrinsicHeight(width:number):number{return this.measureIntrinsicExtent('height',false,width);}
}
