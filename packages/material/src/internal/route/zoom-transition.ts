// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {StatelessWidget,StatefulWidget,State} from '@nelyx/core/framework/widgets/framework';
import type {Widget,BuildContext} from '@nelyx/core/framework/widgets/framework';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {invariant} from '@nelyx/core/foundation/errors';
import type {Animation} from '@nelyx/core/framework/animation/animation';
import {AnimationStatus} from '@nelyx/core/framework/animation/animation';
import {ReverseAnimation,kAlwaysCompleteAnimation} from '@nelyx/core/framework/animation/animations';
import {Tween,CurveTween} from '@nelyx/core/framework/animation/tween';
import {TweenSequence} from '@nelyx/core/framework/animation/tween-sequence';
import {TweenSequenceItem} from '@nelyx/core/framework/animation/tween-sequence-item';
import {Cubic,Interval} from '@nelyx/core/framework/animation/curves';
import {DualTransitionBuilder} from '@nelyx/core/framework/widgets/dual-transition-builder';
import {SnapshotWidget,SnapshotController,SnapshotMode,SnapshotPainter} from '@nelyx/core/framework/widgets/snapshot-widget';
import type {SnapshotChildPainter} from '@nelyx/core/framework/widgets/snapshot-widget';
import {AnimatedBuilder,FadeTransition,ScaleTransition} from '@nelyx/core/framework/widgets/transitions';
import {ColoredBox} from '@nelyx/core/framework/widgets/basic';
import type {PaintingContext} from '@nelyx/core/framework/painting/context';
import {LayerHandle} from '@nelyx/core/framework/rendering/layer';
import type {TransformLayer,OpacityLayer} from '@nelyx/core/framework/rendering/layer';
import {Matrix4} from '@nelyx/core/math/matrix4';
import {Color} from '@nelyx/core/ui/color';
import {Offset} from '@nelyx/core/ui/offset';
import type {Size} from '@nelyx/core/ui/size';
import type {Image} from '@nelyx/core/ui/image';
import {Paint} from '@nelyx/core/ui/paint';
import {materialTransitionThemeOf} from '../theme/transition-theme-context.ts';
import {Colors} from '../../colors.ts';

/** @dartType List<TweenSequenceItem<double>> */
const fastOutExtraSlowInTweenSequenceItems=[new TweenSequenceItem<number>({tween:new Tween<number>({begin:0,end:.4}).chain(new CurveTween({curve:new Cubic(.05,0,.133333,.06)})),weight:.166666}),new TweenSequenceItem<number>({tween:new Tween<number>({begin:.4,end:1}).chain(new CurveTween({curve:new Cubic(.208333,.82,.25,1)})),weight:1-.166666})];
/** @dartType TweenSequence<double> */
const scaleCurveSequence=new TweenSequence<number>(fastOutExtraSlowInTweenSequenceItems);
/** @dartType Animatable<double> */
const enterFadeIn=new Tween<number>({begin:0,end:1}).chain(new CurveTween({curve:new Interval(.125,.25)}));
/** @dartType Animatable<double> */
const enterScaleDown=new Tween<number>({begin:1.1,end:1}).chain(scaleCurveSequence);
/** @dartType Animatable<double> */
const enterScaleUp=new Tween<number>({begin:.85,end:1}).chain(scaleCurveSequence);
/** @dartType Animatable<double?> */
const scrimOpacityTween=new Tween<number|null>({begin:0,end:.6}).chain(new CurveTween({curve:new Interval(.2075,.4175)}));
/** @dartType Animatable<double> */
const exitFadeOut=new Tween<number>({begin:1,end:0}).chain(new CurveTween({curve:new Interval(.0825,.2075)}));
/** @dartType Animatable<double> */
const exitScaleUp=new Tween<number>({begin:1,end:1.05}).chain(scaleCurveSequence);
/** @dartType Animatable<double> */
const exitScaleDown=new Tween<number>({begin:1,end:.9}).chain(scaleCurveSequence);

/** @dartParam scale double
 * @dartParam opacity double
 * @dartParam pixelRatio double */
function drawImageScaledAndCentered(context:PaintingContext,image:Image,scale:number,opacity:number,pixelRatio:number):void{
    if(scale<=0||opacity<=0)return;const paint=new Paint();paint.filterQuality='medium';paint.color=Color.fromRGBO(0,0,0,opacity).toARGB32();
    /** @dartType double */const logicalWidth=image.width/pixelRatio;
    /** @dartType double */const logicalHeight=image.height/pixelRatio;
    /** @dartType double */const scaledLogicalWidth=logicalWidth*scale;
    /** @dartType double */const scaledLogicalHeight=logicalHeight*scale;
    /** @dartType double */const left=(logicalWidth-scaledLogicalWidth)/2;
    /** @dartType double */const top=(logicalHeight-scaledLogicalHeight)/2;
    context.canvas.drawImageRect(image,{x:0,y:0,width:image.width,height:image.height},{x:left,y:top,width:scaledLogicalWidth,height:scaledLogicalHeight},paint);
}
/** @dartParam scale double */
function updateScaledTransform(transform:Matrix4,scale:number,size:Size):void{transform.setIdentity();if(scale===1)return;transform.scaleByDouble(scale,scale,scale,1);
    /** @dartType double */const dx=((size.width*scale)-size.width)/2;
    /** @dartType double */const dy=((size.height*scale)-size.height)/2;
    transform.translateByDouble(-dx,-dy,0,1);
}

class ZoomEnterTransition extends StatefulWidget {
    /** @dartType Animation<double> */readonly animation:Animation<number>;
    /** @dartParam animation Animation<double> */
    constructor(animation:Animation<number>,readonly reverse:boolean,readonly allowSnapshotting:boolean,readonly backgroundColor:Color,readonly child:Widget|null){super();this.animation=animation;}
    createState():State{return new ZoomEnterTransitionState();}
}
class ZoomExitTransition extends StatefulWidget {
    /** @dartType Animation<double> */readonly animation:Animation<number>;
    /** @dartParam animation Animation<double> */
    constructor(animation:Animation<number>,readonly reverse:boolean,readonly allowSnapshotting:boolean,readonly child:Widget|null){super();this.animation=animation;}
    createState():State{return new ZoomExitTransitionState();}
}
abstract class ZoomTransitionState<W extends ZoomEnterTransition|ZoomExitTransition> extends State<W> {
    readonly controller=new SnapshotController();
    /** @dartType Animation<double> */protected fadeTransition!:Animation<number>;
    /** @dartType Animation<double> */protected scaleTransition!:Animation<number>;
    protected delegate!:SnapshotPainter;
    protected get useSnapshot():boolean{return FoundationPlatform.hostEnvironment.kind!=='web'&&this.widget.allowSnapshotting;}
    private readonly valueChanged=()=>{this.controller.allowSnapshotting=this.scaleTransition.value===1&&(this.fadeTransition.value===0||this.fadeTransition.value===1)?false:this.useSnapshot;};
    private readonly statusChanged=(status:AnimationStatus)=>{this.controller.allowSnapshotting=status.isAnimating&&this.useSnapshot;};
    protected abstract updateAnimations():void;
    protected abstract createDelegate():SnapshotPainter;
    private listen(animation:Animation<number>):void{animation.addListener(this.valueChanged);animation.addStatusListener(this.statusChanged);}
    private unlisten(animation:Animation<number>):void{animation.removeListener(this.valueChanged);animation.removeStatusListener(this.statusChanged);}
    override initState():void{this.updateAnimations();this.listen(this.widget.animation);this.delegate=this.createDelegate();super.initState();}
    override didUpdateWidget(old:W):void{if(old.reverse!==this.widget.reverse||old.animation!==this.widget.animation){this.unlisten(old.animation);this.updateAnimations();this.listen(this.widget.animation);this.delegate.dispose();this.delegate=this.createDelegate();}super.didUpdateWidget(old);}
    override dispose():void{this.unlisten(this.widget.animation);this.delegate.dispose();this.controller.dispose();super.dispose();}
    build():Widget{return new SnapshotWidget({painter:this.delegate,controller:this.controller,mode:SnapshotMode.permissive,autoresize:true,child:this.widget.child});}
}
class ZoomEnterTransitionState extends ZoomTransitionState<ZoomEnterTransition> {
    protected updateAnimations():void{this.fadeTransition=this.widget.reverse?kAlwaysCompleteAnimation:enterFadeIn.animate(this.widget.animation);this.scaleTransition=(this.widget.reverse?enterScaleDown:enterScaleUp).animate(this.widget.animation);}
    protected createDelegate():SnapshotPainter{return new ZoomEnterTransitionPainter(this.widget.reverse,this.scaleTransition,this.fadeTransition,this.widget.animation,this.widget.backgroundColor);}
}
class ZoomExitTransitionState extends ZoomTransitionState<ZoomExitTransition> {
    protected updateAnimations():void{this.fadeTransition=this.widget.reverse?exitFadeOut.animate(this.widget.animation):kAlwaysCompleteAnimation;this.scaleTransition=(this.widget.reverse?exitScaleDown:exitScaleUp).animate(this.widget.animation);}
    protected createDelegate():SnapshotPainter{return new ZoomExitTransitionPainter(this.widget.reverse,this.scaleTransition,this.fadeTransition,this.widget.animation);}
}
class ZoomEnterTransitionPainter extends SnapshotPainter {
    /** @dartType Animation<double> */readonly animation:Animation<number>;
    /** @dartType Animation<double> */readonly scale:Animation<number>;
    /** @dartType Animation<double> */readonly fade:Animation<number>;
    private readonly transformValue=Matrix4.zero();private readonly opacityHandle=new LayerHandle<OpacityLayer>();private readonly transformHandle=new LayerHandle<TransformLayer>();
    private readonly notify=()=>this.notifyListeners();private readonly statusChanged=(_status:AnimationStatus)=>this.notifyListeners();
    /** @dartParam scale Animation<double>
     * @dartParam fade Animation<double>
     * @dartParam animation Animation<double> */
    constructor(readonly reverse:boolean,scale:Animation<number>,fade:Animation<number>,animation:Animation<number>,readonly backgroundColor:Color){super();this.scale=scale;this.fade=fade;this.animation=animation;animation.addListener(this.notify);animation.addStatusListener(this.statusChanged);scale.addListener(this.notify);fade.addListener(this.notify);}
    private drawScrim(context:PaintingContext,offset:Offset,size:Size):void{
        /** @dartType double */let scrimOpacity=0;if(!this.reverse&&!this.animation.isCompleted)scrimOpacity=scrimOpacityTween.evaluate(this.animation)!;if(scrimOpacity>0){const paint=new Paint();paint.color=this.backgroundColor.withOpacity(scrimOpacity).toARGB32();context.canvas.drawRect({x:offset.dx,y:offset.dy,width:size.width,height:size.height},paint);}
    }
    paint(context:PaintingContext,offset:Offset,size:Size,painter:SnapshotChildPainter):void{if(!this.animation.isAnimating){painter(context,offset);return;}this.drawScrim(context,offset,size);updateScaledTransform(this.transformValue,this.scale.value,size);this.transformHandle.layer=context.pushTransform(true,offset,this.transformValue,(context,offset)=>{this.opacityHandle.layer=context.pushOpacity(offset,Math.round(this.fade.value*255),(context,point)=>painter(context,new Offset(point.x,point.y)),this.opacityHandle.layer);},{oldLayer:this.transformHandle.layer});}
    /** @dartParam pixelRatio double */
    paintSnapshot(context:PaintingContext,offset:Offset,size:Size,image:Image,_sourceSize:Size,pixelRatio:number):void{this.drawScrim(context,offset,size);drawImageScaledAndCentered(context,image,this.scale.value,this.fade.value,pixelRatio);}
    shouldRepaint(old:SnapshotPainter):boolean{invariant(old instanceof ZoomEnterTransitionPainter,'invalid-zoom-enter-painter','Expected the same Zoom enter painter type');return old.reverse!==this.reverse||old.animation.value!==this.animation.value||old.scale.value!==this.scale.value||old.fade.value!==this.fade.value;}
    override dispose():void{this.animation.removeListener(this.notify);this.animation.removeStatusListener(this.statusChanged);this.scale.removeListener(this.notify);this.fade.removeListener(this.notify);this.opacityHandle.dispose();this.transformHandle.dispose();super.dispose();}
}
class ZoomExitTransitionPainter extends SnapshotPainter {
    /** @dartType Animation<double> */readonly scale:Animation<number>;
    /** @dartType Animation<double> */readonly fade:Animation<number>;
    /** @dartType Animation<double> */readonly animation:Animation<number>;
    private readonly transformValue=Matrix4.zero();private readonly opacityHandle=new LayerHandle<OpacityLayer>();private readonly transformHandle=new LayerHandle<TransformLayer>();
    private readonly notify=()=>this.notifyListeners();private readonly statusChanged=(_status:AnimationStatus)=>this.notifyListeners();
    /** @dartParam scale Animation<double>
     * @dartParam fade Animation<double>
     * @dartParam animation Animation<double> */
    constructor(readonly reverse:boolean,scale:Animation<number>,fade:Animation<number>,animation:Animation<number>){super();this.scale=scale;this.fade=fade;this.animation=animation;scale.addListener(this.notify);fade.addListener(this.notify);animation.addStatusListener(this.statusChanged);}
    /** @dartParam pixelRatio double */
    paintSnapshot(context:PaintingContext,_offset:Offset,_size:Size,image:Image,_sourceSize:Size,pixelRatio:number):void{drawImageScaledAndCentered(context,image,this.scale.value,this.fade.value,pixelRatio);}
    paint(context:PaintingContext,offset:Offset,size:Size,painter:SnapshotChildPainter):void{if(!this.animation.isAnimating){painter(context,offset);return;}updateScaledTransform(this.transformValue,this.scale.value,size);this.transformHandle.layer=context.pushTransform(true,offset,this.transformValue,(context,offset)=>{this.opacityHandle.layer=context.pushOpacity(offset,Math.round(this.fade.value*255),(context,point)=>painter(context,new Offset(point.x,point.y)),this.opacityHandle.layer);},{oldLayer:this.transformHandle.layer});}
    shouldRepaint(old:SnapshotPainter):boolean{invariant(old instanceof ZoomExitTransitionPainter,'invalid-zoom-exit-painter','Expected the same Zoom exit painter type');return old.reverse!==this.reverse||old.fade.value!==this.fade.value||old.scale.value!==this.scale.value;}
    override dispose():void{this.opacityHandle.dispose();this.transformHandle.dispose();this.scale.removeListener(this.notify);this.fade.removeListener(this.notify);this.animation.removeStatusListener(this.statusChanged);super.dispose();}
}

class ZoomPageTransition extends StatelessWidget {
    /** @dartType Animation<double> */readonly animation:Animation<number>;
    /** @dartType Animation<double> */readonly secondaryAnimation:Animation<number>;
    /** @dartParam animation Animation<double>
     * @dartParam secondaryAnimation Animation<double> */
    constructor(animation:Animation<number>,secondaryAnimation:Animation<number>,private readonly allowSnapshotting:boolean,private readonly allowEnterRouteSnapshotting:boolean,private readonly backgroundColor:Color|null,private readonly child:Widget|null){super();this.animation=animation;this.secondaryAnimation=secondaryAnimation;}
    build(context:BuildContext):Widget{const color=this.backgroundColor??new Color(materialTransitionThemeOf(context).colorScheme.surface);return new DualTransitionBuilder({animation:this.animation,forwardBuilder:(_context,animation,child)=>new ZoomEnterTransition(animation,false,this.allowSnapshotting&&this.allowEnterRouteSnapshotting,color,child),reverseBuilder:(_context,animation,child)=>new ZoomExitTransition(animation,true,this.allowSnapshotting,child),child:zoomSnapshotAwareDelegatedTransition(context,this.animation,this.secondaryAnimation,this.child,this.allowSnapshotting,this.allowEnterRouteSnapshotting,color)});}
}
/** @dartParam animation Animation<double>
 * @dartParam secondaryAnimation Animation<double> */
export function zoomSnapshotAwareDelegatedTransition(context:BuildContext,animation:Animation<number>,secondaryAnimation:Animation<number>,child:Widget|null,allowSnapshotting:boolean,allowEnterRouteSnapshotting:boolean,backgroundColor:Color|null):Widget{void animation;const color=backgroundColor??new Color(materialTransitionThemeOf(context).colorScheme.surface);return new DualTransitionBuilder({animation:new ReverseAnimation(secondaryAnimation),forwardBuilder:(_context,animation,child)=>new ZoomEnterTransition(animation,true,allowSnapshotting&&allowEnterRouteSnapshotting,color,child),reverseBuilder:(_context,animation,child)=>new ZoomExitTransition(animation,false,allowSnapshotting,child),child});}
export function createZoomTransition(animation:Animation<number>,secondaryAnimation:Animation<number>,allowSnapshotting:boolean,allowEnterRouteSnapshotting:boolean,backgroundColor:Color|null,child:Widget|null):Widget{return new ZoomPageTransition(animation,secondaryAnimation,allowSnapshotting,allowEnterRouteSnapshotting,backgroundColor,child);}
class ZoomEnterTransitionNoCache extends StatelessWidget {
    /** @dartType Animation<double> */readonly animation:Animation<number>;
    /** @dartParam animation Animation<double> */
    constructor(animation:Animation<number>,private readonly reverse:boolean,private readonly child:Widget|null){super();this.animation=animation;}
    build():Widget{
        /** @dartType double */let opacity=0;if(!this.reverse&&!this.animation.isCompleted)opacity=scrimOpacityTween.evaluate(this.animation)!;
        /** @dartType Animation<double> */const fadeTransition=this.reverse?kAlwaysCompleteAnimation:enterFadeIn.animate(this.animation);
        /** @dartType Animation<double> */const scaleTransition=(this.reverse?enterScaleDown:enterScaleUp).animate(this.animation);
        return new AnimatedBuilder({animation:this.animation,builder:(_context,child)=>new ColoredBox({color:Colors.black.withOpacity(opacity).toARGB32(),child}),child:new FadeTransition({opacity:fadeTransition,child:new ScaleTransition({scale:scaleTransition,filterQuality:'medium',child:this.child})})});
    }
}
class ZoomExitTransitionNoCache extends StatelessWidget {
    /** @dartType Animation<double> */readonly animation:Animation<number>;
    /** @dartParam animation Animation<double> */
    constructor(animation:Animation<number>,private readonly reverse:boolean,private readonly child:Widget|null){super();this.animation=animation;}
    build():Widget{
        /** @dartType Animation<double> */const fadeTransition=this.reverse?exitFadeOut.animate(this.animation):kAlwaysCompleteAnimation;
        /** @dartType Animation<double> */const scaleTransition=(this.reverse?exitScaleDown:exitScaleUp).animate(this.animation);
        return new FadeTransition({opacity:fadeTransition,child:new ScaleTransition({scale:scaleTransition,filterQuality:'medium',child:this.child})});}
}
class ZoomPageTransitionNoCache extends StatelessWidget {
    /** @dartType Animation<double> */readonly animation:Animation<number>;
    /** @dartType Animation<double> */readonly secondaryAnimation:Animation<number>;
    /** @dartParam animation Animation<double>
     * @dartParam secondaryAnimation Animation<double> */
    constructor(animation:Animation<number>,secondaryAnimation:Animation<number>,private readonly child:Widget|null){super();this.animation=animation;this.secondaryAnimation=secondaryAnimation;}
    build():Widget{return new DualTransitionBuilder({animation:this.animation,forwardBuilder:(_context,animation,child)=>new ZoomEnterTransitionNoCache(animation,false,child),reverseBuilder:(_context,animation,child)=>new ZoomExitTransitionNoCache(animation,true,child),child:new DualTransitionBuilder({animation:new ReverseAnimation(this.secondaryAnimation),forwardBuilder:(_context,animation,child)=>new ZoomEnterTransitionNoCache(animation,true,child),reverseBuilder:(_context,animation,child)=>new ZoomExitTransitionNoCache(animation,false,child),child:this.child})});}
}
export function createZoomNoCacheTransition(animation:Animation<number>,secondaryAnimation:Animation<number>,child:Widget|null):Widget{return new ZoomPageTransitionNoCache(animation,secondaryAnimation,child);}
