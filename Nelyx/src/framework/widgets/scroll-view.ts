// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {StatelessWidget,Widget,Element} from './framework.ts';import type {BuildContext,WidgetOptions} from './framework.ts';
import type {Key} from '../../foundation/key.ts';import type {Clip} from '../../ui/clip.ts';
import {Axis,AxisDirection} from '../painting/basic-types.ts';import type {ViewportOffset} from '../rendering/viewport-offset.ts';
import {ScrollCacheExtent,SliverPaintOrder} from '../rendering/viewport.ts';
import {Viewport,ShrinkWrappingViewport} from './viewport.ts';import {Scrollable} from './scrollable.ts';
import type {ScrollController} from './scroll-controller.ts';import {PrimaryScrollController} from './primary-scroll-controller.ts';
import {AlwaysScrollableScrollPhysics} from './scroll-physics.ts';import type {ScrollPhysics} from './scroll-physics.ts';
import {ScrollConfiguration} from './scroll-configuration.ts';import type {ScrollBehavior} from './scroll-configuration.ts';
import {DragStartBehavior} from '../gestures/recognizer.ts';import {HitTestBehavior} from '../rendering/pointer-listener.ts';
import {SliverPadding,getAxisDirectionFromAxisReverseAndDirectionality} from './basic.ts';
import {Directionality,MediaQuery} from './app-data.ts';import {EdgeInsets} from '../painting/edge-insets.ts';import type {EdgeInsetsGeometry} from '../painting/edge-insets.ts';
import {NotificationListener} from './notification-listener.ts';import {ScrollUpdateNotification} from './scroll-notification.ts';import {FocusScope} from './focus-scope.ts';
import {SliverList,SliverSectionList,SliverFixedExtentList,SliverVariedExtentList,SliverGrid} from './sliver.ts';import {SliverPrototypeExtentList} from './sliver-prototype-extent-list.ts';
import {SliverChildBuilderDelegate,SliverChildListDelegate} from './scroll-delegate.ts';import type {SliverChildDelegate,NullableIndexedWidgetBuilder,ChildIndexGetter,SliverChildDelegateOptions} from './scroll-delegate.ts';
import {SliverGridDelegateWithFixedCrossAxisCount,SliverGridDelegateWithMaxCrossAxisExtent} from '../rendering/sliver-grid.ts';import type {SliverGridDelegate} from '../rendering/sliver-grid.ts';import type {ItemExtentBuilder} from '../rendering/sliver.ts';
import type {SectionExtentIndex} from '../rendering/section-extent-index.ts';
import {invariant} from '../../foundation/errors.ts';import {protect} from '../../ui/value-math.ts';
import {normalizeSliverChildPolicy} from './view-work-budget.ts';import type {SliverChildPolicy} from './view-work-budget.ts';
export type {SliverChildPolicy} from './view-work-budget.ts';
export class ScrollViewKeyboardDismissBehavior {
  static readonly manual=new ScrollViewKeyboardDismissBehavior(0,'manual');static readonly onDrag=new ScrollViewKeyboardDismissBehavior(1,'onDrag');static readonly values=Object.freeze([this.manual,this.onDrag]);private constructor(readonly index:number,readonly name:string){Object.freeze(this);}toString():string{return 'ScrollViewKeyboardDismissBehavior.'+this.name;}
}
export interface ScrollViewOptions extends WidgetOptions {
  readonly scrollDirection?:Axis;readonly reverse?:boolean;readonly controller?:ScrollController|null;readonly primary?:boolean|null;readonly physics?:ScrollPhysics|null;readonly scrollBehavior?:ScrollBehavior|null;readonly shrinkWrap?:boolean;readonly center?:Key|null;readonly anchor?:number;readonly cacheExtent?:number|null;readonly scrollCacheExtent?:ScrollCacheExtent|null;readonly semanticChildCount?:number|null;readonly paintOrder?:SliverPaintOrder;readonly dragStartBehavior?:DragStartBehavior;readonly keyboardDismissBehavior?:ScrollViewKeyboardDismissBehavior|null;readonly restorationId?:string|null;readonly clipBehavior?:Clip;readonly hitTestBehavior?:HitTestBehavior;
}
export abstract class ScrollView extends StatelessWidget {
  readonly scrollDirection:Axis;readonly reverse:boolean;readonly controller:ScrollController|null;readonly primary:boolean|null;readonly physics:ScrollPhysics|null;readonly scrollBehavior:ScrollBehavior|null;readonly shrinkWrap:boolean;readonly center:Key|null;readonly anchor:number;readonly cacheExtent:number|null;readonly scrollCacheExtent:ScrollCacheExtent|null;readonly semanticChildCount:number|null;readonly paintOrder:SliverPaintOrder;readonly dragStartBehavior:DragStartBehavior;readonly keyboardDismissBehavior:ScrollViewKeyboardDismissBehavior|null;readonly restorationId:string|null;readonly clipBehavior:Clip;readonly hitTestBehavior:HitTestBehavior;
  constructor({scrollDirection=Axis.vertical,reverse=false,controller=null,primary=null,physics=null,scrollBehavior=null,shrinkWrap=false,center=null,anchor=0,cacheExtent=null,scrollCacheExtent=null,semanticChildCount=null,paintOrder=SliverPaintOrder.firstIsTop,dragStartBehavior=DragStartBehavior.start,keyboardDismissBehavior=null,restorationId=null,clipBehavior='hardEdge',hitTestBehavior=HitTestBehavior.opaque,...options}:ScrollViewOptions={}){
    super(options.key??null);invariant(!(controller!==null&&primary===true),'conflicting-primary-controller','Primary scroll views obtain their controller through inheritance');invariant(!shrinkWrap||center===null,'centered-shrink-wrap','Shrink-wrapping scroll views cannot use a center key');invariant(anchor>=0&&anchor<=1,'invalid-scroll-anchor','Scroll anchor must lie in0..1');invariant(semanticChildCount===null||Number.isSafeInteger(semanticChildCount)&&semanticChildCount>=0,'invalid-scroll-semantic-count','Semantic child count must be a nonnegative integer');this.scrollDirection=scrollDirection;this.reverse=reverse;this.controller=controller;this.primary=primary;this.physics=physics??(primary===true||primary===null&&controller===null&&scrollDirection===Axis.vertical?new AlwaysScrollableScrollPhysics():null);this.scrollBehavior=scrollBehavior;this.shrinkWrap=shrinkWrap;this.center=center;this.anchor=anchor;this.cacheExtent=cacheExtent;this.scrollCacheExtent=scrollCacheExtent;this.semanticChildCount=semanticChildCount;this.paintOrder=paintOrder;this.dragStartBehavior=dragStartBehavior;this.keyboardDismissBehavior=keyboardDismissBehavior;this.restorationId=restorationId;this.clipBehavior=clipBehavior;this.hitTestBehavior=hitTestBehavior;
    protect(this,['scrollDirection','reverse','controller','primary','physics','scrollBehavior','shrinkWrap','center','anchor','cacheExtent','scrollCacheExtent','semanticChildCount','paintOrder','dragStartBehavior','keyboardDismissBehavior','restorationId','clipBehavior','hitTestBehavior']);
  }
  getDirection(context:BuildContext):AxisDirection{return getAxisDirectionFromAxisReverseAndDirectionality(context,this.scrollDirection,this.reverse);}
  abstract buildSlivers(context:BuildContext):readonly Widget[];
  protected get childLayoutCacheExtent():ScrollCacheExtent|null{return this.scrollCacheExtent??(this.cacheExtent===null?null:ScrollCacheExtent.pixels(this.cacheExtent));}
  buildViewport(context:BuildContext,offset:ViewportOffset,axisDirection:AxisDirection,slivers:readonly Widget[]):Widget{
    if(axisDirection===AxisDirection.up||axisDirection===AxisDirection.down)Directionality.of(context);invariant(this.clipBehavior==='none'||this.clipBehavior==='hardEdge','viewport-clip-owner-not-implemented','Additional Source viewport clip modes are still pending');const scrollCacheExtent=this.childLayoutCacheExtent;if(this.shrinkWrap)return new ShrinkWrappingViewport({axisDirection,offset,slivers,scrollCacheExtent,paintOrder:this.paintOrder,clipBehavior:this.clipBehavior});return new Viewport({axisDirection,offset,slivers,scrollCacheExtent,center:this.center,anchor:this.anchor,paintOrder:this.paintOrder,clipBehavior:this.clipBehavior});
  }
  build(context:BuildContext):Widget{
    const slivers=this.buildSlivers(context),axisDirection=this.getDirection(context),effectivePrimary=this.primary??(this.controller===null&&PrimaryScrollController.shouldInherit(context,this.scrollDirection)),controller=effectivePrimary?PrimaryScrollController.maybeOf(context):this.controller;
    const scrollable=new Scrollable({dragStartBehavior:this.dragStartBehavior,axisDirection,controller,physics:this.physics,scrollBehavior:this.scrollBehavior,semanticChildCount:this.semanticChildCount,restorationId:this.restorationId,hitTestBehavior:this.hitTestBehavior,clipBehavior:this.clipBehavior,viewportBuilder:(context,offset)=>this.buildViewport(context,offset,axisDirection,slivers)});
    const result=effectivePrimary&&controller!==null?PrimaryScrollController.none({child:scrollable}):scrollable,dismiss=this.keyboardDismissBehavior??this.scrollBehavior?.getKeyboardDismissBehavior(context)??ScrollConfiguration.of(context).getKeyboardDismissBehavior(context);
    if(dismiss!==ScrollViewKeyboardDismissBehavior.onDrag)return result;return new NotificationListener({notificationType:ScrollUpdateNotification,child:result,onNotification:notification=>{const scope=FocusScope.of(context);if(notification.dragDetails!==null&&!scope.hasPrimaryFocus&&scope.hasFocus){invariant(context instanceof Element,'invalid-scroll-focus-context','Keyboard dismissal requires this actual View Element');context.owner.focus.primaryFocus?.unfocus();}return false;}});
  }
}
export interface CustomScrollViewOptions extends ScrollViewOptions {readonly slivers?:readonly Widget[]}
export class CustomScrollView extends ScrollView {
  readonly slivers:readonly Widget[];
  constructor({slivers=[],...options}:CustomScrollViewOptions={}){super(options);this.slivers=Object.freeze([...slivers]);protect(this,['slivers']);}
  buildSlivers(_context:BuildContext):readonly Widget[]{return this.slivers;}
}
export interface BoxScrollViewOptions extends Omit<ScrollViewOptions,'scrollBehavior'|'center'|'anchor'|'paintOrder'> {readonly padding?:EdgeInsetsGeometry|null}
export abstract class BoxScrollView extends ScrollView {
  readonly padding:EdgeInsetsGeometry|null;
  constructor({padding=null,...options}:BoxScrollViewOptions={}){super(options);this.padding=padding;protect(this,['padding']);}
  buildSlivers(context:BuildContext):readonly Widget[]{
    let sliver=this.buildChildLayout(context),padding=this.padding;const media=context.maybeDependOn(MediaQuery)?.data;
    if(padding===null&&media){
      const sourcePadding=MediaQuery.paddingOf(context),horizontal=sourcePadding.copyWith({top:0,bottom:0}),vertical=sourcePadding.copyWith({left:0,right:0});
      padding=this.scrollDirection===Axis.vertical?vertical:horizontal;
      const remaining=this.scrollDirection===Axis.vertical?horizontal:vertical;
      sliver=new MediaQuery({...media,padding:remaining,viewPadding:MediaQuery.viewPaddingOf(context),safeArea:{left:remaining.left,top:remaining.top,right:remaining.right,bottom:remaining.bottom}},sliver);
    }
    if(padding!==null)sliver=new SliverPadding({padding,sliver});return [sliver];
  }
  abstract buildChildLayout(context:BuildContext):Widget;
}
type ChildDecorationOptions=Pick<SliverChildDelegateOptions,'addAutomaticKeepAlives'|'addRepaintBoundaries'|'addSemanticIndexes'>;
export interface ListViewOptions extends BoxScrollViewOptions,ChildDecorationOptions {readonly children?:readonly Widget[];readonly itemExtent?:number|null;readonly itemExtentBuilder?:ItemExtentBuilder|null;readonly prototypeItem?:Widget|null;readonly extentIndex?:SectionExtentIndex|null;readonly metricRevision?:object|null;/** Bounded State retention is opt-in, shared across this View. Fixed/indexed extent only. */readonly childPolicy?:SliverChildPolicy}
export interface ListViewBuilderOptions extends Omit<ListViewOptions,'children'> {readonly itemBuilder:NullableIndexedWidgetBuilder;readonly itemCount?:number|null;readonly findChildIndexCallback?:ChildIndexGetter|null}
export interface ListViewSeparatedOptions extends Omit<ListViewOptions,'children'|'itemExtent'|'prototypeItem'|'semanticChildCount'> {readonly itemBuilder:NullableIndexedWidgetBuilder;readonly separatorBuilder:(context:BuildContext,index:number)=>Widget;readonly itemCount:number;readonly findChildIndexCallback?:ChildIndexGetter|null;readonly findItemIndexCallback?:ChildIndexGetter|null}
export interface ListViewCustomOptions extends Omit<ListViewOptions,'children'|keyof ChildDecorationOptions> {readonly childrenDelegate:SliverChildDelegate}
export class ListView extends BoxScrollView {
  readonly childPolicy:SliverChildPolicy;
  readonly itemExtent:number|null;readonly itemExtentBuilder:ItemExtentBuilder|null;readonly prototypeItem:Widget|null;readonly childrenDelegate:SliverChildDelegate;readonly extentIndex:SectionExtentIndex|null;readonly metricRevision:object|null;
  /** childrenDelegate transports Source's named constructors through one TS constructor. */
  constructor({children=[],childrenDelegate,itemExtent=null,itemExtentBuilder=null,prototypeItem=null,extentIndex=null,metricRevision=null,childPolicy,addAutomaticKeepAlives=true,addRepaintBoundaries=true,addSemanticIndexes=true,semanticChildCount=null,...options}:ListViewOptions&{readonly childrenDelegate?:SliverChildDelegate}={}){
    super({...options,semanticChildCount:semanticChildCount??(childrenDelegate===undefined?children.length:null)});invariant([itemExtent,itemExtentBuilder,prototypeItem,extentIndex].filter(value=>value!==null).length<=1,'conflicting-list-extents','Only one itemExtent, itemExtentBuilder, prototypeItem or extentIndex may be supplied');this.itemExtent=itemExtent;this.itemExtentBuilder=itemExtentBuilder;this.prototypeItem=prototypeItem;this.extentIndex=extentIndex;this.metricRevision=metricRevision;this.childrenDelegate=childrenDelegate??new SliverChildListDelegate(children,{addAutomaticKeepAlives,addRepaintBoundaries,addSemanticIndexes});protect(this,['itemExtent','itemExtentBuilder','prototypeItem','extentIndex','metricRevision','childrenDelegate']);
    this.childPolicy=normalizeSliverChildPolicy(childPolicy);invariant(this.childPolicy==='legacy'||!this.shrinkWrap&&(itemExtent!==null&&itemExtent>0||extentIndex!==null),'unsupported-bounded-list','Bounded/dormant ListView requires positive fixed or indexed section extents and a non-shrink-wrapping viewport');invariant(this.childPolicy==='legacy'||this.childPolicy.mode!=='bounded'||this.cacheExtent===null&&this.scrollCacheExtent===null,'conflicting-bounded-cache','Bounded child policy cannot be combined with explicit cacheExtent/scrollCacheExtent');protect(this,['childPolicy']);
  }
  static builder({itemBuilder,itemCount=null,findChildIndexCallback=null,addAutomaticKeepAlives=true,addRepaintBoundaries=true,addSemanticIndexes=true,semanticChildCount=null,...options}:ListViewBuilderOptions):ListView{
    invariant(itemCount===null||Number.isSafeInteger(itemCount)&&itemCount>=0,'invalid-list-item-count','Item count must be a nonnegative integer');invariant(semanticChildCount===null||itemCount!==null&&semanticChildCount<=itemCount,'invalid-list-semantic-count','An explicit semantic count requires a bounded item count and cannot exceed it');return new ListView({...options,semanticChildCount:semanticChildCount??itemCount,childrenDelegate:new SliverChildBuilderDelegate(itemBuilder,{childCount:itemCount,findChildIndexCallback,addAutomaticKeepAlives,addRepaintBoundaries,addSemanticIndexes})});
  }
  static separated({itemBuilder,separatorBuilder,itemCount,findChildIndexCallback=null,findItemIndexCallback=null,addAutomaticKeepAlives=true,addRepaintBoundaries=true,addSemanticIndexes=true,...options}:ListViewSeparatedOptions):ListView{
    invariant(Number.isSafeInteger(itemCount)&&itemCount>=0,'invalid-list-item-count','Item count must be a nonnegative integer');invariant(findChildIndexCallback===null||findItemIndexCallback===null,'conflicting-separated-key-lookups','Provide only one separated-list key lookup');const lookup=findItemIndexCallback===null?findChildIndexCallback:(key:Key)=>{const index=findItemIndexCallback(key);return index===null?null:index*2;};
    return new ListView({...options,semanticChildCount:itemCount,childrenDelegate:new SliverChildBuilderDelegate((context,index)=>{const itemIndex=Math.trunc(index/2);if(index%2===0)return itemBuilder(context,itemIndex);const child=separatorBuilder(context,itemIndex);invariant(child instanceof Widget,'invalid-list-separator','Separators must be Widgets');return child;},{childCount:Math.max(0,itemCount*2-1),findChildIndexCallback:lookup,addAutomaticKeepAlives,addRepaintBoundaries,addSemanticIndexes,semanticIndexCallback:(_widget,index)=>index%2===0?Math.trunc(index/2):null})});
  }
  static custom(options:ListViewCustomOptions):ListView{return new ListView(options);}
  protected override get childLayoutCacheExtent():ScrollCacheExtent|null{return this.childPolicy!=='legacy'&&this.childPolicy.mode==='bounded'?ScrollCacheExtent.pixels(0):super.childLayoutCacheExtent;}
  buildChildLayout(_context:BuildContext):Widget{if(this.extentIndex!==null)return new SliverSectionList({delegate:this.childrenDelegate,extentIndex:this.extentIndex,metricRevision:this.metricRevision,childPolicy:this.childPolicy});if(this.itemExtent!==null)return new SliverFixedExtentList({delegate:this.childrenDelegate,itemExtent:this.itemExtent,childPolicy:this.childPolicy});if(this.itemExtentBuilder!==null)return new SliverVariedExtentList({delegate:this.childrenDelegate,itemExtentBuilder:this.itemExtentBuilder});if(this.prototypeItem!==null)return new SliverPrototypeExtentList({delegate:this.childrenDelegate,prototypeItem:this.prototypeItem});return new SliverList({delegate:this.childrenDelegate});}
}
export interface GridViewOptions extends BoxScrollViewOptions,ChildDecorationOptions {readonly children?:readonly Widget[];readonly gridDelegate:SliverGridDelegate}
export interface GridViewBuilderOptions extends Omit<GridViewOptions,'children'> {readonly itemBuilder:NullableIndexedWidgetBuilder;readonly itemCount?:number|null;readonly findChildIndexCallback?:ChildIndexGetter|null}
export interface GridViewCustomOptions extends Omit<GridViewOptions,'children'|keyof ChildDecorationOptions> {readonly childrenDelegate:SliverChildDelegate}
interface GridTileOptions {readonly mainAxisSpacing?:number;readonly crossAxisSpacing?:number;readonly childAspectRatio?:number;readonly mainAxisExtent?:number|null}
export interface GridViewCountOptions extends Omit<GridViewOptions,'gridDelegate'>,GridTileOptions {readonly crossAxisCount:number}
export interface GridViewExtentOptions extends Omit<GridViewOptions,'gridDelegate'>,GridTileOptions {readonly maxCrossAxisExtent:number}
export class GridView extends BoxScrollView {
  readonly gridDelegate:SliverGridDelegate;readonly childrenDelegate:SliverChildDelegate;
  constructor({gridDelegate,children=[],childrenDelegate,addAutomaticKeepAlives=true,addRepaintBoundaries=true,addSemanticIndexes=true,semanticChildCount=null,...options}:GridViewOptions&{readonly childrenDelegate?:SliverChildDelegate}){super({...options,semanticChildCount:semanticChildCount??(childrenDelegate===undefined?children.length:null)});this.gridDelegate=gridDelegate;this.childrenDelegate=childrenDelegate??new SliverChildListDelegate(children,{addAutomaticKeepAlives,addRepaintBoundaries,addSemanticIndexes});protect(this,['gridDelegate','childrenDelegate']);}
  static builder({itemBuilder,itemCount=null,findChildIndexCallback=null,addAutomaticKeepAlives=true,addRepaintBoundaries=true,addSemanticIndexes=true,semanticChildCount=null,...options}:GridViewBuilderOptions):GridView{return new GridView({...options,semanticChildCount:semanticChildCount??itemCount,childrenDelegate:new SliverChildBuilderDelegate(itemBuilder,{childCount:itemCount,findChildIndexCallback,addAutomaticKeepAlives,addRepaintBoundaries,addSemanticIndexes})});}
  static custom(options:GridViewCustomOptions):GridView{return new GridView(options);}
  static count({crossAxisCount,mainAxisSpacing=0,crossAxisSpacing=0,childAspectRatio=1,mainAxisExtent=null,...options}:GridViewCountOptions):GridView{return new GridView({...options,gridDelegate:new SliverGridDelegateWithFixedCrossAxisCount({crossAxisCount,mainAxisSpacing,crossAxisSpacing,childAspectRatio,mainAxisExtent})});}
  static extent({maxCrossAxisExtent,mainAxisSpacing=0,crossAxisSpacing=0,childAspectRatio=1,mainAxisExtent=null,...options}:GridViewExtentOptions):GridView{return new GridView({...options,gridDelegate:new SliverGridDelegateWithMaxCrossAxisExtent({maxCrossAxisExtent,mainAxisSpacing,crossAxisSpacing,childAspectRatio,mainAxisExtent})});}
  buildChildLayout(_context:BuildContext):Widget{return new SliverGrid({delegate:this.childrenDelegate,gridDelegate:this.gridDelegate});}
}
