// SPDX-License-Identifier: BSD-3-Clause
import {Canvas} from '../../ui/canvas.ts';
import type {TransformMatrix} from '../../ui/geometry.ts';
import type {RenderObject} from '../rendering/object.ts';
import type {Offset} from '../../ui/geometry.ts';
import type {Rect,PaintCommand} from '../../ui/types.ts';
import {PictureRecorder} from '../../ui/picture-recorder.ts';
import type {Picture} from '../../ui/picture.ts';
import type {PictureResourceProvider} from '../../ui/picture.ts';
import {SceneBuilder} from '../../ui/scene.ts';
import type {Scene} from '../../ui/scene.ts';
import {Layer,LayerHandle,ContainerLayer,PictureLayer,OpacityLayer,TransformLayer} from '../rendering/layer.ts';
import {Matrix4} from '../../math/matrix4.ts';
import {Rect as SourceRect} from '../../ui/rect.ts';
import {MatrixUtils} from './matrix-utils.ts';
import {RecordedCanvasLayer} from './recorded-layer.ts';
import {invariant} from '../../foundation/errors.ts';
import {paintCommandRecordCount,paintFrameLimits} from '../../ui/frame.ts';
interface CompositionEntry {readonly mark:number;readonly layer:Layer;readonly parent:ContainerLayer|null}
interface CompositionStructure {readonly layer:Layer;readonly parent:ContainerLayer|null;readonly children:readonly Layer[]|null;readonly picture:Picture|null}
interface RetainedComposition {readonly body:ContainerLayer;readonly bounds:Rect;readonly commands:readonly PaintCommand[];readonly entries:readonly CompositionEntry[];readonly structure:readonly CompositionStructure[]}
const retainedCompositions=new WeakMap<ContainerLayer,RetainedComposition>();
function sameBounds(a:Rect,b:Rect):boolean{return Object.is(a.x,b.x)&&Object.is(a.y,b.y)&&Object.is(a.width,b.width)&&Object.is(a.height,b.height);}
/** Only value-only primitives can reuse an assembly. Resource commands take fresh holds. */
function sameCompositionCommand(a:PaintCommand,b:PaintCommand):boolean{
  if(a.op!==b.op||'resource'in a||'resource'in b||'paint'in a||'paint'in b)return false;
  switch(a.op){
    case 'save':case 'restore':return true;
    case 'transform':return b.op==='transform'&&Array.isArray(b.matrix)&&a.matrix.length===b.matrix.length&&a.matrix.every((value,index)=>Object.is(value,b.matrix[index]));
    case 'clip':return b.op==='clip'&&sameBounds(a.rect,b.rect);
    case 'clipRect':return b.op==='clipRect'&&a.clipOp===b.clipOp&&a.doAntiAlias===b.doAntiAlias&&sameBounds(a.rect,b.rect);
    case 'rect':return b.op==='rect'&&a.color===b.color&&sameBounds(a.rect,b.rect);
    case 'rrect':return b.op==='rrect'&&a.color===b.color&&Object.is(a.radius,b.radius)&&sameBounds(a.rect,b.rect);
    default:return false;
  }
}
function captureComposition(body:ContainerLayer,bounds:Rect,commands:readonly PaintCommand[],entries:readonly {readonly mark:number;readonly handle:LayerHandle<Layer>}[]):RetainedComposition|null{
  if(!commands.every(command=>sameCompositionCommand(command,command)))return null;
  const insertions=entries.map(entry=>({mark:entry.mark,layer:entry.handle.layer!,parent:entry.handle.layer!.parent})),retained=new Set(insertions.map(entry=>entry.layer)),structure:CompositionStructure[]=[],pending:Layer[]=[body];
  while(pending.length){const layer=pending.pop()!;if(retained.has(layer))continue;const children=layer instanceof ContainerLayer?layer.children:null;structure.push({layer,parent:layer.parent,children,picture:layer instanceof PictureLayer?layer.picture:null});if(children)for(const child of children)pending.push(child);}
  return {body,bounds:Object.freeze({...bounds}),commands:[...commands],entries:insertions,structure};
}
/** Frame-local primitive recording and render-child paint scope; no GPU ownership. */
export class PaintingContext extends Canvas {
  private readonly entries:Array<{readonly mark:number;readonly handle:LayerHandle<Layer>}>=[];
  private assembled=false;
  private exporting=false;
  readonly estimatedBounds:Rect;
  constructor(recorder:PictureRecorder|null=null,cullRect:Rect|null=null,readonly recordsLayers=false){super(recorder,cullRect);this.estimatedBounds=Object.freeze({...cullRect??{x:0,y:0,width:0,height:0}});}
  protected override record(command:PaintCommand):void{invariant(!this.recordsLayers||!this.assembled||this.exporting,'closed-layer-recording','Layer recording has ended');super.record(command);}
  get canvas():Canvas{return this;}
  paintChild(child:RenderObject,transform:TransformMatrix):void{this.save();try{this.transform(transform);child.paint(this);}finally{this.restore();}}
  /** Consume retained CPU scene snapshots in the current transform/clip scope. */
  addLayer(layer:Layer):void{
    if(this.recordsLayers){invariant(!this.debugDisposed&&!this.assembled,'closed-layer-recording','Layer recording has ended');invariant(!this.entries.some(entry=>entry.handle.layer===layer),'duplicate-paint-layer','A layer can only be appended once in a PaintingContext');this.entries.push({mark:this.commands.length,handle:new LayerHandle(layer)});return;}
    // Immediate drawing still creates retained engine snapshots. Keep transient
    // layers alive until this context retires, including layers without a caller cache.
    invariant(!this.debugDisposed,'closed-layer-recording','Layer recording has ended');
    this.entries.push({mark:this.commands.length,handle:new LayerHandle(layer)});
    const builder=new SceneBuilder();let scene:Scene|undefined;const errors:unknown[]=[];
    try{if(layer instanceof ContainerLayer)scene=layer.buildScene(builder);else{layer.updateSubtreeNeedsAddToScene();layer._addToSceneWithRetainedRendering(builder);layer._fireCompositionCallbacks(false);scene=builder.build();}scene._draw(this);}
    catch(error){errors.push(error);}finally{for(const cleanup of [()=>scene?.dispose(),()=>builder.dispose()])try{cleanup();}catch(error){errors.push(error);}}
    if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Layer paint and retirement failed');
  }
  override rollback(start:number):void{
    invariant(Number.isSafeInteger(start)&&start>=0&&start<=this.commands.length,'invalid-command-mark','Invalid recording rollback');const errors:unknown[]=[];
    try{super.rollback(start);}catch(error){errors.push(error);}const removed=this.entries.filter(entry=>entry.mark>=start);for(let n=this.entries.length-1;n>=0;n--)if(this.entries[n]!.mark>=start)this.entries.splice(n,1);
    for(const entry of removed)try{entry.handle.dispose();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Paint recording rollback failed');
  }
  override dispose():void{const errors:unknown[]=[];try{super.dispose();}catch(error){errors.push(error);}const entries=this.entries.splice(0);for(const entry of entries)try{entry.handle.dispose();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'PaintingContext retirement failed');}
  /** Assemble state scopes and interleaved retained children without flattening those children. */
  private finishLayer(bounds:Rect):ContainerLayer{
    invariant(this.recordsLayers&&!this.assembled&&!this.debugDisposed,'closed-layer-recording','Layer recording has ended');this.assembled=true;
    invariant(this.commands.length<=paintFrameLimits.commands&&this.entries.length<=paintFrameLimits.commands,'oversize','Layer recording budget exceeded');
    const root=new ContainerLayer(),stack:ContainerLayer[]=[];let current=root,pending:PaintCommand[]=[];const at=new Map<number,Layer[]>();
    for(const entry of this.entries){const values=at.get(entry.mark)??[];values.push(entry.handle.layer!);at.set(entry.mark,values);}
    let pendingRecords=0;
    const flush=()=>{if(!pending.length)return;const commands=pending,picture=PaintingContext._recordPicture(context=>context.addCommands(commands),bounds);pending=[];pendingRecords=0;const child=new PictureLayer(bounds);child.picture=picture;try{current.append(child);}catch(error){child.dispose();throw error;}};
    try{
      // A canvas scope only needs scene layers when a retained child is inserted
      // inside it. Keep the other scopes in their picture: splitting every child
      // save/transform/clip compiled hundreds of tiny native pictures per frame.
      const batches=new Map<number,{end:number;records:number;effects:number}>(),scopes:Array<{index:number;insertions:number;records:number;effects:number}>=[],costs=this.commands.map(paintCommandRecordCount);let insertions=0,records=0,effects=0;
      for(let index=0;index<this.commands.length;index++){
        insertions+=at.get(index)?.length??0;const command=this.commands[index]!,before=records,beforeEffects=effects;records+=costs[index]!;
        // Plain state scopes cannot affect pixels without a draw or retained
        // child. Layers/filters and every other operation remain effectful.
        switch(command.op){case 'save':case 'restore':case 'transform':case 'clip':case 'clipRect':case 'clipRRect':case 'clipPath':break;default:effects++;}
        if(command.op==='save'||command.op==='saveLayer'||command.op==='saveBackdropFilter')scopes.push({index,insertions,records:before,effects:beforeEffects});
        else if(command.op==='restore'){const scope=scopes.pop();invariant(scope,'unbalanced-save','restore without save');const size=records-scope.records;if(scope.insertions===insertions&&size<=paintFrameLimits.commands)batches.set(scope.index,{end:index,records:size,effects:effects-scope.effects});}
      }
      invariant(scopes.length===0,'unbalanced-save','unclosed save');
      for(let index=0;index<=this.commands.length;index++){
        const layers=at.get(index);if(layers){flush();for(const layer of layers){layer.remove();if(layer.attached)layer.detach();current.append(layer);}}
        if(index===this.commands.length)break;const command=this.commands[index]!;
        const batch=batches.get(index);if(batch){if(batch.effects>0){if(pendingRecords+batch.records>paintFrameLimits.commands)flush();for(let item=index;item<=batch.end;item++)pending.push(this.commands[item]!);pendingRecords+=batch.records;}index=batch.end;continue;}
        if(command.op==='save'){flush();stack.push(current);}
        else if((command.op==='saveLayer'||command.op==='saveBackdropFilter')){flush();const child=new RecordedCanvasLayer(command);current.append(child);stack.push(current);current=child;}
        else if(command.op==='restore'){flush();invariant(stack.length>0,'unbalanced-save','restore without save');current=stack.pop()!;}
        else if(['transform','clip','clipRect','clipRRect','clipPath'].includes(command.op)){flush();if(current instanceof RecordedCanvasLayer&&!current.hasChildren&&!stack.includes(current))current.appendState(command);else{const child=new RecordedCanvasLayer(command);current.append(child);current=child;}}
        else {if(pendingRecords+costs[index]!>paintFrameLimits.commands)flush();pending.push(command);pendingRecords+=costs[index]!;}
      }
      flush();invariant(stack.length===0,'unbalanced-save','unclosed save');return root;
    }catch(error){try{root.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Layer assembly and rollback failed');}throw error;}
  }
  _recordChildLayer(painter:(context:PaintingContext)=>void,bounds:Rect={x:0,y:0,width:0,height:0}):ContainerLayer{
    const context=new PaintingContext(null,bounds,true),errors:unknown[]=[];let layer:ContainerLayer|undefined;
    try{painter(context);layer=context.finishLayer(bounds);}catch(error){errors.push(error);}try{context.dispose();}catch(error){errors.push(error);}
    if(errors.length){try{layer?.dispose();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];throw new AggregateError(errors,'Child layer painting and rollback failed');}return layer!;
  }
  /** Build one shared root scene, then transfer independent frame command holds to this context. */
  compose(root:ContainerLayer,bounds:Rect,pictures:PictureResourceProvider|null=null):void{
    invariant(this.recordsLayers&&!this.assembled&&!this.debugDisposed,'closed-layer-recording','Layer recording has ended');
    const cached=retainedCompositions.get(root),reuse=cached&&!cached.body.debugDisposed&&root.firstChild===cached.body&&root.lastChild===cached.body&&sameBounds(cached.bounds,bounds)&&cached.commands.length===this.commands.length&&cached.commands.every((command,index)=>sameCompositionCommand(command,this.commands[index]!))&&cached.entries.length===this.entries.length&&cached.entries.every((entry,index)=>entry.mark===this.entries[index]!.mark&&entry.layer===this.entries[index]!.handle.layer&&entry.parent===entry.layer.parent)&&cached.structure.every(entry=>!entry.layer.debugDisposed&&entry.parent===entry.layer.parent&&(entry.children===null||entry.layer instanceof ContainerLayer&&entry.children===entry.layer.children)&&(entry.picture===null||entry.layer instanceof PictureLayer&&entry.picture===entry.layer.picture&&!entry.picture.debugDisposed));
    retainedCompositions.delete(root);
    const commands=reuse?null:[...this.commands],body=reuse?cached.body:this.finishLayer(bounds),errors:unknown[]=[];let appended=!!reuse,next:RetainedComposition|null=null;
    if(reuse)this.assembled=true;
    // The attached body owns its pictures/children before input holds retire.
    // Stream retained recordings directly into the destination frame; it takes
    // independent holds without a transient Scene Picture and its extra capture.
    try{if(!reuse){root.removeAllChildren();root.append(body);appended=true;}next=reuse?cached:captureComposition(body,bounds,commands!,this.entries);this.rollback(0);this.exporting=true;try{root._buildSceneInto(new SceneBuilder(pictures),this);}finally{this.exporting=false;}}catch(error){errors.push(error);}
    if(!appended)try{body.dispose();}catch(error){errors.push(error);}
    if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Root composition and retirement failed');
    if(next)retainedCompositions.set(root,next);
  }
  static _recordPicture(painter:(context:PaintingContext)=>void,bounds:Rect|null=null):Picture{
    const recorder=new PictureRecorder(),context=new PaintingContext(recorder,bounds);let picture:Picture|undefined;const errors:unknown[]=[];
    try{painter(context);picture=recorder.endRecording();}catch(error){errors.push(error);}
    try{context.dispose();}catch(error){errors.push(error);}
    if(errors.length){try{picture?.dispose();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];throw new AggregateError(errors,'Picture painting and rollback failed');}return picture!;
  }
  /** Record the child before replacing old content, so a failed painter preserves it. */
  pushLayer<T extends ContainerLayer>(layer:T,painter:(context:PaintingContext,offset:Offset)=>void,offset:Offset={x:0,y:0},childPaintBounds:Rect={x:0,y:0,width:0,height:0}):T{
    if(this.recordsLayers){const child=this._recordChildLayer(context=>painter(context,offset),childPaintBounds);let appended=false;try{layer.removeAllChildren();layer.append(child);appended=true;this.addLayer(layer);return layer;}finally{if(!appended)child.dispose();}}
    const picture=PaintingContext._recordPicture(context=>painter(context,offset),childPaintBounds);
    const child=new PictureLayer(childPaintBounds);child.picture=picture;let appended=false;
    try{layer.removeAllChildren();layer.append(child);appended=true;this.addLayer(layer);return layer;}
    finally{if(!appended)child.dispose();}
  }
  /** @dartParam alpha int */
  pushOpacity(offset:Offset,alpha:number,painter:(context:PaintingContext,offset:Offset)=>void,oldLayer:OpacityLayer|null=null):OpacityLayer{
    const layer=oldLayer??new OpacityLayer();layer.alpha=alpha;layer.offset=offset;
    try{return this.pushLayer(layer,painter,{x:0,y:0});}catch(error){if(!oldLayer&&layer.debugHandleCount===0)try{layer.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Opacity paint and rollback failed');}throw error;}
  }
  pushTransform(needsCompositing:boolean,offset:Offset,transform:Matrix4,painter:(context:PaintingContext,offset:Offset)=>void,{oldLayer=null}:{readonly oldLayer?:TransformLayer|null}={}):TransformLayer|null{
    const effectiveTransform=Matrix4.translationValues(offset.x,offset.y,0);effectiveTransform.multiply(transform);effectiveTransform.translateByDouble(-offset.x,-offset.y,0,1);
    if(needsCompositing){const layer=oldLayer??new TransformLayer();layer.transform=effectiveTransform.storage;const bounds=this.estimatedBounds;
      try{return this.pushLayer(layer,painter,offset,MatrixUtils.inverseTransformRect(effectiveTransform,SourceRect.fromLTWH(bounds.x,bounds.y,bounds.width,bounds.height)));}catch(error){if(!oldLayer&&layer.debugHandleCount===0)try{layer.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Transform paint and rollback failed');}throw error;}
    }
    this.save();try{this.transform(effectiveTransform.storage);painter(this,offset);}finally{this.restore();}return null;
  }
}
