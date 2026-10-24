// SPDX-License-Identifier: BSD-3-Clause
import {SingleChildRenderObjectWidget,LeafRenderObjectWidget} from './framework.ts';
import type {Widget,BuildContext,WidgetOptions} from './framework.ts';
import {RenderSliverFillRemaining} from '../rendering/sliver-fill-remaining.ts';
import type {FillRemainingConfiguration} from '../rendering/sliver-fill-remaining.ts';
import {RenderSliverOverlapAbsorber,RenderSliverOverlapInjector,SliverOverlapAbsorberHandle} from '../rendering/sliver-overlap.ts';
export {SliverOverlapAbsorberHandle};
export class SliverFillRemaining extends SingleChildRenderObjectWidget {
  readonly hasScrollBody:boolean;readonly fillOverscroll:boolean;
  constructor({child=null,hasScrollBody=true,fillOverscroll=false,...options}:WidgetOptions&FillRemainingConfiguration&{readonly child?:Widget|null}={}){super(child??undefined,options);this.hasScrollBody=hasScrollBody;this.fillOverscroll=fillOverscroll;}
  createRenderObject(_context:BuildContext):RenderSliverFillRemaining{return new RenderSliverFillRemaining({hasScrollBody:this.hasScrollBody,fillOverscroll:this.fillOverscroll});}
  override updateRenderObject(_context:BuildContext,render:RenderSliverFillRemaining):void{render.configure(this);}
}
export class SliverOverlapAbsorber extends SingleChildRenderObjectWidget {
  readonly handle:SliverOverlapAbsorberHandle;
  constructor({handle,sliver=null,...options}:WidgetOptions&{readonly handle:SliverOverlapAbsorberHandle;readonly sliver?:Widget|null}){super(sliver??undefined,options);this.handle=handle;}
  createRenderObject(_context:BuildContext):RenderSliverOverlapAbsorber{return new RenderSliverOverlapAbsorber({handle:this.handle});}
  override updateRenderObject(_context:BuildContext,render:RenderSliverOverlapAbsorber):void{render.handle=this.handle;}
}
export class SliverOverlapInjector extends LeafRenderObjectWidget {
  readonly handle:SliverOverlapAbsorberHandle;
  constructor({handle,...options}:WidgetOptions&{readonly handle:SliverOverlapAbsorberHandle}){super(options.key??null);this.handle=handle;}
  createRenderObject(_context:BuildContext):RenderSliverOverlapInjector{return new RenderSliverOverlapInjector({handle:this.handle});}
  override updateRenderObject(_context:BuildContext,render:RenderSliverOverlapInjector):void{render.handle=this.handle;}
}
