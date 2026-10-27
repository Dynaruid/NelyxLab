// SPDX-License-Identifier: BSD-3-Clause
import {RenderConstrainedBox} from './boxes.ts';
import {PaintingContext} from '../painting/context.ts';
import {LayerHandle,OffsetLayer,ContainerLayer} from './layer.ts';
import {invariant} from '../../foundation/errors.ts';
import type {PictureRasterizer} from '../../ui/picture.ts';
import type {Image} from '../../ui/image.ts';
import {RenderObject,RenderBox} from './object.ts';
export class RenderRepaintBoundary extends RenderConstrainedBox {
  private version=-1;
  private contentsVersion=-1;
  private nestedBoundaries:RenderRepaintBoundary[]=[];
  override get isRepaintBoundary():boolean{return true;}
  private readonly retained=new LayerHandle<OffsetLayer>();
  protected override retainedPaintInvalidated():void{if(this.retained.layer)this.owner?._schedulePaintRetirement(this);}
  override _retireHiddenPaint():void{
    if(!this.retained.layer||this.contentsVersion===this.paintContentsVersion)return;
    // A covered route keeps State and valid reusable recordings. A dirty
    // recording cannot be reused and must not pin an obsolete snapshot image
    // until that route happens to paint again. Submitted frames own their
    // independent leases; retiring this cache cannot retire their resources.
    for(let node:RenderObject=this;node.parent;node=node.parent)if(!node.parent.paintsChild(node)){
      // Retained parents refer to this stable OffsetLayer. Drop obsolete
      // picture children, preserving the link that a later refresh updates.
      this.version=this.contentsVersion=-1;this.nestedBoundaries=[];this.retained.layer.removeAllChildren();this.retained.layer._discardRetainedScene();return;
    }
  }
  toImage(options:{readonly rasterizer:PictureRasterizer;readonly pixelRatio?:number}):Promise<Image>{invariant(this.version===this.paintVersion&&this.retained.layer,'unpainted-repaint-boundary','RepaintBoundary must finish painting before image capture');return this.retained.layer.toImage({x:0,y:0,...this.size},options);}
  toImageSync(options:{readonly rasterizer:PictureRasterizer;readonly pixelRatio?:number}):Image{invariant(this.version===this.paintVersion&&this.retained.layer,'unpainted-repaint-boundary','RepaintBoundary must finish painting before image capture');return this.retained.layer.toImageSync({x:0,y:0,...this.size},options);}
  private clearCache():void{const old=this.retained.layer;this.version=this.contentsVersion=-1;this.nestedBoundaries=[];const errors:unknown[]=[];try{old?.remove();}catch(error){errors.push(error);}if(old?.attached)try{old.detach();}catch(error){errors.push(error);}try{this.retained.dispose();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Repaint boundary retirement failed');}
  private refresh(context:PaintingContext):void{
    this._finishPaintInvalidationBatch();
    if(this.contentsVersion!==this.paintContentsVersion||!this.retained.layer){
      const old=this.retained.layer,previous=old?.firstChild===old?.lastChild&&old?.firstChild instanceof ContainerLayer?old.firstChild:null;
      const child=context._recordChildLayer(recording=>super.paint(recording),{x:0,y:0,...this.size},previous),layer=old??new OffsetLayer(),next=new LayerHandle(layer);let appended=false;
      try{layer.removeAllChildren();layer.append(child);appended=true;if(this.owner&&!context.recordsLayers&&!layer.attached)layer.attach(this.owner);this.retained.layer=layer;this.contentsVersion=this.paintContentsVersion;
        const nested:RenderRepaintBoundary[]=[];
        const visit=(parent:RenderObject)=>parent.visitChildren(child=>{if(!parent.paintsChild(child))return;if(child instanceof RenderRepaintBoundary)nested.push(child);else visit(child);});visit(this);this.nestedBoundaries=nested;
      }finally{next.dispose();if(!appended)child.dispose();}
    }else if(this.version!==this.paintVersion){
      // A nested boundary updates its stable layer in place. Its parent keeps
      // its static display list and only recomposes the changed child snapshot.
      // The local recording already fixes the visible nearest boundaries.
      // A local layout/paint change rebuilds that list above. Descendant-only
      // ticks need not rediscover it through every static render object.
      for(const child of this.nestedBoundaries)if(child.version!==child.paintVersion)child.refresh(context);
    }
    this.version=this.paintVersion;
  }
  override paint(context:PaintingContext):void{
    this.refresh(context);
    context.addLayer(this.retained.layer!);
  }
  override detach():void{const owner=this.owner;try{super.detach();}finally{if(!this.attached){owner?._forgetPaintRetirement(this);this.clearCache();}}}
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed)this.clearCache();}}
}
RenderObject._registerPaintInvalidationBoundary(RenderRepaintBoundary.prototype);
RenderBox._registerGeometryLayoutSemantics(RenderRepaintBoundary.prototype);
