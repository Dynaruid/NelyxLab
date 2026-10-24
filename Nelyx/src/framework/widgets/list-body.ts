// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../../foundation/errors.ts';
import {MultiChildRenderObjectWidget} from './framework.ts';
import type {Widget,BuildContext,WidgetOptions} from './framework.ts';
import {Directionality} from './app-data.ts';
import {RenderListBody} from '../rendering/list-body.ts';
import type {ListBodyAxisDirection} from '../rendering/list-body.ts';
import type {RenderObject} from '../rendering/object.ts';
export interface ListBodyOptions extends WidgetOptions {readonly mainAxis?:'horizontal'|'vertical';readonly reverse?:boolean}
export class ListBody extends MultiChildRenderObjectWidget {
  readonly mainAxis:'horizontal'|'vertical';readonly reverse:boolean;
  constructor(children:readonly Widget[]=[],options:ListBodyOptions={}){super(children,options);this.mainAxis=options.mainAxis??'vertical';this.reverse=options.reverse??false;invariant(['horizontal','vertical'].includes(this.mainAxis)&&typeof this.reverse==='boolean','invalid-list-options','ListBody requires a valid axis and boolean reverse');}
  private direction(context:BuildContext):ListBodyAxisDirection{if(this.mainAxis==='vertical')return this.reverse?'up':'down';const rtl=Directionality.of(context)==='rtl';return rtl!==this.reverse?'left':'right';}
  createRenderObject(context:BuildContext):RenderListBody{return new RenderListBody({axisDirection:this.direction(context)});}
  updateRenderObject(context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderListBody,'invalid-list-render-object','ListBody requires RenderListBody');render.axisDirection=this.direction(context);}
}
