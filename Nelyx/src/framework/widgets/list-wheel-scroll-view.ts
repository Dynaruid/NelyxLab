// SPDX-License-Identifier: BSD-3-Clause
// Finite compatibility policy over the complete generated source wheel Widget/renderer.
import {invariant} from '../../foundation/errors.ts';
import {Key,ValueKey,sameKey} from '../../foundation/key.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import {StatefulWidget,State,Element} from './framework.ts';
import type {Widget,BuildContext,WidgetOptions} from './framework.ts';
import {ScrollController} from './scroll-controller.ts';
import {SourceFixedExtentScrollController} from './list-wheel-controller.generated.ts';
import {SourceListWheelChildDelegate,SourceListWheelChildBuilderDelegate,SourceListWheelChildLoopingListDelegate} from './list-wheel-delegate.generated.ts';
export {SourceListWheelChildDelegate as ListWheelChildDelegate,SourceListWheelChildBuilderDelegate as ListWheelChildBuilderDelegate,SourceListWheelChildListDelegate as ListWheelChildListDelegate,SourceListWheelChildLoopingListDelegate as ListWheelChildLoopingListDelegate} from './list-wheel-delegate.generated.ts';
import {SourceWheelPosition} from './list-wheel-controller-adapter.ts';
export {SourceFixedExtentMetrics as FixedExtentMetrics} from './list-wheel-position.generated.ts';
import {SourceFixedExtentScrollPhysics} from './list-wheel-physics.generated.ts';
import type {ScrollPosition} from './scroll-position.ts';
import {ScrollMetricsNotification} from './scroll-position.ts';
import type {ScrollContext} from './scroll-context.ts';
import {ScrollPhysics} from './scroll-physics.ts';
import type {ScrollPhysicsOptions} from './scroll-physics.ts';
import {Curves} from '../animation/curves.ts';
import type {Curve} from '../animation/curves.ts';
import {LayoutBuilder} from './layout-builder.ts';
import type {ChildIndexGetter} from './scroll-delegate.ts';
import {SizedBox,Stack,Positioned,ColoredBox,IndexedSemantics} from './basic.ts';
import {IgnorePointer} from './pointer-blocking.ts';
import {GestureDetector} from './gesture-detector.ts';
import {HitTestBehavior} from '../rendering/pointer-listener.ts';
import {NotificationListener} from './notification-listener.ts';
import {AxisDirection} from '../painting/basic-types.ts';

import {SourceListWheelScrollView} from './list-wheel-widget.generated.ts';
import {bindWheelFacadeKeys} from './list-wheel-widget-adapter.ts';

export class FixedExtentScrollController extends SourceFixedExtentScrollController {
  constructor({itemExtent,initialItem=0,keepScrollOffset=true,debugLabel=null}:{readonly itemExtent:number;readonly initialItem?:number;readonly keepScrollOffset?:boolean;readonly debugLabel?:string|null}){invariant(Number.isFinite(itemExtent)&&itemExtent>0&&Number.isSafeInteger(initialItem)&&initialItem>=0&&initialItem*itemExtent<=Number.MAX_SAFE_INTEGER,'invalid-wheel-controller','Wheel extent/index must produce safe finite nonnegative pixels');super({initialItem,keepScrollOffset,debugLabel});this.configureWheel(itemExtent,initialItem);}
  override jumpTo(offset:number):void{invariant(Number.isFinite(offset)&&Math.abs(offset)<=Number.MAX_SAFE_INTEGER,'invalid-wheel-pixels','Wheel pixels must be finite and safe');super.jumpTo(offset);}
  override animateTo(offset:number,options:Parameters<ScrollController['animateTo']>[1]):Promise<void>{invariant(Number.isFinite(offset)&&Math.abs(offset)<=Number.MAX_SAFE_INTEGER,'invalid-wheel-pixels','Wheel pixels must be finite and safe');return super.animateTo(offset,options);}
  override jumpToItem(index:number):void{invariant(Number.isSafeInteger(index)&&index>=0&&index*this.itemExtent<=Number.MAX_SAFE_INTEGER,'invalid-wheel-index','Wheel item index must produce safe nonnegative pixels');this.ensureAlive();invariant(this.hasClients,'unattached-scroll-controller','jumpTo requires an attached scroll view');super.jumpToItem(index);}
  override animateToItem(index:number,{duration,curve=Curves.easeOut}:{readonly duration:number;readonly curve?:Curve}):Promise<void>{invariant(Number.isSafeInteger(index)&&index>=0&&index*this.itemExtent<=Number.MAX_SAFE_INTEGER,'invalid-wheel-index','Wheel item index must produce safe nonnegative pixels');this.ensureAlive();invariant(this.hasClients,'unattached-scroll-controller','animateTo requires an attached scroll view');return super.animateToItem(index,{duration,curve});}
  override attach(position:ScrollPosition):void{invariant(!this.hasClients&&position instanceof SourceWheelPosition&&position.itemExtent===this.itemExtent&&position.axisDirection===AxisDirection.down,'invalid-wheel-owner','Fixed controller requires one matching vertical wheel viewport');super.attach(position);}
  override createScrollPosition(physics:ScrollPhysics,context:ScrollContext,oldPosition:ScrollPosition|null):ScrollPosition{this.ensureAlive();return super.createScrollPosition(physics,context,oldPosition);}
  override dispose():void{invariant(!this.hasClients,'live-wheel-controller','Unmount the wheel before disposing its controller');super.dispose();}
}
export class FixedExtentScrollPhysics extends SourceFixedExtentScrollPhysics {
  constructor(options:ScrollPhysicsOptions={}){super(options);}
  override applyTo(ancestor:ScrollPhysics|null):FixedExtentScrollPhysics{return new FixedExtentScrollPhysics({parent:this.buildParent(ancestor)});}
  override get allowUserScrolling():boolean{for(let policy=this.parent;policy;policy=policy.parent)if(!policy.allowUserScrolling)return false;return true;}
  override get allowImplicitScrolling():boolean{for(let policy=this.parent;policy;policy=policy.parent)if(!policy.allowImplicitScrolling)return false;return true;}
}
export interface ListWheelScrollViewOptions extends WidgetOptions {
  readonly itemExtent:number;readonly itemCount:number;readonly itemBuilder:(context:BuildContext,index:number)=>Widget;
  readonly controller?:FixedExtentScrollController|null;readonly onSelectedItemChanged?:((index:number)=>void)|null;
  readonly physics?:ScrollPhysics|null;readonly diameterRatio?:number;readonly perspective?:number;readonly cacheExtent?:number|null;
  readonly selectionOverlay?:Widget|null;readonly findChildIndexCallback?:ChildIndexGetter|null;readonly restorationId?:string|null;
}
/** Wheel items are display content. The viewport owns drag/wheel/tap-to-pick; child input is ignored. */
export class ListWheelScrollView extends StatefulWidget {
  private delegateOverride:SourceListWheelChildDelegate|null=null;
  /** A finite host viewport. Unbounded delegates require an explicit itemCount. */
  static useDelegate({childDelegate,itemCount,...options}:Omit<ListWheelScrollViewOptions,'itemBuilder'|'itemCount'>&{readonly childDelegate:SourceListWheelChildDelegate;readonly itemCount?:number}):ListWheelScrollView {
    invariant(childDelegate instanceof SourceListWheelChildDelegate,'invalid-wheel-delegate','Wheel requires a source child delegate');
    const estimated=childDelegate.estimatedChildCount,count=itemCount??estimated;
    invariant(count!==null&&Number.isSafeInteger(count)&&count>0&&(estimated===null||count===estimated),'invalid-wheel-delegate-count','Wheel requires a positive finite count matching a bounded delegate');
    const widget=new ListWheelScrollView({...options,itemCount:count,itemBuilder:(context,index)=>{
      const built=childDelegate.build(context,index);
      invariant(built instanceof IndexedSemantics&&built.child!==undefined,'invalid-wheel-source-child','Wheel delegate must supply each item in its finite range');
      return built.child;
    }});
    widget.delegateOverride=childDelegate;return widget;
  }
  get childDelegate():SourceListWheelChildDelegate{return this.delegateOverride??new SourceListWheelChildBuilderDelegate({builder:this.itemBuilder,childCount:this.itemCount});}
  readonly itemExtent:number;readonly itemCount:number;readonly itemBuilder:ListWheelScrollViewOptions['itemBuilder'];readonly controller:FixedExtentScrollController|null;readonly onSelectedItemChanged:ListWheelScrollViewOptions['onSelectedItemChanged'];
  readonly physics:ScrollPhysics|null;readonly diameterRatio:number;readonly perspective:number;readonly cacheExtent:number|null;readonly selectionOverlay:Widget|null;readonly findChildIndexCallback:ChildIndexGetter|null;readonly restorationId:string|null;
  constructor({itemExtent,itemCount,itemBuilder,controller=null,onSelectedItemChanged=null,physics=null,diameterRatio=2,perspective=.003,cacheExtent=null,selectionOverlay=new ColoredBox({color:0x223367d6}),findChildIndexCallback=null,restorationId=null,key=null}:ListWheelScrollViewOptions){super(key);invariant(Number.isFinite(itemExtent)&&itemExtent>0&&Number.isSafeInteger(itemCount)&&itemCount>0&&itemExtent*itemCount<=Number.MAX_SAFE_INTEGER,'invalid-wheel-extent','Wheel count/extent must form a positive safe range');invariant(typeof itemBuilder==='function'&&(onSelectedItemChanged===null||typeof onSelectedItemChanged==='function'),'invalid-wheel-builder','Wheel requires a builder and optional selection callback');invariant(controller===null||controller.itemExtent===itemExtent&&controller.initialItem<itemCount,'wheel-controller-extent','Wheel controller extent/initial index must match its model');invariant(Number.isFinite(diameterRatio)&&diameterRatio>=2&&Number.isFinite(perspective)&&perspective>0&&perspective<=.01&&(cacheExtent===null||Number.isFinite(cacheExtent)&&cacheExtent>=0),'invalid-wheel-projection','Wheel diameter ratio must be at least2, perspective0..01 and cache nonnegative');this.itemExtent=itemExtent;this.itemCount=itemCount;this.itemBuilder=itemBuilder;this.controller=controller;this.onSelectedItemChanged=onSelectedItemChanged;this.physics=physics;this.diameterRatio=diameterRatio;this.perspective=perspective;this.cacheExtent=cacheExtent;this.selectionOverlay=selectionOverlay;this.findChildIndexCallback=findChildIndexCallback;this.restorationId=restorationId;}
  createState():State<ListWheelScrollView>{return new _ListWheelState();}
}
const wheelKeyType=Object.freeze({wheelChild:true}),keyEquals=(a:Key,b:Key)=>sameKey(a,b),keyHash=(key:Key)=>key.hashCode;
class _ListWheelState extends State<ListWheelScrollView> {
  private owned:FixedExtentScrollController|null=null;private selected=0;private queued=false;private readonly lifetime:{current:_ListWheelState|null}={current:this};
  private get controller():FixedExtentScrollController{return this.widget.controller??this.owned!;}
  private get live():boolean{return this.mounted&&(this.context as Element).active;}
  override initState():void{super.initState();if(this.widget.controller===null)this.owned=new FixedExtentScrollController({itemExtent:this.widget.itemExtent});this.selected=this.controller.initialItem;this.controller.addListener(this.changed);}
  private readonly changed=()=>{if(!this.live||!this.controller.hasClients)return;const index=Math.min(this.widget.itemCount-1,this.controller.selectedItem);if(index===this.selected)return;this.selected=index;if(this.queued)return;this.queued=true;const token=this.lifetime;void Promise.resolve().then(()=>{const state=token.current;if(!state)return;state.queued=false;if(!state.live)return;const callback=state.widget.onSelectedItemChanged,selected=state.selected,report=state.context.services.reportError??(exception=>FlutterError.reportError(new FlutterErrorDetails({exception,library:'widgets wheel'})));try{callback?.(state.widget.childDelegate.trueIndexOf(selected));}catch(error){report(error);}});};
  override didUpdateWidget(old:ListWheelScrollView):void{super.didUpdateWidget(old);invariant(old.controller===this.widget.controller&&old.itemExtent===this.widget.itemExtent,'changed-wheel-controller','Use a new Widget key and matching controller when changing fixed extent/controller');this.changed();}
  build(_context:BuildContext):Widget{return new LayoutBuilder((_context,constraints)=>{const height=constraints.maxHeight;invariant(Number.isFinite(height)&&height>=this.widget.itemExtent&&Number.isFinite(constraints.maxWidth),'unbounded-wheel','Wheel needs a finite viewport at least one item high');invariant(Math.min(this.widget.itemCount,Math.ceil((height+2*(this.widget.cacheExtent??250))/this.widget.itemExtent)+4)<=2048,'oversize-wheel-density','Wheel viewport/cache would exceed2048 live rows; increase item extent or reduce cache');const padding=(height-this.widget.itemExtent)/2,radius=height*this.widget.diameterRatio/2;
    const delegate=new _FiniteWheelDelegate(this.widget.childDelegate,this.widget.itemCount,constraints.maxWidth,this.widget.itemExtent,this.widget.findChildIndexCallback);
    const wheel=SourceListWheelScrollView.useDelegate({controller:this.controller,itemExtent:this.widget.itemExtent,childDelegate:delegate,physics:new FixedExtentScrollPhysics({parent:this.widget.physics}),diameterRatio:this.widget.diameterRatio,perspective:this.widget.perspective,restorationId:this.widget.restorationId});
    return new NotificationListener({notificationType:ScrollMetricsNotification,onNotification:()=>{this.changed();return false;},child:new GestureDetector(new Stack([wheel,...(this.widget.selectionOverlay===null?[]:[new Positioned(new IgnorePointer(this.widget.selectionOverlay),{left:0,right:0,top:padding,height:this.widget.itemExtent})])]),{behavior:HitTestBehavior.opaque,onTapUp:details=>{if(!this.live||!this.controller.hasClients||!this.controller.position.physics.allowUserScrolling)return;const ratio=Math.max(-1,Math.min(1,(details.localPosition.dy-height/2)/radius)),delta=Math.asin(ratio)*radius,index=Math.min(this.widget.itemCount-1,Math.max(0,Math.round((this.controller.offset+delta)/this.widget.itemExtent))),token=this.lifetime;void this.controller.animateToItem(index,{duration:160,curve:Curves.easeOut}).catch(error=>{const state=token.current;if(state?.live)(state.context.services.reportError??(exception=>FlutterError.reportError(new FlutterErrorDetails({exception,library:'widgets wheel'}))))(error);});}})});});}
  override dispose():void{this.lifetime.current=null;this.controller.removeListener(this.changed);try{this.owned?.dispose();}finally{super.dispose();}}
}
/** Source algorithms own the wheel; this wrapper retains finite and display-only facade policy. */
class _FiniteWheelDelegate extends SourceListWheelChildDelegate {
  constructor(private readonly source:SourceListWheelChildDelegate,private readonly count:number,private readonly width:number,private readonly extent:number,findIndex:ChildIndexGetter|null){super();if(findIndex!==null)bindWheelFacadeKeys(this,key=>{const index=key instanceof ValueKey&&key.typeToken===wheelKeyType&&key.value instanceof Key?findIndex(key.value):null;invariant(index===null||Number.isSafeInteger(index)&&index>=0&&index<this.count,'invalid-remapped-wheel-index','Remapped wheel index must belong to its finite model');return index;});}
  override get estimatedChildCount():number{return this.count;}
  override trueIndexOf(index:number):number{return this.source.trueIndexOf(index);}
  override shouldRebuild(_old:SourceListWheelChildDelegate):boolean{return true;}
  override build(context:BuildContext,index:number):Widget|null{if(index<0||index>=this.count)return null;const child=this.source.build(context,index);invariant(child instanceof IndexedSemantics&&child.child!==undefined,'invalid-wheel-source-child','Wheel source delegate must retain every item and semantic index in its finite range');const content=child.child,key=content.key===null||this.source instanceof SourceListWheelChildLoopingListDelegate?new ValueKey(index,wheelKeyType):new ValueKey(content.key,wheelKeyType,keyEquals,keyHash);return new SizedBox(this.width,this.extent,new IgnorePointer(child),key);}
}
