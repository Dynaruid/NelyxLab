// SPDX-License-Identifier: BSD-3-Clause
// Nelyx page scrolling composes the existing lazy list, position and activity owners.
import {invariant} from '../../foundation/errors.ts';
import {State,StatefulWidget} from './framework.ts';
import type {Widget,WidgetOptions} from './framework.ts';
import {LayoutBuilder} from './layout-builder.ts';
import {ListView} from './scroll-view.ts';
import {ScrollController} from './scroll-controller.ts';
import {ScrollPositionWithSingleContext} from './scroll-position-with-single-context.ts';
import type {ScrollPosition} from './scroll-position.ts';
import type {ScrollContext} from './scroll-context.ts';
import {ScrollPhysics,ClampingScrollPhysics} from './scroll-physics.ts';
import type {ScrollMetrics} from './scroll-metrics.ts';
import type {Simulation} from '../physics/simulation.ts';
import {ScrollSpringSimulation} from '../physics/spring-simulation.ts';
import {Axis} from '../painting/basic-types.ts';
import {EdgeInsets} from '../painting/edge-insets.ts';
import {PageStorage} from './page-storage.ts';
import {ScrollBehavior,ScrollConfiguration} from './scroll-configuration.ts';
import {NotificationListener} from './notification-listener.ts';
import {ScrollUpdateNotification} from './scroll-notification.ts';
import type {NullableIndexedWidgetBuilder} from './scroll-delegate.ts';
import type {ViewportAnimationOptions} from '../rendering/viewport-offset.ts';

function checkPage(page:number):void{invariant(Number.isSafeInteger(page)&&page>=0,'invalid-page','Page index must be a nonnegative integer');}
function checkFraction(fraction:number):void{invariant(Number.isFinite(fraction)&&fraction>0&&fraction<=1,'invalid-page-fraction','Nelyx page viewportFraction must be in (0, 1]');}
export class PageController extends ScrollController {
  readonly initialPage:number;readonly keepPage:boolean;readonly viewportFraction:number;
  constructor({initialPage=0,keepPage=true,viewportFraction=1}:{readonly initialPage?:number;readonly keepPage?:boolean;readonly viewportFraction?:number}={}){super({keepScrollOffset:false});checkPage(initialPage);checkFraction(viewportFraction);this.initialPage=initialPage;this.keepPage=keepPage;this.viewportFraction=viewportFraction;}
  get page():number|null{return this.hasClients?(this.position as PagePosition).page:null;}
  override attach(position:ScrollPosition):void{invariant(position instanceof PagePosition,'invalid-page-position','PageController requires a page scroll position');super.attach(position);position.updateController(this);}
  jumpToPage(page:number):void{checkPage(page);const position=this.position as PagePosition;if(!position.hasViewportDimension||position.viewportDimension===0)position.pendingPage=page;else position.jumpTo(page*position.viewportDimension*this.viewportFraction);}
  animateToPage(page:number,options:ViewportAnimationOptions):Promise<void>{checkPage(page);const position=this.position as PagePosition;if(!position.hasViewportDimension||position.viewportDimension===0){position.pendingPage=page;return Promise.resolve();}return position.animateTo(page*position.viewportDimension*this.viewportFraction,options);}
  override createScrollPosition(physics:ScrollPhysics,context:ScrollContext,oldPosition:ScrollPosition|null):ScrollPosition{return new PagePosition(physics,context,this,oldPosition);}
}
class PagePosition extends ScrollPositionWithSingleContext {
  pendingPage:number;
  private firstDimension=true;
  constructor(physics:ScrollPhysics,context:ScrollContext,public controller:PageController,oldPosition:ScrollPosition|null){super({physics,context,initialPixels:0,keepScrollOffset:false,oldPosition});const saved=controller.keepPage?PageStorage.maybeOf(context.storageContext)?.readState(context.storageContext):null;this.pendingPage=oldPosition instanceof PagePosition?oldPosition.page:typeof saved==='object'&&saved!==null&&'page' in saved&&typeof saved.page==='number'&&Number.isFinite(saved.page)&&saved.page>=0?saved.page:controller.initialPage;}
  updateController(controller:PageController):void{if(controller===this.controller)return;this.pendingPage=this.page;this.controller=controller;this.firstDimension=true;}
  get page():number{return !this.firstDimension&&this.hasViewportDimension&&this.viewportDimension>0?this.pixels/(this.viewportDimension*this.controller.viewportFraction):this.pendingPage;}
  override applyViewportDimension(dimension:number):boolean{const page=this.firstDimension?this.pendingPage:this.page,old=!this.firstDimension&&this.hasViewportDimension?this.viewportDimension:null;this.firstDimension=false;super.applyViewportDimension(dimension);if(old===dimension)return true;this.pendingPage=page;const pixels=dimension*page*this.controller.viewportFraction;if(pixels===this.pixels)return true;this.correctPixels(pixels);return false;}
  override didEndScroll():void{super.didEndScroll();if(this.controller.keepPage)PageStorage.maybeOf(this.context.storageContext)?.writeState(this.context.storageContext,{page:this.page});}
}
export class PageScrollPhysics extends ScrollPhysics {
  readonly viewportFraction:number;
  constructor({parent=null,viewportFraction=1}:{readonly parent?:ScrollPhysics|null;readonly viewportFraction?:number}={}){super({parent});checkFraction(viewportFraction);this.viewportFraction=viewportFraction;}
  override applyTo(ancestor:ScrollPhysics|null):PageScrollPhysics{return new PageScrollPhysics({parent:this.buildParent(ancestor),viewportFraction:this.viewportFraction});}
  override shouldUpdate(old:ScrollPhysics):boolean{return !(old instanceof PageScrollPhysics)||old.viewportFraction!==this.viewportFraction||super.shouldUpdate(old);}
  override createBallisticSimulation(position:ScrollMetrics,velocity:number):Simulation|null{
    if(position.pixels<=position.minScrollExtent&&velocity<=0||position.pixels>=position.maxScrollExtent&&velocity>=0)return super.createBallisticSimulation(position,velocity);
    const extent=position.viewportDimension*this.viewportFraction;if(extent===0)return null;const tolerance=this.toleranceFor(position),page=position.pixels/extent+(velocity>tolerance.velocity?0.5:velocity< -tolerance.velocity?-0.5:0),target=Math.max(position.minScrollExtent,Math.min(position.maxScrollExtent,Math.round(page)*extent));
    return target===position.pixels?null:new ScrollSpringSimulation(this.spring,position.pixels,target,velocity,{tolerance});
  }
}
export interface PageViewOptions extends WidgetOptions {
  readonly controller?:PageController;readonly children?:readonly Widget[];readonly scrollDirection?:Axis;readonly reverse?:boolean;readonly physics?:ScrollPhysics;
  readonly pageSnapping?:boolean;readonly padEnds?:boolean;readonly onPageChanged?:(page:number)=>void;
}
export class PageView extends StatefulWidget {
  readonly itemBuilder:NullableIndexedWidgetBuilder;readonly itemCount:number;
  constructor(readonly options:PageViewOptions={},builder?:{readonly itemBuilder:NullableIndexedWidgetBuilder;readonly itemCount:number}){super(options.key??null);const children=Object.freeze([...(options.children??[])]);this.itemBuilder=builder?.itemBuilder??((_context,index)=>children[index]??null);this.itemCount=builder?.itemCount??children.length;checkPage(this.itemCount);}
  static builder(options:Omit<PageViewOptions,'children'>&{readonly itemBuilder:NullableIndexedWidgetBuilder;readonly itemCount:number}):PageView{return new PageView(options,options);}
  createState():State{return new PageViewState();}
}
class PageViewState extends State<PageView> {
  private owned:PageController|undefined;
  private lastPage=0;
  private get controller():PageController{return this.widget.options.controller??(this.owned??=new PageController());}
  override initState():void{this.lastPage=this.controller.initialPage;}
  override didUpdateWidget(old:PageView):void{if(old.options.controller!==this.widget.options.controller)this.lastPage=this.controller.initialPage;}
  override dispose():void{this.owned?.dispose();super.dispose();}
  build():Widget{return new LayoutBuilder((_context,constraints)=>{
    const options=this.widget.options,axis=options.scrollDirection??Axis.horizontal,dimension=axis===Axis.horizontal?constraints.maxWidth:constraints.maxHeight;invariant(Number.isFinite(dimension),'unbounded-page-view','PageView requires a bounded main axis');const fraction=this.controller.viewportFraction,extent=Math.max(Number.EPSILON,dimension*fraction),padding=options.padEnds===false?0:dimension*(1-fraction)/2;
    return new NotificationListener({notificationType:ScrollUpdateNotification,onNotification:notification=>{if(notification.depth===0){const page=Math.max(0,Math.min(this.widget.itemCount-1,Math.round(this.controller.page??0)));if(page!==this.lastPage){this.lastPage=page;options.onPageChanged?.(page);}}return false;},child:new ScrollConfiguration({behavior:new ScrollBehavior().copyWith({scrollbars:false,overscroll:false}),child:ListView.builder({controller:this.controller,scrollDirection:axis,reverse:options.reverse??false,physics:options.pageSnapping===false?options.physics??new ClampingScrollPhysics():new PageScrollPhysics({parent:options.physics??new ClampingScrollPhysics(),viewportFraction:fraction}),padding:axis===Axis.horizontal?EdgeInsets.symmetric({horizontal:padding}):EdgeInsets.symmetric({vertical:padding}),itemExtent:extent,itemCount:this.widget.itemCount,itemBuilder:this.widget.itemBuilder})})});
  });}
}
