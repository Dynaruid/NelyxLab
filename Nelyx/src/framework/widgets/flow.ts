// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../../foundation/errors.ts';
import {MultiChildRenderObjectWidget} from './framework.ts';
import type {Widget,WidgetOptions,BuildContext} from './framework.ts';
import {RenderFlow,FlowDelegate} from '../rendering/flow.ts';
import type {FlowClipBehavior} from '../rendering/flow.ts';
import type {RenderObject} from '../rendering/object.ts';
import {RepaintBoundary} from './repaint-boundary.ts';
export interface FlowOptions extends WidgetOptions {readonly clipBehavior?:FlowClipBehavior;readonly unwrapped?:boolean}
export class Flow extends MultiChildRenderObjectWidget {
  readonly clipBehavior:FlowClipBehavior;
  constructor(children:readonly Widget[],readonly delegate:FlowDelegate,options:FlowOptions={}){super(options.unwrapped?children:RepaintBoundary.wrapAll(children),options);invariant(Object.keys(options).every(key=>['key','clipBehavior','unwrapped'].includes(key))&&(options.unwrapped===undefined||typeof options.unwrapped==='boolean'),'unsupported-flow','Unknown Flow option or non-boolean unwrapped');invariant(delegate instanceof FlowDelegate,'invalid-flow-delegate','Flow requires FlowDelegate');this.clipBehavior=options.clipBehavior??'hardEdge';}
  static unwrapped(children:readonly Widget[],delegate:FlowDelegate,options:Omit<FlowOptions,'unwrapped'>={}):Flow{return new Flow(children,delegate,{...options,unwrapped:true});}
  createRenderObject(_context:BuildContext):RenderFlow{return new RenderFlow(this.delegate,{clipBehavior:this.clipBehavior});}
  updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderFlow,'invalid-flow-render','Flow requires RenderFlow');render.delegate=this.delegate;render.clipBehavior=this.clipBehavior;}
}
