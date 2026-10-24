// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed configuration/controller from the pinned widgets/magnifier.dart.
import {Offset} from '../../ui/offset.ts';import {Rect} from '../../ui/rect.ts';import {protect} from '../../ui/value-math.ts';
import {objectRuntimeType} from '../../foundation/object.ts';import {hashValues} from '../painting/value-equality.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';import {invariant} from '../../foundation/errors.ts';
import type {ValueNotifier} from '../../foundation/notifier.ts';import type {AnimationController} from '../animation/animation-controller.ts';
import {Overlay,OverlayEntry} from './overlay.ts';import type {BuildContext,Widget,WidgetOptions} from './framework.ts';import {InheritedTheme} from './inherited-theme.ts';import {Navigator} from './navigation.ts';
import {StatelessWidget,SingleChildRenderObjectWidget} from './framework.ts';
import {SizedBox} from './basic.ts';
import {Directionality} from './app-data.ts';
import {RenderProxyBox} from '../rendering/boxes.ts';
import type {RenderObject,HitTestEntry} from '../rendering/object.ts';
import type {PathQueryService} from '../../ui/path.ts';
import type {Offset as Point,TransformMatrix} from '../../ui/geometry.ts';
import {identity} from '../../ui/geometry.ts';
import {BackdropFilterLayer,LayerHandle} from '../rendering/layer.ts';
import type {PaintingContext} from '../painting/context.ts';
import {RoundedRectangleBorder} from '../painting/rounded-rectangle-border.ts';
import type {ShapeBorder} from '../painting/borders.ts';
import type {BoxShadow} from '../painting/box-shadow.ts';
import {listEquals,valueEquals} from '../painting/value-equality.ts';
import type {Size} from '../../ui/geometry.ts';
import type {Clip} from '../../ui/clip.ts';
import {ImageFilter} from '../../ui/image-filter.ts';
import {Paint} from '../../ui/paint.ts';

export class MagnifierDecoration {
  readonly opacity:number;readonly shadows:readonly BoxShadow[]|null;readonly shape:ShapeBorder;
  constructor({opacity=1,shadows=null,shape=new RoundedRectangleBorder()}:{readonly opacity?:number;readonly shadows?:readonly BoxShadow[]|null;readonly shape?:ShapeBorder}={}){this.opacity=opacity;this.shadows=shadows===null?null:Object.freeze([...shadows]);this.shape=shape;protect(this,['opacity','shadows','shape']);}
  equals(other:unknown):boolean{return other instanceof MagnifierDecoration&&other.constructor===this.constructor&&other.opacity===this.opacity&&listEquals(other.shadows,this.shadows)&&valueEquals(other.shape,this.shape);}
  get hashCode():number{return hashValues(this.opacity,this.shape,this.shadows);}
}
export interface RawMagnifierOptions extends WidgetOptions {readonly size:Size;readonly child?:Widget;readonly decoration?:MagnifierDecoration;readonly clipBehavior?:Clip;readonly focalPointOffset?:Offset;readonly magnificationScale?:number}
export class RawMagnifier extends StatelessWidget {
  readonly size:Size;readonly child:Widget|undefined;readonly decoration:MagnifierDecoration;readonly clipBehavior:Clip;readonly focalPointOffset:Offset;readonly magnificationScale:number;
  constructor({size,child,decoration=new MagnifierDecoration(),clipBehavior='none',focalPointOffset=Offset.zero,magnificationScale=1,key=null}:RawMagnifierOptions){super(key);invariant(magnificationScale!==0&&Number.isFinite(magnificationScale),'invalid-magnification','Magnification scale must be finite and nonzero');invariant(Number.isFinite(decoration.opacity)&&decoration.opacity>=0&&decoration.opacity<=1,'invalid-opacity','Magnifier opacity must be between zero and one');invariant(['none','hardEdge','antiAlias','antiAliasWithSaveLayer'].includes(clipBehavior),'invalid-clip','Unknown clip behavior');this.size=Object.freeze({width:size.width,height:size.height});this.child=child;this.decoration=decoration;this.clipBehavior=clipBehavior;this.focalPointOffset=focalPointOffset;this.magnificationScale=magnificationScale;}
  build(context:BuildContext):Widget{return new MagnifierRenderWidget(this,context.maybeDependOn(Directionality)?.direction??null);}
}
class MagnifierRenderWidget extends SingleChildRenderObjectWidget {
  constructor(readonly configuration:RawMagnifier,readonly direction:'ltr'|'rtl'|null){super(new SizedBox(configuration.size.width,configuration.size.height,configuration.child));}
  createRenderObject(context:BuildContext):RenderMagnification{return new RenderMagnification(this.configuration,this.direction,context.services.paths);}
  updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderMagnification,'invalid-magnifier-render','Expected magnifier renderer');render.configure(this.configuration,this.direction);}
}
/** Source clip/lens/younger-decoration order, with opacity folded into the backdrop
 * composite instead of an isolated saveLayer that would hide preceding pixels. */
class RenderMagnification extends RenderProxyBox {
  private readonly retained=new LayerHandle<BackdropFilterLayer>();
  constructor(private configuration:RawMagnifier,private direction:'ltr'|'rtl'|null,private readonly paths?:PathQueryService){super();}
  configure(value:RawMagnifier,direction:'ltr'|'rtl'|null):void{this.assertCanMutateLayoutProperty();const semanticsChanged=(Math.round(this.configuration.decoration.opacity*255)===0)!==(Math.round(value.decoration.opacity*255)===0);this.configuration=value;this.direction=direction;this.markNeedsPaint();if(semanticsChanged)this.markNeedsSemanticsUpdate();}
  override paint(context:PaintingContext):void{
    const {magnificationScale:scale,focalPointOffset:focal,decoration,clipBehavior}=this.configuration;
    if(Math.round(decoration.opacity*255)===0){this.retained.dispose();return;}
    const rect=Rect.fromLTWH(0,0,this.size.width,this.size.height),options={textDirection:this.direction},center=rect.center;
    const matrix=[scale,0,0,0,0,scale,0,0,0,0,scale,0,scale*(-focal.dx-center.dx)+center.dx,scale*(-focal.dy-center.dy)+center.dy,0,1];
    const layer=this.retained.layer??new BackdropFilterLayer();this.retained.layer=layer;layer.filter=ImageFilter.matrix(matrix,{filterQuality:'high'});layer._setOpacity(decoration.opacity);
    context.save();try{context.clipPath(decoration.shape.getOuterPath(rect,options));context.pushLayer(layer,childContext=>super.paint(childContext));}finally{context.restore();}
    // Styling is drawn later so neither the outline nor its shadow is magnified.
    const saved=context.getSaveCount();context.save();try{
      if(decoration.opacity!==1)context.saveLayer(null,new Paint({color:(Math.round(decoration.opacity*255)*0x1000000)>>>0}));
      if(clipBehavior!=='none'){context.clipPath(decoration.shape.getInnerPath(rect,options),{clipOp:'difference',doAntiAlias:clipBehavior!=='hardEdge'});if(clipBehavior==='antiAliasWithSaveLayer')context.saveLayer(null,new Paint());}
      for(const shadow of decoration.shadows??[])context.drawPath(decoration.shape.getOuterPath(rect.shift(shadow.offset).inflate(shadow.spreadRadius),options),shadow.toPaint());
      decoration.shape.paint(context,rect,options);
    }finally{context.restoreToCount(saved);}
  }
  override visitChildrenForSemantics(visitor:(child:RenderObject)=>void):void{if(Math.round(this.configuration.decoration.opacity*255)!==0)super.visitChildrenForSemantics(visitor);}
  override hitTest(position:Point,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{if(!this.configuration.child)return false;invariant(this.paths,'missing-path-queries','Magnifier child hit testing requires the host path query service');const path=this.configuration.decoration.shape.getOuterPath(Rect.fromLTWH(0,0,this.size.width,this.size.height),{textDirection:this.direction});return path.contains(position,this.paths)&&super.hitTest(position,result,toLocal);}
  override collectSemantics(...args:Parameters<RenderProxyBox['collectSemantics']>):void{if(Math.round(this.configuration.decoration.opacity*255)!==0)super.collectSemantics(...args);}
  override detach():void{try{super.detach();}finally{if(!this.attached)this.retained.dispose();}}
  override dispose():void{try{super.dispose();}finally{if(this.debugDisposed)this.retained.dispose();}}
}
export interface MagnifierInfoOptions {readonly globalGesturePosition:Offset;readonly caretRect:Rect;readonly fieldBounds:Rect;readonly currentLineBoundaries:Rect}
export class MagnifierInfo {
  readonly globalGesturePosition:Offset;readonly caretRect:Rect;readonly fieldBounds:Rect;readonly currentLineBoundaries:Rect;
  constructor({globalGesturePosition,caretRect,fieldBounds,currentLineBoundaries}:MagnifierInfoOptions){this.globalGesturePosition=globalGesturePosition;this.caretRect=caretRect;this.fieldBounds=fieldBounds;this.currentLineBoundaries=currentLineBoundaries;protect(this,['globalGesturePosition','caretRect','fieldBounds','currentLineBoundaries']);}
  static readonly empty=new MagnifierInfo({globalGesturePosition:Offset.zero,caretRect:Rect.zero,fieldBounds:Rect.zero,currentLineBoundaries:Rect.zero});
  equals(other:unknown):boolean{return other instanceof MagnifierInfo&&other.constructor===this.constructor&&other.globalGesturePosition.equals(this.globalGesturePosition)&&other.caretRect.equals(this.caretRect)&&other.currentLineBoundaries.equals(this.currentLineBoundaries)&&other.fieldBounds.equals(this.fieldBounds);}
  get hashCode():number{return hashValues(this.globalGesturePosition,this.caretRect,this.fieldBounds,this.currentLineBoundaries);}
  toString():string{return `${objectRuntimeType(this,'MagnifierInfo')}(position: ${this.globalGesturePosition}, line: ${this.currentLineBoundaries}, caret: ${this.caretRect}, field: ${this.fieldBounds})`;}
}
export type MagnifierBuilder=(context:BuildContext,controller:MagnifierController,magnifierInfo:ValueNotifier<MagnifierInfo>)=>Widget|null;
export class TextMagnifierConfiguration {
  private readonly builder:MagnifierBuilder|null;readonly shouldDisplayHandlesInMagnifier:boolean;
  constructor({magnifierBuilder=null,shouldDisplayHandlesInMagnifier=true}:{readonly magnifierBuilder?:MagnifierBuilder|null;readonly shouldDisplayHandlesInMagnifier?:boolean}={}){this.builder=magnifierBuilder;this.shouldDisplayHandlesInMagnifier=shouldDisplayHandlesInMagnifier;protect(this,['shouldDisplayHandlesInMagnifier']);}
  get magnifierBuilder():MagnifierBuilder{return this.builder??TextMagnifierConfiguration.none;}
  private static none(_context:BuildContext,_controller:MagnifierController,_info:ValueNotifier<MagnifierInfo>):Widget|null{return null;}
  static readonly disabled=new TextMagnifierConfiguration();
}
export class MagnifierController {
  animationController:AnimationController|null;
  private entry:OverlayEntry|null=null;private operation=0;
  constructor({animationController=null}:{readonly animationController?:AnimationController|null}={}){this.animationController=animationController;if(animationController!==null)animationController.value=0;}
  get overlayEntry():OverlayEntry|null{return this.entry;}
  get shown():boolean{return this.entry!==null&&(this.animationController?.isForwardOrCompleted??true);}
  async show({context,builder,debugRequiredFor:_debugRequiredFor,below=null}:{readonly context:BuildContext;readonly builder:(context:BuildContext)=>Widget;readonly debugRequiredFor?:Widget|null;readonly below?:OverlayEntry|null}):Promise<void>{
    this.removeFromOverlay();const overlay=Overlay.of(context,{rootOverlay:true});let navigator:BuildContext|undefined=context.widget instanceof Navigator?context:undefined;if(navigator===undefined)context.visitAncestorElements(element=>{if(element.widget instanceof Navigator){navigator=element;return false;}return true;});const themes=InheritedTheme.capture(context,navigator),entry=new OverlayEntry({builder:buildContext=>themes.wrap(builder(buildContext))});this.entry=entry;
    try{overlay.insert(entry,{below});}catch(error){this.entry=null;try{this.releaseEntry(entry);}catch(cleanup){throw new AggregateError([error,cleanup],'Magnifier insertion and rollback failed');}throw error;}if(this.animationController!==null)await this.animationController.forward();
  }
  async hide({removeFromOverlay=true}:{readonly removeFromOverlay?:boolean}={}):Promise<void>{const entry=this.entry;if(entry===null)return;const operation=this.operation;if(this.animationController!==null)await this.animationController.reverse();if(removeFromOverlay&&operation===this.operation&&this.entry===entry)this.removeFromOverlay();}
  removeFromOverlay():void{this.operation++;const entry=this.entry;this.entry=null;if(entry!==null)this.releaseEntry(entry);}
  private releaseEntry(entry:OverlayEntry):void{const errors:unknown[]=[];if(entry.overlay!==null)try{entry.remove();}catch(error){errors.push(error);}try{entry.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Magnifier overlay retirement failed');}
  static shiftWithinBounds({rect,bounds}:{readonly rect:Rect;readonly bounds:Rect}):Rect{if(FoundationBuildMode.debug){invariant(rect.width<=bounds.width,'oversize-magnifier-width','Magnifier rect is wider than bounds');invariant(rect.height<=bounds.height,'oversize-magnifier-height','Magnifier rect is taller than bounds');}let shift=Offset.zero;if(rect.left<bounds.left)shift=shift.add(new Offset(bounds.left-rect.left,0));else if(rect.right>bounds.right)shift=shift.add(new Offset(bounds.right-rect.right,0));if(rect.top<bounds.top)shift=shift.add(new Offset(0,bounds.top-rect.top));else if(rect.bottom>bounds.bottom)shift=shift.add(new Offset(0,bounds.bottom-rect.bottom));return rect.shift(shift);}
}
