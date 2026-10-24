// SPDX-License-Identifier: BSD-3-Clause
// Core protocol bindings for the complete pinned renderer; source layout and projection stay generated.
import {RenderBox,RenderObject,BoxParentData,ContainerParentDataMixin} from './object.ts';
import type {HitTestEntry,ShowOnScreenOptions} from './object.ts';
import {RenderAbstractViewport,RevealedOffset} from './viewport.ts';
import {BoxConstraints} from './constraints.ts';
import {LayerHandle,ClipRectLayer,OpacityLayer,TransformLayer} from './layer.ts';
import {PaintingContext} from '../painting/context.ts';
import {MatrixUtils} from '../painting/matrix-utils.ts';
import {Matrix4} from '../../math/matrix4.ts';
import {Offset} from '../../ui/offset.ts';
import {Rect} from '../../ui/rect.ts';
import {Size} from '../../ui/size.ts';
import {Paint} from '../../ui/paint.ts';
import type {Clip} from '../../ui/clip.ts';
import {identity,multiply,translate,contains,inversePaintTransform,transform,captureTransform} from '../../ui/geometry.ts';
import type {TransformMatrix,Offset as Point,Size as GeometrySize} from '../../ui/geometry.ts';
import type {Rect as GeometryRect} from '../../ui/types.ts';
import {PointerEvent} from '../gestures/events.ts';
import {Curves} from '../animation/curves.ts';
import type {Curve} from '../animation/curves.ts';
import {invariant} from '../../foundation/errors.ts';

const point=(p:Point):Offset=>p instanceof Offset?p:new Offset(p.x,p.y);
const rectangle=(r:GeometryRect):Rect=>r instanceof Rect?r:Rect.fromLTWH(r.x,r.y,r.width,r.height);
export type WheelViewportContract=Pick<RenderAbstractViewport<RenderBox>,keyof RenderAbstractViewport<RenderBox>>;
export class WheelContainerParentData<T extends RenderBox> extends ContainerParentDataMixin(BoxParentData) {
  declare previousSibling:T|null;declare nextSibling:T|null;
  override get offset():Offset{return point(super.offset);}
  override set offset(value:Offset){super.offset=value;}
}
export interface WheelShowOptions {readonly descendant?:RenderObject|null;readonly rect?:Rect|null;readonly duration?:number;readonly curve?:Curve}
const layoutWork=new WeakMap<WheelRenderHost,()=>void>();
/** Queued host builders must flush before the source reads viewport geometry. */
export function registerWheelLayoutWork(render:WheelRenderHost,work:()=>void):()=>void{invariant(!layoutWork.has(render),'duplicate-wheel-layout-owner','Wheel already has a layout work owner');layoutWork.set(render,work);return()=>{if(layoutWork.get(render)===work)layoutWork.delete(render);};}
export abstract class WheelRenderHost extends RenderAbstractViewport<RenderBox> {
  constructor(){super({childType:RenderBox});}
  abstract sourcePerformLayout():void;
  abstract sourcePaint(context:PaintingContext,offset:Offset):void;
  abstract sourceHitTestChildren(result:WheelBoxHitTestResult,options:{position:Offset}):boolean;
  abstract sourceShowOnScreen(options?:WheelShowOptions):void;
  abstract get clipBehavior():Clip;
  get isRepaintBoundary():boolean{return false;}
  get needsCompositing():boolean{return this.isRepaintBoundary;}
  get sourceSize():Size{return wheelBoxSize(this);}
  get firstChild():RenderBox|null{return this.children[0]??null;}
  get lastChild():RenderBox|null{return this.children.at(-1)??null;}
  get childCount():number{return this.children.length;}
  childAfter(child:RenderBox):RenderBox|null{invariant(child.parent===this,'invalid-wheel-child','Wheel sibling access requires its actual child');invariant(child.parentData instanceof WheelContainerParentData,'invalid-wheel-parent-data','Wheel sibling access requires its container protocol');return child.parentData.nextSibling;}
  addAll(children:readonly RenderBox[]|null):void{if(children)for(const child of children)this.insert(child,this.lastChild??undefined);}
  sourceInvokeLayout(callback:(constraints:BoxConstraints)=>void):void{this.invokeLayoutCallback(constraints=>{invariant(constraints instanceof BoxConstraints,'invalid-wheel-constraints','Wheel layout requires box constraints');callback(constraints);});}
  protected override performLayout(_constraints:BoxConstraints):GeometrySize{const work=layoutWork.get(this);if(work)this.invokeLayoutCallback(()=>work());this.sourcePerformLayout();return this.size;}
  override dispose():void{layoutWork.delete(this);super.dispose();}
  override paint(context:PaintingContext):void{this.sourcePaint(context,Offset.zero);}
  override get clips():boolean{return this.clipBehavior!=='none';}
  protected override childTransform(child:RenderObject):TransformMatrix{invariant(child instanceof RenderBox&&child.parent===this,'invalid-wheel-child','Wheel transform requires its box child');const matrix=Matrix4.identity();this.applyPaintTransform(child,matrix);return multiply(captureTransform(matrix.storage),child.localTransform);}
  override hitTest(position:Point,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{
    invariant(this.hasSize,'unlaid-wheel','Wheel hit testing requires layout');if(!contains({x:0,y:0,...this.size},position))return false;
    const hit=this.sourceHitTestChildren(new WheelBoxHitTestResult(result,toLocal),{position:point(position)}),self=this.hitTestSelf(position);
    if(self)result.push({target:this,transform:toLocal});return hit||self;
  }
  override showOnScreen(rect:GeometryRect=this.paintBounds,options:ShowOnScreenOptions={}):void{this.sourceShowOnScreen({descendant:options.descendant??null,rect:rectangle(options.targetRect??rect),duration:options.duration??0,curve:options.curve??Curves.ease});}
  sourceForwardShowOnScreen({rect=null,duration=0,curve=Curves.ease}:WheelShowOptions={}):void{super.showOnScreen(rect??this.paintBounds,{duration,curve});}
}
/** Source transform stack over the existing admitted legacy path, including callback metadata. */
export class WheelBoxHitTestResult {
  constructor(readonly path:HitTestEntry[],private current:TransformMatrix=identity){}
  addWithPaintTransform({transform:matrix,position,hitTest}:{transform:Matrix4|null;position:Offset;hitTest:(result:WheelBoxHitTestResult,position:Offset)=>boolean}):boolean {
    if(matrix===null)return hitTest(this,position);const inverse=Matrix4.tryInvert(wheelRemovePerspective(matrix));if(!inverse)return false;
    const previous=this.current;this.current=multiply(captureTransform(inverse.storage),previous);try{return hitTest(this,MatrixUtils.transformPoint(inverse,position));}finally{this.current=previous;}
  }
  hitBox(child:RenderBox,position:Offset):boolean{const inverse=inversePaintTransform(child.localTransform);return inverse!==null&&child.hitTest(transform(inverse,position),this.path,multiply(inverse,this.current));}
}
export function wheelBoxHitTest(child:RenderBox,result:WheelBoxHitTestResult,{position}:{position:Offset}):boolean{return result.hitBox(child,position);}
export function wheelBoxSize(box:RenderBox):Size{const s=box.size;return new Size(s.width,s.height);}
export function wheelConstraintsBiggest(constraints:BoxConstraints):Size{const s=constraints.biggest;return new Size(s.width,s.height);}
export function wheelParentData(object:RenderObject){return object.parentData??null;}
export function wheelParent(object:RenderObject):RenderObject|null{return object.parent??null;}
export function wheelPaintBounds(object:RenderObject):Rect{return rectangle(object.paintBounds);}
export function wheelParentOffset(data:BoxParentData):Offset{return point(data.offset);}
export function wheelGetTransform(object:RenderObject,ancestor:RenderObject|null):Matrix4{return Matrix4.fromList(Array.from(object.getTransformTo(ancestor)));}
export function wheelRemovePerspective(matrix:Matrix4):Matrix4{return Matrix4.fromList(Array.from(PointerEvent.removePerspectiveTransform(captureTransform(matrix.storage))));}
export function wheelOffsetString(value:Offset):string{return value.toString();}
export function createWheelRevealedOffset({offset,rect}:{offset:number;rect:Rect}):RevealedOffset{return new RevealedOffset(offset,rect);}
export function isWheelBox(value:unknown):value is RenderBox{return value instanceof RenderBox;}
export function castWheelBox(value:unknown):RenderBox{invariant(isWheelBox(value),'invalid-wheel-box','Expected actual RenderBox');return value;}
export function isWheelRenderObject(value:unknown):value is RenderObject{return value instanceof RenderObject;}
export function castWheelRenderObject(value:unknown):RenderObject{invariant(isWheelRenderObject(value),'invalid-wheel-object','Expected actual RenderObject');return value;}
export function isWheelConstraints(value:unknown):value is BoxConstraints{return value instanceof BoxConstraints;}
export function castWheelConstraints(value:unknown):BoxConstraints{invariant(isWheelConstraints(value),'invalid-wheel-constraints','Expected actual BoxConstraints');return value;}

class WheelClipHandle extends LayerHandle<ClipRectLayer>{override get layer(){return super.layer;}override set layer(value:ClipRectLayer|null){invariant(value===null||value instanceof ClipRectLayer,'invalid-wheel-clip-handle','Clip handle requires ClipRectLayer');super.layer=value;}}
class WheelOpacityHandle extends LayerHandle<OpacityLayer>{override get layer(){return super.layer;}override set layer(value:OpacityLayer|null){invariant(value===null||value instanceof OpacityLayer,'invalid-wheel-opacity-handle','Opacity handle requires OpacityLayer');super.layer=value;}}
export function createWheelClipHandle():LayerHandle<ClipRectLayer>{return new WheelClipHandle();}
export function createWheelOpacityHandle():LayerHandle<OpacityLayer>{return new WheelOpacityHandle();}
type Painter=(context:PaintingContext,offset:Offset)=>void;
export function wheelPaintChild(context:PaintingContext,child:RenderObject,offset:Offset):void{context.paintChild(child,multiply(translate(offset.dx,offset.dy),child.localTransform));}
export function wheelPushOpacity(context:PaintingContext,offset:Offset,alpha:number,painter:Painter,{oldLayer=null}:{oldLayer?:OpacityLayer|null}={}):OpacityLayer{return context.pushOpacity(offset,alpha,(c,p)=>painter(c,point(p)),oldLayer);}
export function wheelPushClipRect(context:PaintingContext,needsCompositing:boolean,offset:Offset,clipRect:Rect,painter:Painter,{clipBehavior='hardEdge',oldLayer=null}:{clipBehavior?:Clip;oldLayer?:ClipRectLayer|null}={}):ClipRectLayer|null {
  if(clipBehavior==='none'){painter(context,offset);return null;}const bounds=clipRect.shift(offset);
  if(needsCompositing){const layer=oldLayer??new ClipRectLayer();layer.clipRect=bounds;layer.clipBehavior=clipBehavior;try{return context.pushLayer(layer,(c,p)=>painter(c,point(p)),offset,bounds);}catch(error){if(!oldLayer&&layer.debugHandleCount===0&&!layer.parent)layer.dispose();throw error;}}
  context.save();try{context.clipRect(bounds,{doAntiAlias:clipBehavior!=='hardEdge'});if(clipBehavior==='antiAliasWithSaveLayer'){context.saveLayer(bounds,new Paint());try{painter(context,offset);}finally{context.restore();}}else painter(context,offset);}finally{context.restore();}return null;
}
export function wheelPushTransform(context:PaintingContext,needsCompositing:boolean,offset:Offset,matrix:Matrix4,painter:Painter):void {
  const effective=multiply(multiply(translate(offset.dx,offset.dy),captureTransform(matrix.storage)),translate(-offset.dx,-offset.dy));
  if(needsCompositing){const layer=new TransformLayer({transform:effective});try{context.pushLayer(layer,(c,p)=>painter(c,point(p)),offset);}catch(error){if(layer.debugHandleCount===0&&!layer.parent)layer.dispose();throw error;}return;}
  context.save();try{context.transform(effective);painter(context,offset);}finally{context.restore();}
}
