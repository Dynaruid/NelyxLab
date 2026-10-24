// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// GlowingOverscrollIndicator from widgets/overscroll_indicator.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a. ARGB, milliseconds and View tickers are explicit adapters.
import {ChangeNotifier,Listenable} from '../../foundation/notifier.ts';
import type {Disposable} from '../../foundation/disposable.ts';
import {invariant} from '../../foundation/errors.ts';
import {Offset} from '../../ui/offset.ts';import {Paint} from '../../ui/paint.ts';
import type {Canvas} from '../../ui/canvas.ts';import type {Size} from '../../ui/geometry.ts';
import {Axis,AxisDirection,axisDirectionToAxis,flipAxisDirection} from '../painting/basic-types.ts';
import {AnimationController} from '../animation/animation-controller.ts';import {AnimationStatus} from '../animation/animation.ts';
import {Curves} from '../animation/curves.ts';import type {Ticker,TickerProvider} from '../animation/ticker.ts';
import {CustomPainter} from '../rendering/custom-paint.ts';
import {RenderBox} from '../rendering/object.ts';
import {TickerProviderStateMixin} from './ticker-provider.ts';
import {StatefulWidget} from './framework.ts';import type {BuildContext,Widget,WidgetOptions} from './framework.ts';
import {CustomPaint} from './custom-paint.ts';import {SizedBox} from './basic.ts';
import {Notification,NotificationListener} from './notification-listener.ts';
import {ScrollNotification,OverscrollNotification,ScrollEndNotification,ScrollUpdateNotification,ViewportNotificationMixin,defaultScrollNotificationPredicate} from './scroll-notification.ts';import type {ScrollNotificationPredicate} from './scroll-notification.ts';
import {scrollChromeTimer} from './scroll-chrome-timers.ts';
export class OverscrollIndicatorNotification extends ViewportNotificationMixin(Notification) {
  readonly leading:boolean;private allowed=true;paintOffset=0;
  constructor({leading}:{readonly leading:boolean}){super();this.leading=leading;}
  get accepted():boolean{return this.allowed;}
  disallowIndicator():void{this.allowed=false;}
}
export interface GlowingOverscrollIndicatorOptions extends WidgetOptions {readonly axisDirection:AxisDirection;readonly color:number;readonly showLeading?:boolean;readonly showTrailing?:boolean;readonly notificationPredicate?:ScrollNotificationPredicate;readonly child?:Widget|null}
export class GlowingOverscrollIndicator extends StatefulWidget {
  readonly axisDirection:AxisDirection;readonly color:number;readonly showLeading:boolean;readonly showTrailing:boolean;readonly notificationPredicate:ScrollNotificationPredicate;readonly child:Widget|null;
  constructor({axisDirection,color,showLeading=true,showTrailing=true,notificationPredicate=defaultScrollNotificationPredicate,child=null,...options}:GlowingOverscrollIndicatorOptions){super(options.key??null);this.axisDirection=axisDirection;this.color=color;this.showLeading=showLeading;this.showTrailing=showTrailing;this.notificationPredicate=notificationPredicate;this.child=child;}
  get axis():Axis{return axisDirectionToAxis(this.axisDirection);}
  createState():_GlowingOverscrollIndicatorState{return new _GlowingOverscrollIndicatorState();}
}
class _GlowingOverscrollIndicatorState extends TickerProviderStateMixin<GlowingOverscrollIndicator> {
  private leading!:GlowController;private trailing!:GlowController;private lastOverscroll=false;private readonly accepted=new Map<boolean,boolean>([[true,true],[false,true]]);
  override initState():void{super.initState();this.leading=new GlowController(this,this.widget.color);this.trailing=new GlowController(this,this.widget.color);}
  override didUpdateWidget(old:GlowingOverscrollIndicator):void{super.didUpdateWidget(old);this.leading.color=this.widget.color;this.trailing.color=this.widget.color;}
  private notification(notification:ScrollNotification):boolean {
    if(!this.widget.notificationPredicate(notification)||notification.metrics.axis!==this.widget.axis)return false;
    const metrics=notification.metrics;this.leading.paintOffsetScrollPixels=-Math.min(metrics.pixels-metrics.minScrollExtent,this.leading.paintOffset);this.trailing.paintOffsetScrollPixels=-Math.min(metrics.maxScrollExtent-metrics.pixels,this.trailing.paintOffset);
    if(notification instanceof OverscrollNotification){
      const leading=notification.overscroll<0,controller=leading?this.leading:this.trailing;
      if(!this.lastOverscroll){const confirmation=new OverscrollIndicatorNotification({leading});confirmation.dispatch(this.context);this.accepted.set(leading,confirmation.accepted);if(confirmation.accepted)controller.paintOffset=confirmation.paintOffset;}
      if(this.accepted.get(leading)){
        if(notification.velocity!==0)controller.absorbImpact(Math.abs(notification.velocity));
        else if(notification.dragDetails!==null){const render=notification.context?.findRenderObject();invariant(render instanceof RenderBox&&render.hasSize,'missing-overscroll-render-box','Drag overscroll requires its mounted sized renderer');const size=render.size,point=render.globalToLocal(notification.dragDetails.globalPosition);if(this.widget.axis===Axis.vertical)controller.pull(Math.abs(notification.overscroll),size.height,Math.max(0,Math.min(size.width,point.x)),size.width);else controller.pull(Math.abs(notification.overscroll),size.width,Math.max(0,Math.min(size.height,point.y)),size.height);}
      }
    }else if((notification instanceof ScrollEndNotification||notification instanceof ScrollUpdateNotification)&&notification.dragDetails!==null){this.leading.scrollEnd();this.trailing.scrollEnd();}
    this.lastOverscroll=notification instanceof OverscrollNotification;return false;
  }
  build(_context:BuildContext):Widget{return new NotificationListener({notificationType:ScrollNotification,onNotification:notification=>this.notification(notification),child:new CustomPaint(this.widget.child??SizedBox.shrink(),{foregroundPainter:new GlowPainter(this.widget.axisDirection,this.widget.showLeading?this.leading:null,this.widget.showTrailing?this.trailing:null)})});}
  override dispose():void{this.leading.dispose();this.trailing.dispose();super.dispose();}
}
const widthToHeightFactor=3/4*(2-1.73205080757);
class GlowController extends ChangeNotifier {
  private readonly animation:AnimationController;private readonly displacementTicker:Ticker;private timer:Disposable|null=null;
  private state:'idle'|'absorb'|'pull'|'recede'='idle';private opacityBegin=0;private opacityEnd=0;private sizeBegin=0;private sizeEnd=0;private displacement=0.5;private displacementTarget=0.5;private displacementLast:number|null=null;private pullDistance=0;
  paintOffset=0;paintOffsetScrollPixels=0;private currentColor:number;
  private readonly changed=()=>this.notifyListeners();
  constructor(vsync:TickerProvider,color:number){super();this.currentColor=color;this.animation=new AnimationController({vsync});this.animation.addListener(this.changed);this.animation.addStatusListener(status=>{if(status!==AnimationStatus.completed)return;if(this.state==='absorb')this.recede(600);else if(this.state==='recede'){this.state='idle';this.pullDistance=0;}});this.displacementTicker=vsync.createTicker(elapsed=>this.tickDisplacement(elapsed));}
  get color():number{return this.currentColor;}set color(value:number){if(this.currentColor!==value){this.currentColor=value;this.notifyListeners();}}
  private get opacity():number{return this.opacityBegin+(this.opacityEnd-this.opacityBegin)*Curves.decelerate.transform(this.animation.value);}
  private get glowSize():number{return this.sizeBegin+(this.sizeEnd-this.sizeBegin)*Curves.decelerate.transform(this.animation.value);}
  absorbImpact(velocity:number):void{this.timer?.dispose();this.timer=null;velocity=Math.max(100,Math.min(10000,velocity));this.opacityBegin=this.state==='idle'?0.3:this.opacity;this.opacityEnd=Math.max(this.opacityBegin,Math.min(0.5,velocity*0.00006));this.sizeBegin=this.glowSize;this.sizeEnd=Math.min(0.025+7.5e-7*velocity*velocity,1);this.animation.duration=Math.round(0.15+velocity*0.02);void this.animation.forward({from:0});this.displacement=0.5;this.state='absorb';}
  pull(overscroll:number,extent:number,crossOffset:number,crossExtent:number):void{
    if(extent<=0||crossExtent<=0)return;this.timer?.dispose();this.timer=null;this.pullDistance+=overscroll/200;this.opacityBegin=this.opacity;this.opacityEnd=Math.min(this.opacity+overscroll/extent*0.8,0.5);const height=Math.min(extent,crossExtent*widthToHeightFactor);this.sizeBegin=this.glowSize;this.sizeEnd=Math.max(1-1/(0.7*Math.sqrt(this.pullDistance*height)),this.glowSize);this.displacementTarget=crossOffset/crossExtent;
    if(this.displacementTarget!==this.displacement){if(!this.displacementTicker.isTicking)this.displacementTicker.start();}else{this.displacementTicker.stop();this.displacementLast=null;}
    this.animation.duration=167;if(this.state!=='pull'){void this.animation.forward({from:0});this.state='pull';}else if(!this.animation.isAnimating)this.notifyListeners();this.timer=scrollChromeTimer(167,()=>{this.timer=null;this.recede(2000);});
  }
  scrollEnd():void{if(this.state==='pull')this.recede(600);}
  private recede(duration:number):void{if(this.state==='recede'||this.state==='idle')return;this.timer?.dispose();this.timer=null;this.opacityBegin=this.opacity;this.opacityEnd=0;this.sizeBegin=this.glowSize;this.sizeEnd=0;this.animation.duration=duration;void this.animation.forward({from:0});this.state='recede';}
  private tickDisplacement(elapsed:number):void{if(this.displacementLast!==null){this.displacement=this.displacementTarget-(this.displacementTarget-this.displacement)*Math.pow(2,-(elapsed-this.displacementLast)/(16667/1000));this.notifyListeners();}if(Math.abs(this.displacementTarget-this.displacement)<0.001){this.displacementTicker.stop();this.displacementLast=null;}else this.displacementLast=elapsed;}
  paint(canvas:Canvas,size:Size):void{
    if(this.opacity===0||size.width<=0||size.height<=0)return;const baseScale=size.width>size.height?size.height/size.width:1,radius=size.width*3/2,height=Math.min(size.height,size.width*widthToHeightFactor),scale=this.glowSize*baseScale;if(scale<=0)return;
    canvas.save();canvas.translate(0,this.paintOffset+this.paintOffsetScrollPixels);canvas.scale(1,scale);canvas.clipRect({x:0,y:0,width:size.width,height});canvas.drawCircle(new Offset(size.width/2*(0.5+this.displacement),height-radius),radius,new Paint({color:((Math.round(this.opacity*255)<<24)|(this.color&0xffffff))>>>0}));canvas.restore();
  }
  override dispose():void{this.timer?.dispose();this.timer=null;this.animation.dispose();this.displacementTicker.dispose();super.dispose();}
}
class GlowPainter extends CustomPainter {
  constructor(private readonly direction:AxisDirection,private readonly leading:GlowController|null,private readonly trailing:GlowController|null){super({repaint:Listenable.merge([leading,trailing])});}
  private side(canvas:Canvas,size:Size,controller:GlowController|null,direction:AxisDirection):void{if(!controller)return;canvas.save();switch(direction){case AxisDirection.down:canvas.translate(0,size.height);canvas.scale(1,-1);controller.paint(canvas,size);break;case AxisDirection.up:controller.paint(canvas,size);break;case AxisDirection.left:canvas.rotate(Math.PI/2);canvas.scale(1,-1);controller.paint(canvas,{width:size.height,height:size.width});break;case AxisDirection.right:canvas.translate(size.width,0);canvas.rotate(Math.PI/2);controller.paint(canvas,{width:size.height,height:size.width});break;}canvas.restore();}
  paint(canvas:Canvas,size:Size):void{this.side(canvas,size,this.leading,flipAxisDirection(this.direction));this.side(canvas,size,this.trailing,this.direction);}
  override hitTest(_position:Offset):boolean{return false;}
  shouldRepaint(old:CustomPainter):boolean{return !(old instanceof GlowPainter)||old.leading!==this.leading||old.trailing!==this.trailing||old.direction!==this.direction;}
}
