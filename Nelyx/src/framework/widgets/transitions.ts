// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Transition implementations from widgets/transitions.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import type {Key} from '../../foundation/key.ts';
import type {Listenable} from '../../foundation/notifier.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import {FlagProperty} from '../../foundation/diagnostic-properties.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {protect} from '../../ui/value-math.ts';
import {Offset} from '../../ui/offset.ts';
import {Rect} from '../../ui/rect.ts';
import type {Size} from '../../ui/size.ts';
import type {FilterQuality} from '../../ui/paint-effects-data.ts';
import {Matrix4} from '../../math/matrix4.ts';
import type {Animation} from '../animation/animation.ts';
import {Tween} from '../animation/tween.ts';
import {Axis} from '../painting/basic-types.ts';
import {Alignment,AlignmentDirectional} from '../painting/alignment.ts';
import type {AlignmentGeometry} from '../painting/alignment.ts';
import type {Decoration,DecorationPosition} from '../painting/decoration.ts';
import type {TextStyle} from '../painting/text-style.ts';
import type {TextAlign} from '../../ui/typography.ts';
import type {TextOverflow} from '../painting/text-painter.ts';
import {DefaultTextStyle} from './default-text-style.ts';
import {RelativeRect} from '../rendering/boxes.ts';
import type {RenderObject} from '../rendering/object.ts';
import {RenderAnimatedOpacity} from '../rendering/animated-opacity.ts';
import {RenderSliverAnimatedOpacity} from '../rendering/proxy-sliver.ts';
import {SingleChildRenderObjectWidget} from './framework.ts';
import type {Widget,WidgetOptions,BuildContext} from './framework.ts';
import {AnimatedWidget} from './animated-widget.ts';
import {ListenableBuilder} from './listenable-builder.ts';
import type {TransitionBuilder} from './listenable-builder.ts';
import {Align,Transform,Positioned,DecoratedBox} from './basic.ts';
import {FractionalTranslation} from './fractional-translation.ts';
import {ClipRect} from './clip.ts';

export type DelegatedTransitionBuilder=(context:BuildContext,animation:Animation<number>,secondaryAnimation:Animation<number>,allowSnapshotting:boolean,child:Widget|null)=>Widget|null;
export type TransformCallback=(animationValue:number)=>Matrix4;
export interface SlideTransitionOptions extends WidgetOptions {readonly position:Animation<Offset>;readonly transformHitTests?:boolean;readonly textDirection?:'ltr'|'rtl'|null;readonly child?:Widget|null}
export class SlideTransition extends AnimatedWidget {
  readonly transformHitTests:boolean;readonly textDirection:'ltr'|'rtl'|null;readonly child:Widget|null;
  constructor({key=null,position,transformHitTests=true,textDirection=null,child=null}:SlideTransitionOptions){super({key,listenable:position});this.transformHitTests=transformHitTests;this.textDirection=textDirection;this.child=child;protect(this,['transformHitTests','textDirection','child']);}
  get position():Animation<Offset>{return this.listenable as Animation<Offset>;}
  build(_context:BuildContext):Widget{const position=this.position.value,offset=this.textDirection==='rtl'?new Offset(-position.dx,position.dy):position;return new FractionalTranslation(this.child??undefined,{translation:offset,transformHitTests:this.transformHitTests});}
}
export interface MatrixTransitionOptions extends WidgetOptions {readonly animation:Animation<number>;readonly onTransform:TransformCallback;readonly alignment?:Alignment;readonly filterQuality?:FilterQuality|null;readonly child?:Widget|null}
export class MatrixTransition extends AnimatedWidget {
  readonly onTransform:TransformCallback;readonly alignment:Alignment;readonly filterQuality:FilterQuality|null;readonly child:Widget|null;
  constructor({key=null,animation,onTransform,alignment=Alignment.center,filterQuality=null,child=null}:MatrixTransitionOptions){super({key,listenable:animation});this.onTransform=onTransform;this.alignment=alignment;this.filterQuality=filterQuality;this.child=child;protect(this,['onTransform','alignment','filterQuality','child']);}
  get animation():Animation<number>{return this.listenable as Animation<number>;}
  build(_context:BuildContext):Widget{return new Transform(this.child??undefined,this.onTransform(this.animation.value).storage,null,{alignment:this.alignment,filterQuality:this.animation.isAnimating?this.filterQuality:null});}
}
export interface ScaleTransitionOptions extends Omit<MatrixTransitionOptions,'animation'|'onTransform'> {readonly scale:Animation<number>}
export class ScaleTransition extends MatrixTransition {
  constructor({scale,...options}:ScaleTransitionOptions){super({...options,animation:scale,onTransform:value=>Matrix4.diagonal3Values(value,value,1)});}
  get scale():Animation<number>{return this.animation;}
}
export interface RotationTransitionOptions extends Omit<MatrixTransitionOptions,'animation'|'onTransform'> {readonly turns:Animation<number>}
export class RotationTransition extends MatrixTransition {
  constructor({turns,...options}:RotationTransitionOptions){super({...options,animation:turns,onTransform:value=>Matrix4.rotationZ(value*Math.PI*2)});}
  get turns():Animation<number>{return this.animation;}
}
export interface SizeTransitionOptions extends WidgetOptions {readonly sizeFactor:Animation<number>;readonly axis?:Axis;readonly axisAlignment?:number|null;readonly alignment?:AlignmentGeometry|null;readonly fixedCrossAxisSizeFactor?:number|null;readonly child?:Widget|null}
export class SizeTransition extends AnimatedWidget {
  readonly axis:Axis;readonly axisAlignment:number|null;readonly alignment:AlignmentGeometry|null;readonly fixedCrossAxisSizeFactor:number|null;readonly child:Widget|null;
  constructor({key=null,sizeFactor,axis=Axis.vertical,axisAlignment=null,alignment=null,fixedCrossAxisSizeFactor=null,child=null}:SizeTransitionOptions){
    super({key,listenable:sizeFactor});if(FoundationBuildMode.debug){invariant(fixedCrossAxisSizeFactor===null||fixedCrossAxisSizeFactor>=0,'invalid-cross-axis-size-factor','Cross axis size factor must be nonnegative');invariant(axisAlignment===null||alignment===null,'ambiguous-size-alignment','Cannot provide both axisAlignment and alignment');}
    this.axis=axis;this.axisAlignment=axisAlignment;this.alignment=alignment;this.fixedCrossAxisSizeFactor=fixedCrossAxisSizeFactor;this.child=child;protect(this,['axis','axisAlignment','alignment','fixedCrossAxisSizeFactor','child']);
  }
  get sizeFactor():Animation<number>{return this.listenable as Animation<number>;}
  build(_context:BuildContext):Widget{
    const alignment=this.alignment??(this.axis===Axis.horizontal?new AlignmentDirectional(this.axisAlignment??0,-1):new AlignmentDirectional(-1,this.axisAlignment??0));
    const heightFactor=this.axis===Axis.vertical?Math.max(this.sizeFactor.value,0):this.fixedCrossAxisSizeFactor,widthFactor=this.axis===Axis.horizontal?Math.max(this.sizeFactor.value,0):this.fixedCrossAxisSizeFactor;
    return new ClipRect(new Align(this.child??undefined,{alignment,...(widthFactor===null?{}:{widthFactor}),...(heightFactor===null?{}:{heightFactor})}));
  }
}
export interface FadeTransitionOptions extends WidgetOptions {readonly opacity:Animation<number>;readonly alwaysIncludeSemantics?:boolean;readonly child?:Widget|null}
export class FadeTransition extends SingleChildRenderObjectWidget {
  readonly opacity:Animation<number>;readonly alwaysIncludeSemantics:boolean;
  constructor({key=null,opacity,alwaysIncludeSemantics=false,child=null}:FadeTransitionOptions){super(child??undefined,{key});this.opacity=opacity;this.alwaysIncludeSemantics=alwaysIncludeSemantics;protect(this,['opacity','alwaysIncludeSemantics']);}
  createRenderObject(_context:BuildContext):RenderAnimatedOpacity{return new RenderAnimatedOpacity({opacity:this.opacity,alwaysIncludeSemantics:this.alwaysIncludeSemantics});}
  override updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderAnimatedOpacity,'invalid-fade-render','FadeTransition requires RenderAnimatedOpacity');render.opacity=this.opacity;render.alwaysIncludeSemantics=this.alwaysIncludeSemantics;}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);opacityProperties(this,properties);}
}
export interface SliverFadeTransitionOptions extends Omit<FadeTransitionOptions,'child'> {readonly sliver?:Widget|null}
export class SliverFadeTransition extends SingleChildRenderObjectWidget {
  readonly opacity:Animation<number>;readonly alwaysIncludeSemantics:boolean;
  constructor({key=null,opacity,alwaysIncludeSemantics=false,sliver=null}:SliverFadeTransitionOptions){super(sliver??undefined,{key});this.opacity=opacity;this.alwaysIncludeSemantics=alwaysIncludeSemantics;protect(this,['opacity','alwaysIncludeSemantics']);}
  createRenderObject(_context:BuildContext):RenderSliverAnimatedOpacity{return new RenderSliverAnimatedOpacity({opacity:this.opacity,alwaysIncludeSemantics:this.alwaysIncludeSemantics});}
  override updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderSliverAnimatedOpacity,'invalid-sliver-fade-render','SliverFadeTransition requires RenderSliverAnimatedOpacity');render.opacity=this.opacity;render.alwaysIncludeSemantics=this.alwaysIncludeSemantics;}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);opacityProperties(this,properties);}
}
function opacityProperties(owner:{readonly opacity:Animation<number>;readonly alwaysIncludeSemantics:boolean},properties:DiagnosticPropertiesBuilder):void{properties.add(new DiagnosticsProperty('opacity',owner.opacity));properties.add(new FlagProperty('alwaysIncludeSemantics',owner.alwaysIncludeSemantics,{ifTrue:'alwaysIncludeSemantics'}));}
export class RelativeRectTween extends Tween<RelativeRect> {override lerp(t:number):RelativeRect{return RelativeRect.lerp(this.begin,this.end,t)!;}}
export interface PositionedTransitionOptions extends WidgetOptions {readonly rect:Animation<RelativeRect>;readonly child:Widget}
export class PositionedTransition extends AnimatedWidget {
  readonly child:Widget;
  constructor({key=null,rect,child}:PositionedTransitionOptions){super({key,listenable:rect});this.child=child;protect(this,['child']);}
  get rect():Animation<RelativeRect>{return this.listenable as Animation<RelativeRect>;}
  build(_context:BuildContext):Widget{return Positioned.fromRelativeRect(this.child,this.rect.value);}
}
export interface RelativePositionedTransitionOptions extends WidgetOptions {readonly rect:Animation<Rect|null>;readonly size:Size;readonly child:Widget}
export class RelativePositionedTransition extends AnimatedWidget {
  readonly size:Size;readonly child:Widget;
  constructor({key=null,rect,size,child}:RelativePositionedTransitionOptions){super({key,listenable:rect});this.size=size;this.child=child;protect(this,['size','child']);}
  get rect():Animation<Rect|null>{return this.listenable as Animation<Rect|null>;}
  build(_context:BuildContext):Widget{const offsets=RelativeRect.fromSize(this.rect.value??Rect.zero,this.size);return new Positioned(this.child,{top:offsets.top,right:offsets.right,bottom:offsets.bottom,left:offsets.left});}
}
export interface DecoratedBoxTransitionOptions extends WidgetOptions {readonly decoration:Animation<Decoration>;readonly position?:DecorationPosition;readonly child:Widget}
export class DecoratedBoxTransition extends AnimatedWidget {
  readonly decoration:Animation<Decoration>;readonly position:DecorationPosition;readonly child:Widget;
  constructor({key=null,decoration,position='background',child}:DecoratedBoxTransitionOptions){super({key,listenable:decoration});this.decoration=decoration;this.position=position;this.child=child;protect(this,['decoration','position','child']);}
  build(_context:BuildContext):Widget{return new DecoratedBox(this.child,{decoration:this.decoration.value,position:this.position});}
}
export interface AlignTransitionOptions extends WidgetOptions {readonly alignment:Animation<AlignmentGeometry>;readonly widthFactor?:number|null;readonly heightFactor?:number|null;readonly child:Widget}
export class AlignTransition extends AnimatedWidget {
  readonly widthFactor:number|null;readonly heightFactor:number|null;readonly child:Widget;
  constructor({key=null,alignment,widthFactor=null,heightFactor=null,child}:AlignTransitionOptions){super({key,listenable:alignment});this.widthFactor=widthFactor;this.heightFactor=heightFactor;this.child=child;protect(this,['widthFactor','heightFactor','child']);}
  get alignment():Animation<AlignmentGeometry>{return this.listenable as Animation<AlignmentGeometry>;}
  build(_context:BuildContext):Widget{return new Align(this.child,{alignment:this.alignment.value,...(this.widthFactor===null?{}:{widthFactor:this.widthFactor}),...(this.heightFactor===null?{}:{heightFactor:this.heightFactor})});}
}
export interface AnimatedBuilderOptions {readonly key?:Key|null;readonly animation:Listenable;readonly builder:TransitionBuilder;readonly child?:Widget|null}
export interface DefaultTextStyleTransitionOptions extends WidgetOptions {readonly style:Animation<TextStyle>;readonly child:Widget;readonly textAlign?:TextAlign|null;readonly softWrap?:boolean;readonly overflow?:TextOverflow;readonly maxLines?:number|null}
export class DefaultTextStyleTransition extends AnimatedWidget {
  readonly child:Widget;readonly textAlign:TextAlign|null;readonly softWrap:boolean;readonly overflow:TextOverflow;readonly maxLines:number|null;
  constructor({key=null,style,child,textAlign=null,softWrap=true,overflow='clip',maxLines=null}:DefaultTextStyleTransitionOptions){super({key,listenable:style});this.child=child;this.textAlign=textAlign;this.softWrap=softWrap;this.overflow=overflow;this.maxLines=maxLines;protect(this,['child','textAlign','softWrap','overflow','maxLines']);}
  get style():Animation<TextStyle>{return this.listenable as Animation<TextStyle>;}
  build(_context:BuildContext):Widget{return new DefaultTextStyle(this.style.value,this.child,{textAlign:this.textAlign,softWrap:this.softWrap,overflow:this.overflow,maxLines:this.maxLines});}
}
export class AnimatedBuilder extends ListenableBuilder {
  constructor({animation,...options}:AnimatedBuilderOptions){super({...options,listenable:animation});}
  get animation():Listenable{return this.listenable;}
}
