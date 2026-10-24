// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../../foundation/errors.ts';
import {sameKey} from '../../foundation/key.ts';
import {SingleChildRenderObjectWidget,MultiChildRenderObjectWidget,ParentDataWidget} from './framework.ts';
import type {Widget,WidgetOptions,BuildContext} from './framework.ts';
import {RenderCustomSingleChildLayoutBox,RenderCustomMultiChildLayoutBox,MultiChildLayoutParentData,layoutIdKey} from '../rendering/custom-layout.ts';
import type {SingleChildLayoutDelegate,MultiChildLayoutDelegate,LayoutIdentifier} from '../rendering/custom-layout.ts';
import type {RenderObject} from '../rendering/object.ts';
export class CustomSingleChildLayout extends SingleChildRenderObjectWidget {
  constructor(child:Widget|undefined,readonly delegate:SingleChildLayoutDelegate,options:WidgetOptions={}){super(child,options);}
  createRenderObject(_context:BuildContext):RenderCustomSingleChildLayoutBox{return new RenderCustomSingleChildLayoutBox(this.delegate);}
  updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderCustomSingleChildLayoutBox,'invalid-custom-render','CustomSingleChildLayout requires its render box');render.delegate=this.delegate;}
}
export class CustomMultiChildLayout extends MultiChildRenderObjectWidget {
  constructor(children:readonly Widget[],readonly delegate:MultiChildLayoutDelegate,options:WidgetOptions={}){super(children,options);}
  createRenderObject(_context:BuildContext):RenderCustomMultiChildLayoutBox{return new RenderCustomMultiChildLayoutBox(this.delegate);}
  updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderCustomMultiChildLayoutBox,'invalid-custom-render','CustomMultiChildLayout requires its render box');render.delegate=this.delegate;}
}
export class LayoutId extends ParentDataWidget<MultiChildLayoutParentData> {
  readonly parentDataType=MultiChildLayoutParentData;
  constructor(child:Widget,readonly id:LayoutIdentifier,options:WidgetOptions={}){super(child,{key:options.key??layoutIdKey(id)});layoutIdKey(id);}
  get debugTypicalAncestorWidgetClass():Function{return CustomMultiChildLayout;}
  applyParentData(render:RenderObject):void{const data=render.parentData;invariant(data instanceof MultiChildLayoutParentData,'invalid-parent-data','LayoutId requires MultiChildLayoutParentData');if(data.id===undefined||!sameKey(layoutIdKey(data.id),layoutIdKey(this.id))){data.id=this.id;render.parent?.markNeedsLayout();}}
}
