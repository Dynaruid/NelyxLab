// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// RenderAnimatedOpacityMixin/RenderAnimatedOpacity from pinned rendering/proxy_box.dart.
import type {Animation} from '../animation/animation.ts';
import {Color} from '../../ui/color.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import {FlagProperty} from '../../foundation/diagnostic-properties.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {RenderObject} from './object.ts';
import type {RenderBox,PipelineOwner} from './object.ts';
import {RenderProxyBox} from './boxes.ts';
import {LayerHandle,OpacityLayer} from './layer.ts';
import type {PaintingContext} from '../painting/context.ts';
import type {Rect,SemanticsNode} from '../../ui/types.ts';
import type {TransformMatrix} from '../../ui/geometry.ts';

type OpacityBase=abstract new (...args:any[])=>RenderObject & {readonly child:RenderObject|null|undefined};
type OpacityConstructor=abstract new (...args:any[])=>AnimatedOpacityRender;
export interface AnimatedOpacityRender {
  opacity:Animation<number>;alwaysIncludeSemantics:boolean;readonly alpha:number;readonly isRepaintBoundary:boolean;
  updateCompositedLayer(options:{readonly oldLayer:OpacityLayer|null}):OpacityLayer;
  paintsChild(child:RenderObject):boolean;visitChildrenForSemantics(visitor:(child:RenderObject)=>void):void;
}
/** PaintingContext owns composited opacity recording; invalidation also refreshes retained semantics. */
export function RenderAnimatedOpacityMixin<TBase extends OpacityBase>(Base:TBase):TBase & OpacityConstructor {
  const collectParentSemantics:RenderObject['collectSemantics']=Base.prototype.collectSemantics;
  invariant(typeof collectParentSemantics==='function','abstract-opacity-semantics','Animated opacity requires a concrete parent semantics implementation');
  abstract class AnimatedOpacity extends Base implements AnimatedOpacityRender {
    private opacityAnimation:Animation<number>|null=null;
    private subscribedAnimation:Animation<number>|null=null;
    private opacityAlpha=-1;
    private includeSemantics=false;
    private readonly retainedOpacity=new LayerHandle<OpacityLayer>();
    get opacity():Animation<number>{invariant(this.opacityAnimation!==null,'missing-opacity-animation','Animated opacity requires an animation');return this.opacityAnimation;}
    set opacity(value:Animation<number>){
      this.assertCanMutateLayoutProperty();if(value===this.opacityAnimation)return;
      this.unsubscribe();this.opacityAnimation=value;
      if(this.attached)this.subscribe();this.updateOpacity();
    }
    get alpha():number{return this.opacityAlpha;}
    get isRepaintBoundary():boolean{return this.child!==null&&this.child!==undefined&&this.opacityAlpha>0;}
    get alwaysIncludeSemantics():boolean{return this.includeSemantics;}
    set alwaysIncludeSemantics(value:boolean){this.assertCanMutateLayoutProperty();if(value===this.includeSemantics)return;this.includeSemantics=value;this.markNeedsPaint();}
    private subscribe():void{if(this.subscribedAnimation!==null)return;this.opacity.addListener(this.updateOpacity);this.subscribedAnimation=this.opacity;}
    private unsubscribe():void{const previous=this.subscribedAnimation;this.subscribedAnimation=null;previous?.removeListener(this.updateOpacity);}
    private readonly updateOpacity=():void=>{const alpha=Color.getAlphaFromOpacity(this.opacity.value);if(alpha!==this.opacityAlpha){this.opacityAlpha=alpha;this.markNeedsPaint();}};
    override attach(owner:PipelineOwner):void{super.attach(owner);this.subscribe();this.updateOpacity();}
    override detach():void{try{this.unsubscribe();}finally{try{super.detach();}finally{if(!this.attached)this.retainedOpacity.dispose();}}}
    override dispose():void{try{super.dispose();}finally{if(this.debugDisposed){try{this.unsubscribe();}finally{this.retainedOpacity.dispose();}}}}
    updateCompositedLayer({oldLayer}:{readonly oldLayer:OpacityLayer|null}):OpacityLayer{const layer=oldLayer??new OpacityLayer();layer.alpha=this.opacityAlpha;return layer;}
    paintsChild(child:RenderObject):boolean{if(FoundationBuildMode.debug)invariant(child.parent===this,'invalid-opacity-child','Opacity paint child must belong to this render object');return this.opacity.value>0;}
    override paint(context:PaintingContext):void{
      if(this.opacityAlpha===0||this.child==null){this.retainedOpacity.dispose();return;}
      const layer=this.updateCompositedLayer({oldLayer:this.retainedOpacity.layer}),hold=new LayerHandle(layer);
      try{context.pushLayer(layer,childContext=>super.paint(childContext),{x:0,y:0},this.paintBounds);this.retainedOpacity.layer=layer;}finally{hold.dispose();}
    }
    visitChildrenForSemantics(visitor:(child:RenderObject)=>void):void{if(this.child!=null&&(this.opacityAlpha!==0||this.includeSemantics))visitor(this.child);}
    override collectSemantics(output:SemanticsNode[],matrix?:TransformMatrix,clip?:Rect):void{if(this.opacityAlpha!==0||this.includeSemantics)collectParentSemantics.call(this,output,matrix,clip);}
    override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('opacity',this.opacity));properties.add(new FlagProperty('alwaysIncludeSemantics',this.alwaysIncludeSemantics,{ifTrue:'alwaysIncludeSemantics'}));}
  }
  return AnimatedOpacity;
}
export interface RenderAnimatedOpacityOptions {readonly opacity:Animation<number>;readonly alwaysIncludeSemantics?:boolean;readonly child?:RenderBox<RenderObject>}
export class RenderAnimatedOpacity extends RenderAnimatedOpacityMixin(RenderProxyBox) {
  constructor({opacity,alwaysIncludeSemantics=false,child}:RenderAnimatedOpacityOptions){super(child);this.opacity=opacity;this.alwaysIncludeSemantics=alwaysIncludeSemantics;}
}
