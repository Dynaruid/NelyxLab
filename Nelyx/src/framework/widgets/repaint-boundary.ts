import {RenderRepaintBoundary} from '../rendering/repaint-boundary.ts';
// SPDX-License-Identifier: BSD-3-Clause
import type {RenderBox} from '../rendering/object.ts';
import {RenderObjectWidget} from './framework.ts';
import type {Widget,BuildContext} from './framework.ts';
import type {Key} from '../../foundation/key.ts';
import {ValueKey,sameKey,Key as KeyValue} from '../../foundation/key.ts';
import {invariant} from '../../foundation/errors.ts';
export class RepaintBoundary extends RenderObjectWidget {
  constructor(readonly child:Widget,key:Key|null=null){super(key);}
  static wrap(child:Widget,index:number):RepaintBoundary{invariant(Number.isSafeInteger(index)&&index>=0,'invalid-repaint-child-index','RepaintBoundary child index must be nonnegative');return new RepaintBoundary(child,new ValueKey(child.key??index,Object,(a,b)=>a instanceof KeyValue&&b instanceof KeyValue?sameKey(a,b):a===b,value=>value instanceof KeyValue?value.hashCode:value));}
  static wrapAll(children:readonly Widget[]):readonly RepaintBoundary[]{return Object.freeze(children.map((child,index)=>this.wrap(child,index)));}
  get childWidgets():readonly Widget[]{return [this.child];}
  createRenderObject():RenderRepaintBoundary{return new RenderRepaintBoundary();}
  updateRenderObject(_context:BuildContext,_render:RenderBox):void{}
}
