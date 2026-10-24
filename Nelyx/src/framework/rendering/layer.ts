// SPDX-License-Identifier: BSD-3-Clause
// Adapted from pinned Flutter rendering/layer.dart. CPU retained scenes feed the frame renderer.
import {invariant} from '../../foundation/errors.ts';
import {SceneBuilder} from '../../ui/scene.ts';
import type {EngineLayer,Scene,OffsetEngineLayer,TransformEngineLayer,OpacityEngineLayer,ClipRectEngineLayer,ClipRRectEngineLayer,ClipPathEngineLayer,ColorFilterEngineLayer,ImageFilterEngineLayer,BackdropFilterEngineLayer} from '../../ui/scene.ts';
import {Picture} from '../../ui/picture.ts';
import type {PictureRasterizer} from '../../ui/picture.ts';
import type {Image} from '../../ui/image.ts';
import type {Rect} from '../../ui/types.ts';
import type {Offset,Size} from '../../ui/geometry.ts';
import type {Clip} from '../../ui/clip.ts';
import {RRect} from '../../ui/rrect.ts';
import {Path} from '../../ui/path.ts';
import type {PathQueryService} from '../../ui/path.ts';
import {contains,transform as transformPoint} from '../../ui/geometry.ts';
import {ColorFilter} from '../../ui/color-filter.ts';
import {blendModes} from '../../ui/paint.ts';
import type {BlendMode} from '../../ui/paint.ts';
import {ImageFilter} from '../../ui/image-filter.ts';
import {matrix4Identity,captureMatrix4,multiplyMatrix4,inverseMatrix4} from '../../ui/matrix4.ts';
import type {Matrix4Storage} from '../../ui/matrix4.ts';
import type {Canvas} from '../../ui/canvas.ts';

function failures(errors:unknown[],message:string):void{if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,message);}
function attempt(errors:unknown[],action:()=>void):void{try{action();}catch(error){errors.push(error);}}
function offset(value:Offset):Offset{invariant(value&&[value.x,value.y].every(Number.isFinite),'invalid-layer-offset','Layer offset must be finite');return Object.freeze({x:value.x,y:value.y});}
function rect(value:Rect):Rect{invariant(value,'invalid-layer-rect','Invalid layer rectangle');const {x,y,width,height}=value;invariant([x,y,width,height].every(Number.isFinite)&&width>=0&&height>=0,'invalid-layer-rect','Invalid layer rectangle');return Object.freeze({x,y,width,height});}
function clip(value:Clip):Clip{invariant(['hardEdge','antiAlias','antiAliasWithSaveLayer'].includes(value),'invalid-layer-clip','Clip layers require active clipping');return value;}
function translation(value:Offset):Matrix4Storage{return captureMatrix4([1,0,0,0,0,1,0,0,0,0,1,0,value.x,value.y,0,1]);}
let compositionLock=0;
const emptyLayerChildren:readonly Layer[]=Object.freeze([]);
const emptyCompositionCallbacks:readonly (readonly [Layer,(layer:Layer)=>void])[]=Object.freeze([]);
/** Exact generic type identity replaces Dart's reified T == S comparison. */
export class AnnotationType<T extends {}> {
  // Protected typed witness preserves invariance in emitted .d.ts (private types are elided).
  protected readonly valueType:(value:T)=>T=value=>value;
  constructor(readonly debugLabel='annotation'){invariant(typeof debugLabel==='string','invalid-annotation-type','Annotation label must be a string');Object.freeze(this);}
}
export interface AnnotationQueryOptions {readonly paths?:PathQueryService}
export class AnnotationEntry<T extends {}> {
  readonly annotation:T;readonly localPosition:Offset;
  constructor(options:{readonly annotation:T;readonly localPosition:Offset}){invariant(options.annotation!==null&&options.annotation!==undefined,'invalid-annotation','Annotation value cannot be null');this.annotation=options.annotation;this.localPosition=offset(options.localPosition);Object.freeze(this);}
  toString():string{return `AnnotationEntry(annotation: ${String(this.annotation)}, localPosition: ${this.localPosition.x}, ${this.localPosition.y})`;}
}
export class AnnotationResult<T extends {}> {
  private readonly values:AnnotationEntry<T>[]=[];
  constructor(readonly type:AnnotationType<T>,readonly options:AnnotationQueryOptions={}){invariant(type instanceof AnnotationType,'invalid-annotation-type','Expected an AnnotationType');this.options=Object.freeze({...options});}
  add(entry:AnnotationEntry<T>):void{invariant(entry instanceof AnnotationEntry,'invalid-annotation-entry','Expected AnnotationEntry');this.values.push(entry);}
  get entries():readonly AnnotationEntry<T>[]{return Object.freeze([...this.values]);}
  get annotations():readonly T[]{return Object.freeze(this.values.map(entry=>entry.annotation));}
  get isEmpty():boolean{return this.values.length===0;}
}
export abstract class Layer {
  private dead=false;
  private references=0;
  private currentOwner:object|null=null;
  private retained:EngineLayer|null=null;
  private dirty=true;
  private readonly callbacks=new Map<symbol,(layer:Layer)=>void>();
  private compositionCallbackCount=0;
  // Internal links are changed only by ContainerLayer, after validation.
  _parent:ContainerLayer|null=null;
  _previous:Layer|null=null;
  _next:Layer|null=null;
  _depth=0;
  get parent():ContainerLayer|null{return this._parent;}
  get previousSibling():Layer|null{return this._previous;}
  get nextSibling():Layer|null{return this._next;}
  get owner():object|null{return this.currentOwner;}
  get attached():boolean{return this.currentOwner!==null;}
  get depth():number{return this._depth;}
  get debugDisposed():boolean{return this.dead;}
  get debugHandleCount():number{return this.references;}
  get debugNeedsAddToScene():boolean{return this.dirty;}
  get debugSubtreeNeedsAddToScene():boolean{return this.dirty;}
  get alwaysNeedsAddToScene():boolean{return false;}
  get engineLayer():EngineLayer|null{return this.retained;}
  protected set engineLayer(value:EngineLayer|null){this.assertMutable();if(value===this.retained)return;const old=this.retained;this.retained=value;this.parent?.markNeedsAddToScene();old?.dispose();}
  protected assertMutable():void{invariant(!this.dead,'disposed-layer','Layer has been disposed');invariant(compositionLock===0,'locked-layer','Layers cannot be mutated by composition callbacks');}
  _retain():void{this.assertMutable();this.references++;}
  _release():void{this.assertMutable();invariant(this.references>0,'unowned-layer','Layer has no handle to release');if(--this.references===0)this.dispose();}
  markNeedsAddToScene():void{this.assertMutable();if(this.dirty)return;this.dirty=true;this.parent?.markNeedsAddToScene();}
  updateSubtreeNeedsAddToScene():void{this.assertMutable();if(this.alwaysNeedsAddToScene)this.markNeedsAddToScene();}
  attach(owner:object):void{this.assertMutable();invariant(!this.attached&&owner!==null,'attached-layer','Layer is already attached');this.currentOwner=owner;}
  protected detachSelf():void{this.assertMutable();invariant(this.attached,'detached-layer','Layer is not attached');this.currentOwner=null;}
  detach():void{this.detachSelf();this._fireCompositionCallbacks(false);}
  remove():void{this.assertMutable();this.parent?._removeChild(this);}
  supportsRasterization():boolean{return true;}
  describeClipBounds():Rect|null{return null;}
  find<T extends {}>(type:AnnotationType<T>,localPosition:Offset,options:AnnotationQueryOptions={}):T|null{const result=new AnnotationResult(type,options);this.findAnnotations(result,localPosition,{onlyFirst:true});return result.entries[0]?.annotation??null;}
  findAllAnnotations<T extends {}>(type:AnnotationType<T>,localPosition:Offset,options:AnnotationQueryOptions={}):AnnotationResult<T>{const result=new AnnotationResult(type,options);this.findAnnotations(result,localPosition,{onlyFirst:false});return result;}
  findAnnotations<T extends {}>(result:AnnotationResult<T>,localPosition:Offset,options:{readonly onlyFirst:boolean}):boolean{invariant(!this.dead,'disposed-layer','Layer has been disposed');invariant(result instanceof AnnotationResult&&typeof options.onlyFirst==='boolean','invalid-annotation-query','Invalid annotation search');offset(localPosition);return false;}
  get subtreeHasCompositionCallbacks():boolean{return this.compositionCallbackCount>0;}
  private changeCompositionCallbackCount(delta:number):void{for(let layer:Layer|null=this;layer;layer=layer.parent)layer.compositionCallbackCount+=delta;}
  protected changeChildCompositionCallbacks(child:Layer,sign:1|-1):void{this.changeCompositionCallbackCount(sign*child.compositionCallbackCount);}
  addCompositionCallback(callback:(layer:Layer)=>void):()=>void{
    invariant(!this.dead,'disposed-layer','Layer has been disposed');const id=Symbol();this.callbacks.set(id,callback);this.changeCompositionCallbackCount(1);let active=true;
    return ()=>{if(!active)return;active=false;if(this.callbacks.delete(id))this.changeCompositionCallbackCount(-1);};
  }
  _callbackSnapshot(includeChildren:boolean):readonly (readonly [Layer,(layer:Layer)=>void])[]{
    if(includeChildren?this.compositionCallbackCount===0:this.callbacks.size===0)return emptyCompositionCallbacks;
    const entries:Array<readonly [Layer,(layer:Layer)=>void]>=[];
    const collect=(layer:Layer):void=>{for(const callback of layer.callbacks.values())entries.push([layer,callback]);if(includeChildren&&layer instanceof ContainerLayer)for(let child=layer.firstChild;child;child=child.nextSibling)if(child.compositionCallbackCount)collect(child);};collect(this);return entries;
  }
  _fireCompositionCallbacks(includeChildren:boolean):void{const entries=this._callbackSnapshot(includeChildren);if(!entries.length)return;const errors:unknown[]=[];compositionLock++;try{for(const [layer,callback] of entries)attempt(errors,()=>callback(layer));}finally{compositionLock--;}failures(errors,'Layer composition callbacks failed');}
  _addToSceneWithRetainedRendering(builder:SceneBuilder):void{
    this.assertMutable();if(this.retained?.debugDisposed){this.engineLayer=null;this.dirty=true;}if(this.retained&&!builder._canRetain(this.retained))this.dirty=true;if(!this.dirty&&!this.alwaysNeedsAddToScene&&this.retained){builder.addRetained(this.retained);return;}
    this.addToScene(builder);this.dirty=false;
  }
  abstract addToScene(builder:SceneBuilder):void;
  dispose():void{
    this.assertMutable();invariant(this.references===0&&this.parent===null,'owned-layer','Release LayerHandles and remove the layer before disposal');
    this.dead=true;this.currentOwner=null;this.changeCompositionCallbackCount(-this.callbacks.size);this.callbacks.clear();const retained=this.retained;this.retained=null;retained?.dispose();
  }
}
export class LayerHandle<T extends Layer> {
  private value:T|null=null;
  constructor(layer:T|null=null){this.layer=layer;}
  get layer():T|null{return this.value;}
  set layer(value:T|null){if(value===this.value)return;invariant(compositionLock===0,'locked-layer','Layer handles cannot be changed by composition callbacks');value?._retain();const old=this.value;this.value=value;old?._release();}
  dispose():void{this.layer=null;}
  toString():string{return `LayerHandle(${this.value?.constructor.name??'DISPOSED'})`;}
}
export class PictureLayer extends Layer {
  readonly canvasBounds:Rect;
  private value:Picture|null=null;
  private complex=false;
  private changing=false;
  constructor(canvasBounds:Rect){super();this.canvasBounds=rect(canvasBounds);}
  get picture():Picture|null{return this.value;}
  set picture(value:Picture|null){this.assertMutable();invariant(value===null||value instanceof Picture&&!value.debugDisposed,'invalid-layer-picture','PictureLayer requires a live Picture');if(value===this.value)return;const old=this.value;this.value=value;this.markNeedsAddToScene();old?.dispose();}
  get isComplexHint():boolean{return this.complex;}
  set isComplexHint(value:boolean){this.assertMutable();if(value!==this.complex){this.complex=value;this.markNeedsAddToScene();}}
  get willChangeHint():boolean{return this.changing;}
  set willChangeHint(value:boolean){this.assertMutable();if(value!==this.changing){this.changing=value;this.markNeedsAddToScene();}}
  addToScene(builder:SceneBuilder):void{this.assertMutable();invariant(this.value!==null,'empty-picture-layer','PictureLayer has no picture');builder.addPicture({x:0,y:0},this.value,{isComplexHint:this.complex,willChangeHint:this.changing});}
  override dispose():void{this.assertMutable();invariant(this.debugHandleCount===0&&this.parent===null,'owned-layer','Release layer handles before disposal');const picture=this.value;this.value=null;const errors:unknown[]=[];attempt(errors,()=>super.dispose());attempt(errors,()=>picture?.dispose());failures(errors,'PictureLayer retirement failed');}
}
export class ContainerLayer extends Layer {
  private first:Layer|null=null;
  private last:Layer|null=null;
  private childSnapshot:readonly Layer[]|null=emptyLayerChildren;
  get firstChild():Layer|null{return this.first;}
  get lastChild():Layer|null{return this.last;}
  get hasChildren():boolean{return this.first!==null;}
  get children():readonly Layer[]{if(this.childSnapshot)return this.childSnapshot;const values:Layer[]=[];for(let child=this.first;child;child=child.nextSibling)values.push(child);return this.childSnapshot=Object.freeze(values);}
  append(child:Layer):void{
    this.assertMutable();invariant(!child.debugDisposed&&!child.parent&&!child.attached&&!child.nextSibling&&!child.previousSibling,'owned-child-layer','Only a live detached root layer can be appended');
    for(let node:Layer|null=this;node;node=node.parent)invariant(node!==child,'layer-cycle','Layer append would create a cycle');
    child._retain();child._parent=this;child._previous=this.last;if(this.last)this.last._next=child;else this.first=child;this.last=child;
    this.childSnapshot=null;this.changeChildCompositionCallbacks(child,1);
    this.redepthChild(child);this.markNeedsAddToScene();if(this.owner)child.attach(this.owner);
  }
  redepthChild(child:Layer):void{this.assertMutable();invariant(child.parent===this,'foreign-child-layer','Layer is not a child');child._depth=this.depth+1;if(child instanceof ContainerLayer)for(const descendant of child.children)child.redepthChild(descendant);}
  _removeChild(child:Layer):void{
    this.assertMutable();invariant(child.parent===this,'foreign-child-layer','Layer is not a child');
    const errors:unknown[]=[];if(child.previousSibling)child.previousSibling._next=child.nextSibling;else this.first=child.nextSibling;
    if(child.nextSibling)child.nextSibling._previous=child.previousSibling;else this.last=child.previousSibling;
    this.childSnapshot=this.first?null:emptyLayerChildren;
    // Detach observers can still inspect the old parent chain.
    if(child.attached)attempt(errors,()=>child.detach());this.changeChildCompositionCallbacks(child,-1);child._parent=null;child._previous=null;child._next=null;
    this.markNeedsAddToScene();attempt(errors,()=>child._release());failures(errors,'Child layer removal failed');
  }
  removeAllChildren():void{this.assertMutable();const errors:unknown[]=[];for(const child of this.children)attempt(errors,()=>this._removeChild(child));failures(errors,'Layer children retirement failed');}
  override attach(owner:object):void{super.attach(owner);const errors:unknown[]=[];for(const child of this.children)attempt(errors,()=>child.attach(owner));failures(errors,'Layer subtree attach failed');}
  override detach():void{this.detachSelf();const errors:unknown[]=[];for(const child of this.children)attempt(errors,()=>child.detach());attempt(errors,()=>this._fireCompositionCallbacks(false));failures(errors,'Layer subtree detach failed');}
  override supportsRasterization():boolean{return this.children.every(child=>child.supportsRasterization());}
  override findAnnotations<T extends {}>(result:AnnotationResult<T>,localPosition:Offset,options:{readonly onlyFirst:boolean}):boolean{super.findAnnotations(result,localPosition,options);return this.findChildrenAnnotations(result,localPosition,options);}
  protected findChildrenAnnotations<T extends {}>(result:AnnotationResult<T>,localPosition:Offset,options:{readonly onlyFirst:boolean}):boolean{for(let child=this.lastChild;child;child=child.previousSibling){const absorbed=child.findAnnotations(result,localPosition,options);if(absorbed||options.onlyFirst&&!result.isEmpty)return absorbed;}return false;}
  override updateSubtreeNeedsAddToScene():void{super.updateSubtreeNeedsAddToScene();for(const child of this.children){child.updateSubtreeNeedsAddToScene();if(child.debugNeedsAddToScene)this.markNeedsAddToScene();}}
  addChildrenToScene(builder:SceneBuilder):void{for(const child of this.children)child._addToSceneWithRetainedRendering(builder);}
  addToScene(builder:SceneBuilder):void{this.assertMutable();this.addChildrenToScene(builder);}
  private finishScene<Result>(builder:SceneBuilder,finish:()=>Result):Result{
    this.assertMutable();try{if(this instanceof LeaderLayer)this.link._checkLeaders();for(const node of this.depthFirstIterateChildren())if(node instanceof LeaderLayer)node.link._checkLeaders();this.updateSubtreeNeedsAddToScene();this._addToSceneWithRetainedRendering(builder);this._fireCompositionCallbacks(true);return finish();}
    catch(error){try{builder.dispose();this.markNeedsAddToScene();}catch(cleanup){throw new AggregateError([error,cleanup],'Layer scene build and rollback failed');}throw error;}
  }
  buildScene(builder:SceneBuilder=new SceneBuilder()):Scene{return this.finishScene(builder,()=>builder.build());}
  /** Internal frame target takes independent command/resource holds during the same composition. */
  _buildSceneInto(builder:SceneBuilder,canvas:Canvas):void{this.finishScene(builder,()=>builder._buildInto(canvas));}
  /** Returns the composed transform; immutable matrix storage replaces Dart's output argument. */
  applyTransform(child:Layer|null,transform:Matrix4Storage=matrix4Identity):Matrix4Storage{invariant(child===null||child.parent===this,'foreign-child-layer','Layer is not a child');return transform;}
  depthFirstIterateChildren():readonly Layer[]{const result:Layer[]=[];let node:Layer|null=this.first;while(node){result.push(node);if(node instanceof ContainerLayer&&node.firstChild){node=node.firstChild;continue;}while(node.parent!==this&&!node.nextSibling)node=node.parent!;node=node.nextSibling;}return Object.freeze(result);}
  override dispose():void{this.assertMutable();invariant(this.debugHandleCount===0&&this.parent===null,'owned-layer','Release layer handles before disposal');const errors:unknown[]=[];attempt(errors,()=>this.removeAllChildren());attempt(errors,()=>super.dispose());failures(errors,'ContainerLayer retirement failed');}
}
export class OffsetLayer extends ContainerLayer {
  private position:Offset;
  constructor(options:{readonly offset?:Offset}={}){super();this.position=offset(options.offset??{x:0,y:0});}
  get offset():Offset{return this.position;}
  set offset(value:Offset){this.assertMutable();const next=offset(value);if(next.x===this.position.x&&next.y===this.position.y)return;this.position=next;this.markNeedsAddToScene();}
  override findAnnotations<T extends {}>(result:AnnotationResult<T>,localPosition:Offset,options:{readonly onlyFirst:boolean}):boolean{return super.findAnnotations(result,{x:localPosition.x-this.position.x,y:localPosition.y-this.position.y},options);}
  override applyTransform(child:Layer|null,transform:Matrix4Storage=matrix4Identity):Matrix4Storage{return multiplyMatrix4(super.applyTransform(child,transform),translation(this.position));}
  override addToScene(builder:SceneBuilder):void{this.engineLayer=builder.pushOffset(this.position.x,this.position.y,{oldLayer:this.engineLayer as OffsetEngineLayer|null});this.addChildrenToScene(builder);builder.pop();}
  private createSceneForImage(bounds:Rect,pixelRatio:number):Scene{this.assertMutable();rect(bounds);invariant(Number.isFinite(pixelRatio)&&pixelRatio>0,'invalid-pixel-ratio','Capture pixelRatio must be finite and positive');const builder=new SceneBuilder();try{builder.pushTransform([pixelRatio,0,0,0,0,pixelRatio,0,0,0,0,1,0,-pixelRatio*(bounds.x+this.offset.x),-pixelRatio*(bounds.y+this.offset.y),0,1]);return this.buildScene(builder);}catch(error){try{builder.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'Capture scene and rollback failed');}throw error;}}
  async toImage(bounds:Rect,{pixelRatio=1,rasterizer}:{readonly pixelRatio?:number;readonly rasterizer:PictureRasterizer}):Promise<Image>{const scene=this.createSceneForImage(bounds,pixelRatio);try{return await scene.toImage(Math.ceil(bounds.width*pixelRatio),Math.ceil(bounds.height*pixelRatio),rasterizer);}finally{scene.dispose();}}
  toImageSync(bounds:Rect,{pixelRatio=1,rasterizer}:{readonly pixelRatio?:number;readonly rasterizer:PictureRasterizer}):Image{const scene=this.createSceneForImage(bounds,pixelRatio);try{return scene.toImageSync(Math.ceil(bounds.width*pixelRatio),Math.ceil(bounds.height*pixelRatio),rasterizer);}finally{scene.dispose();}}
}
export class TransformLayer extends OffsetLayer {
  private matrix:Matrix4Storage;
  constructor(options:{readonly transform?:readonly number[]|Float64Array;readonly offset?:Offset}={}){super(options);this.matrix=captureMatrix4(options.transform??matrix4Identity);}
  get transform():Matrix4Storage{return this.matrix;}
  set transform(value:readonly number[]|Float64Array){this.assertMutable();const next=captureMatrix4(value);if(next.every((v,i)=>v===this.matrix[i]))return;this.matrix=next;this.markNeedsAddToScene();}
  override findAnnotations<T extends {}>(result:AnnotationResult<T>,localPosition:Offset,options:{readonly onlyFirst:boolean}):boolean{const inverse=inverseMatrix4(multiplyMatrix4(translation(this.offset),this.matrix));if(!inverse)return false;const point=transformPoint(inverse,localPosition);if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;return this.findChildrenAnnotations(result,point,options);}
  override applyTransform(child:Layer|null,transform:Matrix4Storage=matrix4Identity):Matrix4Storage{return multiplyMatrix4(super.applyTransform(child,transform),this.matrix);}
  override addToScene(builder:SceneBuilder):void{this.engineLayer=builder.pushTransform(multiplyMatrix4(translation(this.offset),this.matrix),{oldLayer:this.engineLayer as TransformEngineLayer|null});this.addChildrenToScene(builder);builder.pop();}
}
export class OpacityLayer extends OffsetLayer {
  private value:number;
  constructor(options:{readonly alpha?:number;readonly offset?:Offset}={}){super(options);this.value=this.capture(options.alpha??255);}
  private capture(value:number):number{invariant(Number.isInteger(value)&&value>=0&&value<=255,'invalid-layer-opacity','Layer alpha must be uint8');return value;}
  get alpha():number{return this.value;}
  set alpha(value:number){this.assertMutable();const next=this.capture(value);if(next!==this.value){this.value=next;this.markNeedsAddToScene();}}
  override addToScene(builder:SceneBuilder):void{this.engineLayer=builder.pushOpacity(this.value,{offset:this.offset,oldLayer:this.engineLayer as OpacityEngineLayer|null});this.addChildrenToScene(builder);builder.pop();}
}
abstract class ClipLayer extends ContainerLayer {
  private behavior:Clip;
  constructor(behavior:Clip){super();this.behavior=clip(behavior);}
  get clipBehavior():Clip{return this.behavior;}
  set clipBehavior(value:Clip){this.assertMutable();const next=clip(value);if(next!==this.behavior){this.behavior=next;this.markNeedsAddToScene();}}
}
export class ClipRectLayer extends ClipLayer {
  private value:Rect|null;
  constructor(options:{readonly clipRect?:Rect|null;readonly clipBehavior?:Clip}={}){super(options.clipBehavior??'antiAlias');this.value=options.clipRect?rect(options.clipRect):null;}
  get clipRect():Rect|null{return this.value;}
  set clipRect(value:Rect|null){this.assertMutable();this.value=value?rect(value):null;this.markNeedsAddToScene();}
  override describeClipBounds():Rect|null{return this.value;}
  override findAnnotations<T extends {}>(result:AnnotationResult<T>,localPosition:Offset,options:{readonly onlyFirst:boolean}):boolean{invariant(this.value!==null,'empty-layer-clip','ClipRectLayer requires bounds');return contains(this.value,localPosition)?super.findAnnotations(result,localPosition,options):false;}
  override addToScene(builder:SceneBuilder):void{invariant(this.value!==null,'empty-layer-clip','ClipRectLayer requires bounds');this.engineLayer=builder.pushClipRect(this.value,{clipBehavior:this.clipBehavior,oldLayer:this.engineLayer as ClipRectEngineLayer|null});this.addChildrenToScene(builder);builder.pop();}
}
export class ClipRRectLayer extends ClipLayer {
  private value:RRect|null;
  constructor(options:{readonly clipRRect?:RRect|null;readonly clipBehavior?:Clip}={}){super(options.clipBehavior??'antiAlias');this.value=options.clipRRect??null;}
  get clipRRect():RRect|null{return this.value;}
  set clipRRect(value:RRect|null){this.assertMutable();invariant(value===null||value instanceof RRect,'invalid-layer-rrect','Expected RRect');this.value=value;this.markNeedsAddToScene();}
  override describeClipBounds():Rect|null{return this.value?.outerRect??null;}
  override findAnnotations<T extends {}>(result:AnnotationResult<T>,localPosition:Offset,options:{readonly onlyFirst:boolean}):boolean{invariant(this.value!==null,'empty-layer-clip','ClipRRectLayer requires bounds');return this.value.contains(localPosition)?super.findAnnotations(result,localPosition,options):false;}
  override addToScene(builder:SceneBuilder):void{invariant(this.value!==null,'empty-layer-clip','ClipRRectLayer requires bounds');this.engineLayer=builder.pushClipRRect(this.value,{clipBehavior:this.clipBehavior,oldLayer:this.engineLayer as ClipRRectEngineLayer|null});this.addChildrenToScene(builder);builder.pop();}
}
export class ClipPathLayer extends ClipLayer {
  private value:Path|null;
  constructor(options:{readonly clipPath?:Path|null;readonly clipBehavior?:Clip}={}){super(options.clipBehavior??'antiAlias');this.value=options.clipPath??null;}
  get clipPath():Path|null{return this.value;}
  set clipPath(value:Path|null){this.assertMutable();invariant(value===null||value instanceof Path,'invalid-layer-path','Expected Path');this.value=value;this.markNeedsAddToScene();}
  override findAnnotations<T extends {}>(result:AnnotationResult<T>,localPosition:Offset,options:{readonly onlyFirst:boolean}):boolean{invariant(this.value!==null,'empty-layer-clip','ClipPathLayer requires a path');invariant(result.options.paths,'missing-path-queries','ClipPath annotation search requires an engine geometry service');return this.value.contains(localPosition,result.options.paths)?super.findAnnotations(result,localPosition,options):false;}
  override addToScene(builder:SceneBuilder):void{invariant(this.value!==null,'empty-layer-clip','ClipPathLayer requires a path');this.engineLayer=builder.pushClipPath(this.value,{clipBehavior:this.clipBehavior,oldLayer:this.engineLayer as ClipPathEngineLayer|null});this.addChildrenToScene(builder);builder.pop();}
}
export class ColorFilterLayer extends ContainerLayer {
  private value:ColorFilter;
  constructor(options:{readonly colorFilter:ColorFilter}){super();invariant(options.colorFilter instanceof ColorFilter,'invalid-layer-filter','Expected ColorFilter');this.value=options.colorFilter;}
  get colorFilter():ColorFilter{return this.value;}
  set colorFilter(value:ColorFilter){this.assertMutable();invariant(value instanceof ColorFilter,'invalid-layer-filter','Expected ColorFilter');if(value!==this.value){this.value=value;this.markNeedsAddToScene();}}
  override addToScene(builder:SceneBuilder):void{this.engineLayer=builder.pushColorFilter(this.value,{oldLayer:this.engineLayer as ColorFilterEngineLayer|null});this.addChildrenToScene(builder);builder.pop();}
}
/** A retained instruction; backdrop pixels are evaluated anew for each scene/View. */
export class BackdropFilterLayer extends ContainerLayer {
  private filterValue:ImageFilter|null;private mode:BlendMode;private alpha=1;
  constructor({filter=null,blendMode='srcOver'}:{readonly filter?:ImageFilter|null;readonly blendMode?:BlendMode}={}){super();this.filterValue=filter;this.mode=blendMode;invariant(filter===null||filter instanceof ImageFilter,'invalid-layer-filter','Expected ImageFilter');invariant(blendModes.includes(blendMode),'invalid-blend-mode','Unknown blend mode');}
  get filter():ImageFilter|null{return this.filterValue;}
  set filter(value:ImageFilter|null){this.assertMutable();invariant(value===null||value instanceof ImageFilter,'invalid-layer-filter','Expected ImageFilter');if(value!==this.filterValue){this.filterValue=value;this.markNeedsAddToScene();}}
  get blendMode():BlendMode{return this.mode;}
  set blendMode(value:BlendMode){this.assertMutable();invariant(blendModes.includes(value),'invalid-blend-mode','Unknown blend mode');if(value!==this.mode){this.mode=value;this.markNeedsAddToScene();}}
  /** Fold RawMagnifier's source Opacity into composition to preserve the parent backdrop. */
  _setOpacity(value:number):void{this.assertMutable();invariant(Number.isFinite(value)&&value>=0&&value<=1,'invalid-opacity','Invalid backdrop opacity');if(value!==this.alpha){this.alpha=value;this.markNeedsAddToScene();}}
  override addToScene(builder:SceneBuilder):void{invariant(this.filterValue!==null,'missing-backdrop-filter','BackdropFilterLayer requires a filter before composition');this.engineLayer=builder.pushBackdropFilter(this.filterValue,{blendMode:this.mode,opacity:this.alpha,oldLayer:this.engineLayer as BackdropFilterEngineLayer|null});this.addChildrenToScene(builder);builder.pop();}
}
export class ImageFilterLayer extends OffsetLayer {
  private value:ImageFilter;
  constructor(options:{readonly imageFilter:ImageFilter;readonly offset?:Offset}){super(options);invariant(options.imageFilter instanceof ImageFilter,'invalid-layer-filter','Expected ImageFilter');this.value=options.imageFilter;}
  get imageFilter():ImageFilter{return this.value;}
  set imageFilter(value:ImageFilter){this.assertMutable();invariant(value instanceof ImageFilter,'invalid-layer-filter','Expected ImageFilter');if(value!==this.value){this.value=value;this.markNeedsAddToScene();}}
  override addToScene(builder:SceneBuilder):void{this.engineLayer=builder.pushImageFilter(this.value,{offset:this.offset,oldLayer:this.engineLayer as ImageFilterEngineLayer|null});this.addChildrenToScene(builder);builder.pop();}
}
export class LayerLink {
  private current:LeaderLayer|null=null;
  private readonly previous=new Set<LeaderLayer>();
  private size:Size|null=null;
  get leader():LeaderLayer|null{return this.current;}
  get leaderSize():Size|null{return this.size;}
  set leaderSize(value:Size|null){invariant(value===null||[value.width,value.height].every(v=>Number.isFinite(v)&&v>=0),'invalid-leader-size','Leader size must be finite and nonnegative');this.size=value===null?null:Object.freeze({width:value.width,height:value.height});}
  _registerLeader(leader:LeaderLayer):void{invariant(this.current!==leader,'duplicate-leader','Leader is already registered');if(this.current)this.previous.add(this.current);this.current=leader;}
  _unregisterLeader(leader:LeaderLayer):void{if(this.current===leader)this.current=null;else this.previous.delete(leader);}
  _checkLeaders():void{invariant(this.previous.size===0,'multiple-leaders','A LayerLink cannot have multiple attached leaders at composition');}
  toString():string{return `LayerLink(${this.current?'<linked>':'<dangling>'})`;}
}
export class LeaderLayer extends ContainerLayer {
  private connection:LayerLink;
  private position:Offset;
  constructor(options:{readonly link:LayerLink;readonly offset?:Offset}){super();invariant(options.link instanceof LayerLink,'invalid-layer-link','Expected LayerLink');this.connection=options.link;this.position=offset(options.offset??{x:0,y:0});}
  get link():LayerLink{return this.connection;}
  set link(value:LayerLink){this.assertMutable();invariant(value instanceof LayerLink,'invalid-layer-link','Expected LayerLink');if(value===this.connection)return;if(this.attached){this.connection._unregisterLeader(this);value._registerLeader(this);}this.connection=value;this.markNeedsAddToScene();}
  get offset():Offset{return this.position;}
  set offset(value:Offset){this.assertMutable();const next=offset(value);if(next.x===this.position.x&&next.y===this.position.y)return;this.position=next;this.markNeedsAddToScene();}
  override findAnnotations<T extends {}>(result:AnnotationResult<T>,localPosition:Offset,options:{readonly onlyFirst:boolean}):boolean{return super.findAnnotations(result,{x:localPosition.x-this.position.x,y:localPosition.y-this.position.y},options);}
  override attach(owner:object):void{const wasAttached=this.attached;try{super.attach(owner);}finally{if(!wasAttached&&this.attached)this.connection._registerLeader(this);}}
  override detach():void{this.assertMutable();invariant(this.attached,'detached-layer','Layer is not attached');this.connection._unregisterLeader(this);super.detach();}
  override addToScene(builder:SceneBuilder):void{this.engineLayer=builder.pushTransform(translation(this.position),{oldLayer:this.engineLayer as TransformEngineLayer|null});this.addChildrenToScene(builder);builder.pop();}
  override applyTransform(child:Layer|null,transform:Matrix4Storage=matrix4Identity):Matrix4Storage{return multiplyMatrix4(super.applyTransform(child,transform),translation(this.position));}
  override dispose():void{this.assertMutable();invariant(this.debugHandleCount===0&&this.parent===null,'owned-layer','Release layer handles before disposal');if(this.attached)this.connection._unregisterLeader(this);super.dispose();}
}
export interface FollowerLayerOptions {readonly link:LayerLink;readonly showWhenUnlinked?:boolean;readonly unlinkedOffset?:Offset;readonly linkedOffset?:Offset}
export class FollowerLayer extends ContainerLayer {
  private connection:LayerLink;
  private showing:boolean;
  private unlinked:Offset;
  private linked:Offset;
  private lastTransform:Matrix4Storage|null=null;
  private lastOffset:Offset|null=null;
  constructor(options:FollowerLayerOptions){super();invariant(options.link instanceof LayerLink,'invalid-layer-link','Expected LayerLink');invariant(options.showWhenUnlinked===undefined||typeof options.showWhenUnlinked==='boolean','invalid-layer-visibility','Expected boolean visibility');this.connection=options.link;this.showing=options.showWhenUnlinked??true;this.unlinked=offset(options.unlinkedOffset??{x:0,y:0});this.linked=offset(options.linkedOffset??{x:0,y:0});}
  get link():LayerLink{return this.connection;}
  set link(value:LayerLink){this.assertMutable();invariant(value instanceof LayerLink,'invalid-layer-link','Expected LayerLink');this.connection=value;this.markNeedsAddToScene();}
  get showWhenUnlinked():boolean{return this.showing;}
  set showWhenUnlinked(value:boolean){this.assertMutable();invariant(typeof value==='boolean','invalid-layer-visibility','Expected boolean visibility');this.showing=value;this.markNeedsAddToScene();}
  get unlinkedOffset():Offset{return this.unlinked;}
  set unlinkedOffset(value:Offset){this.assertMutable();this.unlinked=offset(value);this.markNeedsAddToScene();}
  get linkedOffset():Offset{return this.linked;}
  set linkedOffset(value:Offset){this.assertMutable();this.linked=offset(value);this.markNeedsAddToScene();}
  override get alwaysNeedsAddToScene():boolean{return true;}
  getLastTransform():Matrix4Storage|null{return this.lastTransform&&this.lastOffset?multiplyMatrix4(translation({x:-this.lastOffset.x,y:-this.lastOffset.y}),this.lastTransform):null;}
  override findAnnotations<T extends {}>(result:AnnotationResult<T>,localPosition:Offset,options:{readonly onlyFirst:boolean}):boolean{
    if(!this.connection.leader)return this.showing?super.findAnnotations(result,{x:localPosition.x-this.unlinked.x,y:localPosition.y-this.unlinked.y},options):false;
    const matrix=this.getLastTransform(),inverse=matrix&&inverseMatrix4(matrix);if(!inverse)return false;
    // Preserve the pinned follower annotation calculation (unprojected XY, then linkedOffset).
    return super.findAnnotations(result,{x:inverse[0]*localPosition.x+inverse[4]*localPosition.y+inverse[12]-this.linked.x,y:inverse[1]*localPosition.x+inverse[5]*localPosition.y+inverse[13]-this.linked.y},options);
  }
  private establishTransform():void{
    this.lastTransform=null;const leader=this.connection.leader;if(!leader)return;this.connection._checkLeaders();invariant(leader.owner===this.owner,'unrelated-layer-owners','Linked leader and follower must have the same owner');
    const forward:ContainerLayer[]=[leader],backward:ContainerLayer[]=[this];let a:ContainerLayer|null=leader,b:ContainerLayer|null=this;
    while(a!==b){invariant(a!==null&&b!==null,'unrelated-layer-trees','Leader and follower must share a common ancestor');if(a.depth>=b.depth){a=a.parent;if(a)forward.push(a);}else{b=b.parent;if(b)backward.push(b);}}
    invariant(a!==null,'unrelated-layer-trees','Leader and follower must share a common ancestor');let before=false;
    if(forward.length===1)before=true;else if(backward.length>1){let sibling:Layer|null=forward[forward.length-2]!;while(sibling){if(sibling===backward[backward.length-2]){before=true;break;}sibling=sibling.nextSibling;}}
    invariant(before,'follower-before-leader','Leader must precede follower in paint order');
    const collect=(chain:readonly ContainerLayer[])=>{let matrix=matrix4Identity;for(let n=chain.length-1;n>0;n--)matrix=chain[n]!.applyTransform(chain[n-1]!,matrix);return matrix;};
    const destination=leader.applyTransform(null,collect(forward)),inverse=inverseMatrix4(collect(backward));if(!inverse)return;
    this.lastTransform=multiplyMatrix4(inverse,multiplyMatrix4(destination,translation(this.linked)));
  }
  override addToScene(builder:SceneBuilder):void{
    if(!this.connection.leader&&!this.showing){this.lastTransform=null;this.lastOffset=null;this.engineLayer=null;return;}
    this.establishTransform();this.lastOffset=this.lastTransform?this.unlinked:null;
    this.engineLayer=builder.pushTransform(this.lastTransform??translation(this.unlinked),{oldLayer:this.engineLayer as TransformEngineLayer|null});this.addChildrenToScene(builder);builder.pop();
  }
  override applyTransform(child:Layer|null,transform:Matrix4Storage=matrix4Identity):Matrix4Storage{return multiplyMatrix4(super.applyTransform(child,transform),this.lastTransform??translation(this.unlinked));}
}
export class AnnotatedRegionLayer<T extends {}> extends ContainerLayer {
  readonly value:T;readonly annotationType:AnnotationType<T>;readonly size:Size|null;readonly offset:Offset;readonly opaque:boolean;
  constructor(value:T,options:{readonly annotationType:AnnotationType<T>;readonly size?:Size|null;readonly offset?:Offset;readonly opaque?:boolean}){super();invariant(value!==null&&value!==undefined,'invalid-annotation','Annotation value cannot be null');invariant(options.annotationType instanceof AnnotationType,'invalid-annotation-type','Expected AnnotationType');invariant(options.opaque===undefined||typeof options.opaque==='boolean','invalid-annotation-opacity','Expected boolean opacity');this.value=value;this.annotationType=options.annotationType;const size=options.size??null;invariant(size===null||[size.width,size.height].every(v=>Number.isFinite(v)&&v>=0),'invalid-annotation-size','Annotation size must be finite and nonnegative');this.size=size&&Object.freeze({width:size.width,height:size.height});this.offset=offset(options.offset??{x:0,y:0});this.opaque=options.opaque??false;}
  override findAnnotations<S extends {}>(result:AnnotationResult<S>,localPosition:Offset,options:{readonly onlyFirst:boolean}):boolean{let absorbed=super.findAnnotations(result,localPosition,options);if(options.onlyFirst&&!result.isEmpty)return absorbed;if(this.size&&!contains({x:this.offset.x,y:this.offset.y,...this.size},localPosition))return absorbed;if((this.annotationType as object)===(result.type as object)){absorbed=absorbed||this.opaque;result.add(new AnnotationEntry({annotation:this.value as unknown as S,localPosition:{x:localPosition.x-this.offset.x,y:localPosition.y-this.offset.y}}));}return absorbed;}
}
