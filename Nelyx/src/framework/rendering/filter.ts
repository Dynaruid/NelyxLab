// SPDX-License-Identifier: BSD-3-Clause
// Pinned Flutter proxy_box filter render objects adapted to the owned scene pipeline.
import {invariant} from '../../foundation/errors.ts';
import {ColorFilter} from '../../ui/color-filter.ts';
import {ImageFilter} from '../../ui/image-filter.ts';
import {RenderProxyBox} from './boxes.ts';
import {LayerHandle,ColorFilterLayer,ImageFilterLayer} from './layer.ts';
import type {RenderBox,RenderObject} from './object.ts';
import type {PaintingContext} from '../painting/context.ts';
export class RenderColorFiltered extends RenderProxyBox {
  private value:ColorFilter;
  private readonly retained=new LayerHandle<ColorFilterLayer>();
  constructor(options:{readonly colorFilter:ColorFilter;readonly child?:RenderBox<RenderObject>}){super();invariant(options.colorFilter instanceof ColorFilter,'invalid-color-filter','Expected ColorFilter');this.value=options.colorFilter;if(options.child)this.child=options.child;}
  get colorFilter():ColorFilter{return this.value;}
  set colorFilter(value:ColorFilter){this.assertCanMutateLayoutProperty();invariant(value instanceof ColorFilter,'invalid-color-filter','Expected ColorFilter');if(value!==this.value){this.value=value;this.markNeedsPaint();}}
  override paint(context:PaintingContext):void{
    if(!this.child){this.retained.dispose();return;}const layer=this.retained.layer??new ColorFilterLayer({colorFilter:this.value}),hold=new LayerHandle(layer);
    try{layer.colorFilter=this.value;context.pushLayer(layer,childContext=>super.paint(childContext),{x:0,y:0},this.paintBounds);this.retained.layer=layer;}finally{hold.dispose();}
  }
  override detach():void{try{super.detach();}finally{if(!this.attached)this.retained.dispose();}}
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed)this.retained.dispose();}}
}
export class RenderImageFiltered extends RenderProxyBox {
  private value:ImageFilter;
  private active:boolean;
  private readonly retained=new LayerHandle<ImageFilterLayer>();
  constructor(options:{readonly imageFilter:ImageFilter;readonly enabled?:boolean;readonly child?:RenderBox<RenderObject>}){super();invariant(options.imageFilter instanceof ImageFilter,'invalid-image-filter','Expected ImageFilter');invariant(options.enabled===undefined||typeof options.enabled==='boolean','invalid-filter-enabled','enabled must be boolean');this.value=options.imageFilter;this.active=options.enabled??true;if(options.child)this.child=options.child;}
  get imageFilter():ImageFilter{return this.value;}
  set imageFilter(value:ImageFilter){this.assertCanMutateLayoutProperty();invariant(value instanceof ImageFilter,'invalid-image-filter','Expected ImageFilter');if(value!==this.value){this.value=value;this.markNeedsPaint();}}
  get enabled():boolean{return this.active;}
  set enabled(value:boolean){this.assertCanMutateLayoutProperty();invariant(typeof value==='boolean','invalid-filter-enabled','enabled must be boolean');if(value!==this.active){this.active=value;this.markNeedsPaint();}}
  override paint(context:PaintingContext):void{
    if(!this.child||!this.active){this.retained.dispose();if(this.child)super.paint(context);return;}const layer=this.retained.layer??new ImageFilterLayer({imageFilter:this.value}),hold=new LayerHandle(layer);
    try{layer.imageFilter=this.value;context.pushLayer(layer,childContext=>super.paint(childContext),{x:0,y:0},this.paintBounds);this.retained.layer=layer;}finally{hold.dispose();}
  }
  override detach():void{try{super.detach();}finally{if(!this.attached)this.retained.dispose();}}
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed)this.retained.dispose();}}
}
