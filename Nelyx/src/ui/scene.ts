// SPDX-License-Identifier: BSD-3-Clause
// Pinned dart:ui compositing API adapted to owned CPU display lists and the frame renderer.
import {invariant} from '../foundation/errors.ts';
import {Canvas} from './canvas.ts';
import {Picture} from './picture.ts';
import type {PictureRasterizer,PictureResourceProvider} from './picture.ts';
import type {Image} from './image.ts';
import {PictureRecorder} from './picture-recorder.ts';
import type {BlendMode} from './paint.ts';
import {Paint} from './paint.ts';
import type {ColorFilter} from './color-filter.ts';
import type {ImageFilter} from './image-filter.ts';
import type {Rect,PaintCommand} from './types.ts';
import type {Offset} from './geometry.ts';
import type {Clip} from './clip.ts';
import type {RRect} from './rrect.ts';
import type {Path} from './path.ts';
import {paintFrameLimits,validateCapturedPaintCommands,freezePaintCommand} from './frame.ts';
const affineIdentity=[1,0,0,1,0,0],identity44=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const restoreCommands:readonly PaintCommand[]=Object.freeze([freezePaintCommand({op:'restore'})]);
function isIdentity(matrix:readonly number[]|Float64Array):boolean{const identity=matrix.length===6?affineIdentity:matrix.length===16?identity44:null;return identity!==null&&identity.every((value,index)=>matrix[index]===value);}

interface LayerInsertion {readonly mark:number;readonly recording:LayerRecording}
/** Retain child snapshots without copying their display lists into every ancestor. */
class LayerRecording {
  private references=1;
  private readonly needsScope:boolean;
  constructor(private readonly canvas:Canvas,private readonly insertions:readonly LayerInsertion[]){
    canvas.restoreToCount(1);let depth=0,changesState=false;
    for(const command of canvas.commands){if(command.op==='save'||command.op==='saveLayer'||command.op==='saveBackdropFilter')depth++;else if(command.op==='restore')depth--;else if(depth===0&&(command.op==='transform'||command.op==='clip'||command.op==='clipRect'||command.op==='clipRRect'||command.op==='clipPath'))changesState=true;}
    this.needsScope=changesState;
  }
  retain():LayerRecording{invariant(this.references>0,'disposed-engine-recording','Engine recording has retired');this.references++;return this;}
  draw(canvas:Canvas,scoped=true):void{
    invariant(this.references>0,'disposed-engine-recording','Engine recording has retired');const mark=canvas.commands.length;
    const stack=[{recording:this as LayerRecording,start:0,next:0,scoped:scoped&&this.needsScope,entered:false}];
    // These restores close our own saves. Replay them directly so a recorder
    // does not rescan its entire growing command list at every nested pop.
    try{while(stack.length){const frame=stack[stack.length-1]!,record=frame.recording;if(!frame.entered){if(frame.scoped)canvas.save();frame.entered=true;}const entry=record.insertions[frame.next++];if(entry){if(frame.start<entry.mark)canvas._addCommandRange(record.canvas.commands,frame.start,entry.mark);frame.start=entry.mark;stack.push({recording:entry.recording,start:0,next:0,scoped:entry.recording.needsScope,entered:false});}else{if(frame.start<record.canvas.commands.length)canvas._addCommandRange(record.canvas.commands,frame.start,record.canvas.commands.length);if(frame.scoped)canvas.addCommands(restoreCommands);stack.pop();}invariant(canvas.commands.length-mark<=paintFrameLimits.commands,'oversize','Scene command budget exceeded');}}
    catch(error){try{canvas.rollback(mark);}catch(cleanup){throw new AggregateError([error,cleanup],'Engine recording replay and rollback failed');}throw error;}
  }
  dispose():void{const pending:LayerRecording[]=[this],errors:unknown[]=[];while(pending.length){const record=pending.pop()!;if(--record.references>0)continue;try{invariant(record.references===0,'disposed-engine-recording','Engine recording retired twice');record.canvas.dispose();}catch(error){errors.push(error);}for(const entry of record.insertions)pending.push(entry.recording);}if(errors.length)throw new AggregateError(errors,'Engine recording retirement failed');}
}
/** CPU composition snapshot; native Picture leaves remain affine to its explicit app owner. */
export abstract class EngineLayer {
  private pictureOwner:PictureResourceProvider|null=null;
  private recording:LayerRecording|null=null;
  private children:readonly EngineLayer[]=[];
  private dead=false;
  get debugDisposed():boolean{return this.dead;}
  _complete(recording:LayerRecording,children:readonly EngineLayer[],owner:PictureResourceProvider|null=null):void{invariant(!this.dead&&this.recording===null,'invalid-engine-layer','EngineLayer already completed or disposed');this.recording=recording;this.pictureOwner=owner;this.children=Object.freeze([...children]);}
  _compatible(owner:PictureResourceProvider|null):boolean{return this.pictureOwner===owner;}
  _subtree():readonly EngineLayer[]{const result:EngineLayer[]=[],pending:EngineLayer[]=[this];while(pending.length){const layer=pending.pop()!;result.push(layer);for(let index=layer.children.length-1;index>=0;index--)pending.push(layer.children[index]!);}return result;}
  _capture():LayerRecording{invariant(!this.dead&&this.recording!==null,'invalid-engine-layer','EngineLayer is disposed or still being built');return this.recording.retain();}
  _draw(canvas:Canvas):void{const recording=this._capture();try{recording.draw(canvas);}finally{recording.dispose();}}
  dispose():void{if(this.dead)return;this.dead=true;const recording=this.recording;this.recording=null;this.children=[];recording?.dispose();}
}
export class OffsetEngineLayer extends EngineLayer {declare private readonly offsetBrand:never}
export class TransformEngineLayer extends EngineLayer {declare private readonly transformBrand:never}
export class OpacityEngineLayer extends EngineLayer {declare private readonly opacityBrand:never}
export class ClipRectEngineLayer extends EngineLayer {declare private readonly clipRectBrand:never}
export class ClipRRectEngineLayer extends EngineLayer {declare private readonly clipRRectBrand:never}
export class ClipPathEngineLayer extends EngineLayer {declare private readonly clipPathBrand:never}
export class ColorFilterEngineLayer extends EngineLayer {declare private readonly colorFilterBrand:never}
export class ImageFilterEngineLayer extends EngineLayer {declare private readonly imageFilterBrand:never}
export class BackdropFilterEngineLayer extends EngineLayer {declare private readonly backdropFilterBrand:never}
class CanvasStateEngineLayer extends EngineLayer {}

export class Scene {
  private dead=false;
  private constructor(private readonly picture:Picture){}
  static _fromPicture(picture:Picture):Scene{return new Scene(picture);}
  get debugDisposed():boolean{return this.dead;}
  /** The consuming PaintingContext takes independent command/resource holds. */
  _draw(canvas:Canvas):void{invariant(!this.dead,'disposed-scene','Scene has been disposed');this.picture._draw(canvas);}
  toImage(width:number,height:number,rasterizer:PictureRasterizer):Promise<Image>{invariant(!this.dead,'disposed-scene','Scene has been disposed');return this.picture.toImage(width,height,rasterizer);}
  toImageSync(width:number,height:number,rasterizer:PictureRasterizer):Image{invariant(!this.dead,'disposed-scene','Scene has been disposed');return this.picture.toImageSync(width,height,rasterizer);}
  dispose():void{if(this.dead)return;this.dead=true;this.picture.dispose();}
}
interface Recording {readonly canvas:Canvas;readonly layer:EngineLayer|null;readonly children:EngineLayer[];readonly insertions:LayerInsertion[]}
function recording(layer:EngineLayer|null,pictures:PictureResourceProvider|null):Recording{return {canvas:new Canvas(null,null,pictures),layer,children:[],insertions:[]};}
function retireRecording(record:Recording):void{const errors:unknown[]=[];for(const release of [()=>record.canvas.dispose(),...record.insertions.map(entry=>()=>entry.recording.dispose())])try{release();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Unfinished scene recording retirement failed');}
export class SceneBuilder {
  private readonly stack:Recording[];
  constructor(private readonly pictures:PictureResourceProvider|null=null){this.stack=[recording(null,pictures)];}
  _canRetain(layer:EngineLayer):boolean{return layer._compatible(this.pictures);}
  private readonly created:EngineLayer[]=[];
  private readonly used=new Set<EngineLayer>();
  private dead=false;
  private current():Recording{invariant(!this.dead,'closed-scene-builder','SceneBuilder has already ended');return this.stack[this.stack.length-1]!;}
  private push<T extends EngineLayer>(layer:T,begin:(canvas:Canvas)=>void,oldLayer:EngineLayer|null):T{
    this.current();if(oldLayer){invariant(oldLayer.constructor===layer.constructor&&!oldLayer.debugDisposed&&!this.used.has(oldLayer),'invalid-old-layer','Old layer has the wrong type, is disposed or already used in this scene');}
    invariant(this.created.length<paintFrameLimits.commands,'oversize','Scene layer budget exceeded');
    const next=recording(layer,this.pictures);try{begin(next.canvas);}catch(error){next.canvas.dispose();layer.dispose();throw error;}
    if(oldLayer)this.used.add(oldLayer);this.created.push(layer);this.stack.push(next);return layer;
  }
  pushOffset(dx:number,dy:number,options:{readonly oldLayer?:OffsetEngineLayer|null}={}):OffsetEngineLayer{return this.push(new OffsetEngineLayer(),canvas=>{if(dx!==0||dy!==0)canvas.translate(dx,dy);},options.oldLayer??null);}
  pushTransform(matrix:readonly number[]|Float64Array,options:{readonly oldLayer?:TransformEngineLayer|null}={}):TransformEngineLayer{return this.push(new TransformEngineLayer(),canvas=>{if(!isIdentity(matrix))canvas.transform(matrix);},options.oldLayer??null);}
  /** Internal canvas scope, used when a recorded save/clip/effect surrounds real child layers. */
  _pushCommands(commands:readonly PaintCommand[],oldLayer:EngineLayer|null):EngineLayer{return this.push(new CanvasStateEngineLayer(),canvas=>canvas.addCommands(commands.filter(command=>command.op!=='transform'||!isIdentity(command.matrix))),oldLayer);}
  pushOpacity(alpha:number,options:{readonly offset?:Offset;readonly oldLayer?:OpacityEngineLayer|null}={}):OpacityEngineLayer{
    invariant(Number.isInteger(alpha)&&alpha>=0&&alpha<=255,'invalid-opacity','Layer alpha must be uint8');
    return this.push(new OpacityEngineLayer(),canvas=>{const offset=options.offset??{x:0,y:0};canvas.translate(offset.x,offset.y);canvas.saveLayer(null,new Paint({color:(alpha*0x1000000)>>>0}));},options.oldLayer??null);
  }
  private clip<T extends EngineLayer>(layer:T,bounds:Rect|null,behavior:Clip,apply:(canvas:Canvas,antiAlias:boolean)=>void,oldLayer:EngineLayer|null):T{
    invariant(['hardEdge','antiAlias','antiAliasWithSaveLayer'].includes(behavior),'invalid-layer-clip','A clip layer requires an active clip behavior');
    return this.push(layer,canvas=>{apply(canvas,behavior!=='hardEdge');if(behavior==='antiAliasWithSaveLayer')canvas.saveLayer(bounds,new Paint());},oldLayer);
  }
  pushClipRect(rect:Rect,options:{readonly clipBehavior?:Clip;readonly oldLayer?:ClipRectEngineLayer|null}={}):ClipRectEngineLayer{return this.clip(new ClipRectEngineLayer(),rect,options.clipBehavior??'antiAlias', (canvas,antiAlias)=>canvas.clipRect(rect,{doAntiAlias:antiAlias}),options.oldLayer??null);}
  pushClipRRect(rrect:RRect,options:{readonly clipBehavior?:Clip;readonly oldLayer?:ClipRRectEngineLayer|null}={}):ClipRRectEngineLayer{return this.clip(new ClipRRectEngineLayer(),rrect.outerRect,options.clipBehavior??'antiAlias',(canvas,antiAlias)=>canvas.clipRRect(rrect,{doAntiAlias:antiAlias}),options.oldLayer??null);}
  pushClipPath(path:Path,options:{readonly clipBehavior?:Clip;readonly oldLayer?:ClipPathEngineLayer|null}={}):ClipPathEngineLayer{return this.clip(new ClipPathEngineLayer(),null,options.clipBehavior??'antiAlias',(canvas,antiAlias)=>canvas.clipPath(path,{doAntiAlias:antiAlias}),options.oldLayer??null);}
  pushBackdropFilter(filter:ImageFilter|null,options:{readonly blendMode?:BlendMode;readonly oldLayer?:BackdropFilterEngineLayer|null;readonly opacity?:number}={}):BackdropFilterEngineLayer{
    const alpha=options.opacity??1;invariant(Number.isFinite(alpha)&&alpha>=0&&alpha<=1,'invalid-opacity','Backdrop opacity must be between zero and one');
    return this.push(new BackdropFilterEngineLayer(),canvas=>canvas.saveBackdropFilter(new Paint({imageFilter:filter,blendMode:options.blendMode??'srcOver',color:(Math.round(alpha*255)*0x1000000)>>>0})),options.oldLayer??null);
  }
  pushColorFilter(filter:ColorFilter,options:{readonly oldLayer?:ColorFilterEngineLayer|null}={}):ColorFilterEngineLayer{return this.push(new ColorFilterEngineLayer(),canvas=>canvas.saveLayer(null,new Paint({colorFilter:filter})),options.oldLayer??null);}
  pushImageFilter(filter:ImageFilter,options:{readonly offset?:Offset;readonly oldLayer?:ImageFilterEngineLayer|null}={}):ImageFilterEngineLayer{return this.push(new ImageFilterEngineLayer(),canvas=>{const offset=options.offset??{x:0,y:0};canvas.translate(offset.x,offset.y);canvas.saveLayer(null,new Paint({imageFilter:filter}));},options.oldLayer??null);}
  addPicture(offset:Offset,picture:Picture,_hints:{readonly isComplexHint?:boolean;readonly willChangeHint?:boolean}={}):void{
    const canvas=this.current().canvas,mark=canvas.commands.length;
    try{if(offset.x===0&&offset.y===0)canvas.drawPicture(picture);else{canvas.save();canvas.translate(offset.x,offset.y);canvas.drawPicture(picture);canvas.restore();}}catch(error){try{canvas.rollback(mark);}catch(cleanup){throw new AggregateError([error,cleanup],'Scene picture insertion and rollback failed');}throw error;}
  }
  addRetained(layer:EngineLayer):void{const current=this.current(),subtree=layer._subtree();invariant(this._canRetain(layer),'foreign-engine-layer','Retained layer belongs to a different Picture owner');invariant(subtree.every(entry=>!this.used.has(entry)),'duplicate-retained-layer','A retained layer and its descendants can only be used once in a scene');current.insertions.push({mark:current.canvas.commands.length,recording:layer._capture()});for(const entry of subtree)this.used.add(entry);current.children.push(layer);}
  pop():void{
    this.current();if(this.stack.length===1)return;const next=this.stack.pop()!;let snapshot:LayerRecording|undefined,adopted=false;
    try{snapshot=new LayerRecording(next.canvas,next.insertions);next.layer!._complete(snapshot,next.children,this.pictures);snapshot=undefined;adopted=true;const parent=this.current();parent.insertions.push({mark:parent.canvas.commands.length,recording:next.layer!._capture()});parent.children.push(next.layer!);this.used.add(next.layer!);}catch(error){if(snapshot)snapshot.dispose();else if(!adopted)retireRecording(next);throw error;}
  }
  /** Internal frame composition consumes the scene without a temporary Picture/frame capture. */
  _buildInto(canvas:Canvas):void{
    this.current();const mark=canvas.commands.length;
    try{
      while(this.stack.length>1)this.pop();const root=this.stack.pop()!,errors:unknown[]=[];let snapshot:LayerRecording|undefined;
      try{snapshot=new LayerRecording(root.canvas,root.insertions);snapshot.draw(canvas,false);validateCapturedPaintCommands(canvas.commands,mark);}catch(error){errors.push(error);}
      try{if(snapshot)snapshot.dispose();else retireRecording(root);}catch(error){errors.push(error);}
      if(errors.length){try{canvas.rollback(mark);}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];throw new AggregateError(errors,'Scene streaming and retirement failed');}
      this.dead=true;
    }catch(error){try{this.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Scene streaming and rollback failed');}throw error;}
  }
  build():Scene{
    this.current();try{while(this.stack.length>1)this.pop();const root=this.stack.pop()!,recorder=new PictureRecorder(),canvas=new Canvas(recorder),errors:unknown[]=[];let snapshot:LayerRecording|undefined,picture:Picture|undefined;
      try{snapshot=new LayerRecording(root.canvas,root.insertions);snapshot.draw(canvas,false);picture=recorder.endRecording();}catch(error){errors.push(error);}
      for(const release of [()=>canvas.dispose(),()=>snapshot?snapshot.dispose():retireRecording(root)])try{release();}catch(error){errors.push(error);}
      if(errors.length){try{picture?.dispose();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];throw new AggregateError(errors,'Scene assembly and retirement failed');}this.dead=true;return Scene._fromPicture(picture!);
    }catch(error){try{this.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Scene build and rollback failed');}throw error;}
  }
  /** Cancel an unfinished build. A completed Scene owns its own snapshot. */
  dispose():void{if(this.dead)return;this.dead=true;const errors:unknown[]=[];for(const entry of this.stack)try{retireRecording(entry);}catch(error){errors.push(error);}for(const layer of this.created)try{layer.dispose();}catch(error){errors.push(error);}this.stack.length=0;if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Scene cancellation failed');}
}
