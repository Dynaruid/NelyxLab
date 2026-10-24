// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {SingleChildRenderObjectWidget} from './framework.ts';
import type {BuildContext,Widget,WidgetOptions} from './framework.ts';
import {RenderProxyBox} from '../rendering/boxes.ts';
import type {RenderObject} from '../rendering/object.ts';
import type {PaintingContext} from '../painting/context.ts';
import {BackdropFilterLayer,LayerHandle} from '../rendering/layer.ts';
import type {ImageFilter} from '../../ui/image-filter.ts';
import type {BlendMode} from '../../ui/paint.ts';
export interface BackdropFilterOptions extends WidgetOptions {readonly filter:ImageFilter;readonly blendMode?:BlendMode;readonly enabled?:boolean;readonly child?:Widget}
export class BackdropFilter extends SingleChildRenderObjectWidget {
  readonly filter:ImageFilter;readonly blendMode:BlendMode;readonly enabled:boolean;
  constructor({filter,blendMode='srcOver',enabled=true,child,key=null}:BackdropFilterOptions){super(child,{key});this.filter=filter;this.blendMode=blendMode;this.enabled=enabled;}
  createRenderObject():RenderBackdropFilter{return new RenderBackdropFilter(this.filter,this.blendMode,this.enabled);}
  updateRenderObject(_context:BuildContext,render:RenderObject):void{if(!(render instanceof RenderBackdropFilter))throw new Error('Wrong backdrop renderer');render.configure(this.filter,this.blendMode,this.enabled);}
}
export class RenderBackdropFilter extends RenderProxyBox {
  private readonly retained=new LayerHandle<BackdropFilterLayer>();
  constructor(private filter:ImageFilter,private blendMode:BlendMode='srcOver',private enabled=true){super();}
  configure(filter:ImageFilter,blendMode:BlendMode,enabled:boolean):void{this.assertCanMutateLayoutProperty();if(filter!==this.filter||blendMode!==this.blendMode||enabled!==this.enabled){this.filter=filter;this.blendMode=blendMode;this.enabled=enabled;this.markNeedsPaint();}}
  override paint(context:PaintingContext):void{if(!this.enabled){this.retained.dispose();super.paint(context);return;}if(!this.child){this.retained.dispose();return;}const layer=this.retained.layer??new BackdropFilterLayer();this.retained.layer=layer;layer.filter=this.filter;layer.blendMode=this.blendMode;context.pushLayer(layer,child=>super.paint(child));}
  override detach():void{try{super.detach();}finally{if(!this.attached)this.retained.dispose();}}
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed)this.retained.dispose();}}
}
