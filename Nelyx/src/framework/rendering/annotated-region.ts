// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from pinned rendering/proxy_box.dart RenderAnnotatedRegion.
import {invariant} from '../../foundation/errors.ts';
import {RenderProxyBox} from './boxes.ts';
import {LayerHandle,AnnotatedRegionLayer,AnnotationType} from './layer.ts';
import type {RenderBox,RenderObject} from './object.ts';
import type {PaintingContext} from '../painting/context.ts';
export class RenderAnnotatedRegion<T extends {}> extends RenderProxyBox {
  private annotation:T;private bounded:boolean;
  private readonly retained=new LayerHandle<AnnotatedRegionLayer<T>>();
  readonly annotationType:AnnotationType<T>;
  constructor(options:{readonly value:T;readonly annotationType:AnnotationType<T>;readonly sized?:boolean;readonly child?:RenderBox<RenderObject>}){super();invariant(options.value!==null&&options.value!==undefined,'invalid-annotation','Annotation value cannot be null');invariant(options.annotationType instanceof AnnotationType,'invalid-annotation-type','Expected AnnotationType');invariant(options.sized===undefined||typeof options.sized==='boolean','invalid-annotation-size','Expected boolean sized');this.annotation=options.value;this.annotationType=options.annotationType;this.bounded=options.sized??true;if(options.child)this.child=options.child;}
  get value():T{return this.annotation;}
  set value(value:T){this.assertCanMutateLayoutProperty();invariant(value!==null&&value!==undefined,'invalid-annotation','Annotation value cannot be null');if(value!==this.annotation){this.annotation=value;this.markNeedsPaint();}}
  get sized():boolean{return this.bounded;}
  set sized(value:boolean){this.assertCanMutateLayoutProperty();invariant(typeof value==='boolean','invalid-annotation-size','Expected boolean sized');if(value!==this.bounded){this.bounded=value;this.markNeedsPaint();}}
  get layer():AnnotatedRegionLayer<T>|null{return this.retained.layer;}
  get alwaysNeedsCompositing():boolean{return true;}
  override paint(context:PaintingContext):void{const layer=new AnnotatedRegionLayer(this.annotation,{annotationType:this.annotationType,size:this.bounded?this.size:null}),hold=new LayerHandle(layer);try{context.pushLayer(layer,childContext=>super.paint(childContext),{x:0,y:0},this.paintBounds);this.retained.layer=layer;}finally{hold.dispose();}}
  override detach():void{try{super.detach();}finally{if(!this.attached)this.retained.dispose();}}
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed)this.retained.dispose();}}
}
