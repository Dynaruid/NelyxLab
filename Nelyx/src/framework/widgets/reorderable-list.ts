// SPDX-License-Identifier: BSD-3-Clause
// Nelyx live keyed placement: editor subtrees stay in their list context; feedback is decorative.
import {Key,KeyMap,ValueKey,sameKey} from '../../foundation/key.ts';
import {invariant} from '../../foundation/errors.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import {StatefulWidget,State,StatelessWidget,InheritedWidget,Element,LeafRenderObjectWidget} from './framework.ts';
import type {Widget,BuildContext,WidgetOptions} from './framework.ts';
import {AutomaticKeepAliveClientMixin} from './automatic-keep-alive.ts';
import {ScrollController} from './scroll-controller.ts';
import {Scrollable,ScrollableState} from './scrollable.ts';
import {ListView} from './scroll-view.ts';
import type {ScrollPhysics} from './scroll-physics.ts';
import {EdgeDraggingAutoScroller} from './scrollable-helpers.ts';
import {Axis,axisDirectionIsReversed} from '../painting/basic-types.ts';
import {GestureDetector} from './gesture-detector.ts';
import type {GestureOptions} from './gesture-detector.ts';
import {Listener} from './listener.ts';
import {Stack,Positioned} from './basic.ts';
import {IgnorePointer} from './pointer-blocking.ts';
import {RenderBox} from '../rendering/object.ts';
import type {BoxConstraints} from '../rendering/constraints.ts';
import {MatrixUtils} from '../painting/matrix-utils.ts';
import {Matrix4} from '../../math/matrix4.ts';
import {Rect} from '../../ui/rect.ts';
import {Offset} from '../../ui/offset.ts';
import type {Offset as Point,Size} from '../../ui/geometry.ts';
import {Paint} from '../../ui/paint.ts';
import type {PaintingContext} from '../painting/context.ts';
import {tickerScheduler} from './ticker-scheduler.ts';

export interface ReorderableListViewOptions extends WidgetOptions {
  readonly children:readonly Widget[];
  /** Insertion slot in the original list; when oldIndex < newIndex, subtract one after removal. */
  readonly onReorder:(oldIndex:number,newIndex:number)=>void;
  readonly controller?:ScrollController|null;readonly scrollDirection?:Axis;readonly reverse?:boolean;
  readonly physics?:ScrollPhysics|null;readonly itemExtent?:number|null;readonly autoScrollVelocityScalar?:number;
  readonly feedbackColor?:number;
}
export class ReorderableListView extends StatefulWidget {
  readonly children:readonly Widget[];readonly onReorder:ReorderableListViewOptions['onReorder'];readonly controller:ScrollController|null;
  readonly scrollDirection:Axis;readonly reverse:boolean;readonly physics:ScrollPhysics|null;readonly itemExtent:number|null;
  readonly autoScrollVelocityScalar:number;readonly feedbackColor:number;
  constructor({children,onReorder,controller=null,scrollDirection=Axis.vertical,reverse=false,physics=null,itemExtent=null,autoScrollVelocityScalar=20,feedbackColor=0x663367d6,key=null}:ReorderableListViewOptions){
    super(key);invariant(typeof onReorder==='function','missing-reorder-callback','Reordering requires a model callback');
    invariant(scrollDirection===Axis.vertical||scrollDirection===Axis.horizontal,'invalid-reorder-axis','Reorder axis must be horizontal or vertical');
    invariant(Number.isFinite(autoScrollVelocityScalar)&&autoScrollVelocityScalar>0,'invalid-auto-scroll-velocity','Edge scroll velocity must be positive');
    invariant(itemExtent===null||Number.isFinite(itemExtent)&&itemExtent>0,'invalid-reorder-extent','Reorder extent must be positive');
    const keys=new KeyMap<boolean>();for(const child of children){invariant(child.key instanceof Key,'missing-reorder-key','Every reorderable child needs a stable key');invariant(!keys.has(child.key),'duplicate-reorder-key','Reorderable child keys must be unique');keys.set(child.key,true);}
    this.children=Object.freeze([...children]);this.onReorder=onReorder;this.controller=controller;this.scrollDirection=scrollDirection;this.reverse=reverse;this.physics=physics;this.itemExtent=itemExtent;this.autoScrollVelocityScalar=autoScrollVelocityScalar;this.feedbackColor=feedbackColor;
  }
  createState():ReorderableListViewState{return new ReorderableListViewState();}
}
interface DragSession {readonly key:Key;readonly oldIndex:number;targetIndex:number;readonly grab:Point;readonly size:Size;pointer:Point;readonly metrics:string;readonly reversed:boolean}
const itemKeyType=Object.freeze({reorderItem:true});
const equalKeys=(a:Key,b:Key)=>sameKey(a,b),hashKey=(key:Key)=>key.hashCode;
export class ReorderableListViewState extends State<ReorderableListView> {
  private owned:ScrollController|null=null;private items=new KeyMap<_ReorderItemState>();private content=new KeyMap<Widget>();
  private order:Key[]=[];private indices=new KeyMap<number>();private body:Widget|null=null;private drag:DragSession|null=null;
  private autoScroller:EdgeDraggingAutoScroller|null=null;private revision=0;private scheduled=false;
  private readonly lifetime:{current:ReorderableListViewState|null}={current:this};
  get isReordering():boolean{return this.drag!==null;}get draggedKey():Key|null{return this.drag?.key??null;}
  get previewOrder():readonly Key[]{return Object.freeze([...this.order]);}
  get scrollController():ScrollController{return this.widget.controller??this.owned!;}
  private get live():boolean{return this.mounted&&(this.context as Element).active;}
  override initState():void{super.initState();if(this.widget.controller===null)this.owned=new ScrollController();this.resetContent();}
  private indexOrder():void{this.indices.clear();this.order.forEach((key,index)=>this.indices.set(key,index));this.body=null;}
  private resetContent():void{this.content.clear();this.order=this.widget.children.map(child=>{this.content.set(child.key!,child);return child.key!;});this.indexOrder();}
  override didUpdateWidget(old:ReorderableListView):void{
    super.didUpdateWidget(old);invariant(old.controller===this.widget.controller,'changed-reorder-controller','Use a new Widget key when changing a reorder controller');
    const sameOrder=old.children.length===this.widget.children.length&&old.children.every((child,index)=>sameKey(child.key,this.widget.children[index]!.key));
    if(!sameOrder||old.scrollDirection!==this.widget.scrollDirection||old.reverse!==this.widget.reverse){this.clear(false);this.resetContent();}
    else{this.content.clear();for(const child of this.widget.children)this.content.set(child.key!,child);this.body=null;}
    if(old.autoScrollVelocityScalar!==this.widget.autoScrollVelocityScalar||old.physics!==this.widget.physics){this.autoScroller?.stopAutoScroll();this.autoScroller=null;}
  }
  private metrics():string{const m=this.context.services.readMetrics();return `${m.logicalWidth}/${m.logicalHeight}/${m.scale}/${m.viewportGeneration}`;}
  private axis(point:Point):number{return this.widget.scrollDirection===Axis.vertical?point.y:point.x;}
  private rect(item:_ReorderItemState):Rect|null{if(!item.mounted||!(item.context as Element).active)return null;const box=item.context.findRenderObject();if(!(box instanceof RenderBox)||!box.attached||!box.hasSize)return null;const rect=MatrixUtils.transformRect(Matrix4.fromList(box.getTransformTo(null)),Rect.fromLTWH(0,0,box.size.width,box.size.height));return rect.isFinite&&!rect.isEmpty?rect:null;}
  _register(item:_ReorderItemState):void{this.items.set(item.widget.itemKey,item);}
  _unregister(item:_ReorderItemState):void{if(this.items.get(item.widget.itemKey)===item)this.items.delete(item.widget.itemKey);}
  _isDragged(key:Key):boolean{return this.drag!==null&&sameKey(this.drag.key,key);}
  _start(item:_ReorderItemState,point:Point):void{
    if(!this.live||this.drag!==null)return;const rect=this.rect(item),index=this.indices.get(item.widget.itemKey);if(rect===null||index===undefined)return;
    const scrollable=Scrollable.of(item.context);invariant([...this.scrollController.positions].length===1&&scrollable.position===this.scrollController.position,'reorder-scroll-owner','Reorder requires its one body Scrollable');
    this.revision++;this.drag={key:item.widget.itemKey,oldIndex:index,targetIndex:index,grab:new Offset(point.x-rect.left,point.y-rect.top),size:rect.size,pointer:point,metrics:this.metrics(),reversed:axisDirectionIsReversed(scrollable.axisDirection)};
    this.autoScroller=new EdgeDraggingAutoScroller(scrollable,{velocityScalar:this.widget.autoScrollVelocityScalar,onScrollViewScrolled:()=>this.schedulePlacement()});
    item.dragChanged();this.setState(()=>{});this.updatePlacement();
  }
  _move(point:Point):void{if(!this.drag||!this.live)return;this.drag.pointer=point;this.updatePlacement();}
  private feedback():Rect|null{const d=this.drag;return d?Rect.fromLTWH(d.pointer.x-d.grab.x,d.pointer.y-d.grab.y,d.size.width,d.size.height):null;}
  private schedulePlacement():void{
    if(!this.live||!this.drag||this.scheduled)return;this.scheduled=true;const token=this.lifetime,revision=this.revision;
    tickerScheduler(this.context).addPostFrameCallback(()=>{const state=token.current;if(!state)return;state.scheduled=false;if(state.live&&state.revision===revision&&state.drag)state.updatePlacement();},{debugLabel:'reorder placement'});
    this.setState(()=>{});
  }
  private updatePlacement():void{
    const d=this.drag;if(!d||!this.live)return;if(this.metrics()!==d.metrics){this._cancel();return;}
    const feedback=this.feedback()!,center=this.widget.scrollDirection===Axis.vertical?feedback.center.y:feedback.center.x,sign=d.reversed?-1:1;
    let target=d.targetIndex;
    for(const item of this.items.values()){if(sameKey(item.widget.itemKey,d.key))continue;const index=this.indices.get(item.widget.itemKey),rect=this.rect(item);if(index===undefined||rect===null)continue;const value=this.widget.scrollDirection===Axis.vertical?rect.center.y:rect.center.x;
      if(index>d.targetIndex&&center*sign>value*sign)target=Math.max(target,index);else if(index<d.targetIndex&&center*sign<value*sign)target=Math.min(target,index);
    }
    if(target!==d.targetIndex){const [key]=this.order.splice(d.targetIndex,1);this.order.splice(target,0,key!);d.targetIndex=target;this.indexOrder();this.schedulePlacement();}
    // Pointer-sized target remains bounded even when the row is larger than its viewport.
    this.autoScroller?.startAutoScrollIfNecessary(Rect.fromLTWH(d.pointer.x-1,d.pointer.y-1,2,2));this.setState(()=>{});
  }
  private clear(notify:boolean):void{const key=this.drag?.key;this.revision++;this.drag=null;this.scheduled=false;this.autoScroller?.stopAutoScroll();this.autoScroller=null;this.resetContent();if(key&&notify)this.items.get(key)?.dragChanged();if(notify&&this.live)this.setState(()=>{});}
  _cancel():void{this.clear(true);}
  _end():void{
    const drag=this.drag;if(!drag||!this.live)return;const old=drag.oldIndex,slot=drag.targetIndex>old?drag.targetIndex+1:drag.targetIndex,changed=drag.targetIndex!==old,callback=this.widget.onReorder,report=this.context.services.reportError??(error=>FlutterError.reportError(new FlutterErrorDetails({exception:error,library:'widgets reorder'})));
    this.clear(true);const revision=this.revision,token=this.lifetime;
    // Raw PointerCancel is delivered in the same dispatch and invalidates this admission.
    void Promise.resolve().then(()=>{const state=token.current;if(state?.live&&state.revision===revision&&changed)callback(old,slot);}).catch(error=>report(error));
  }
  /** Same pre-removal insertion-slot convention as onReorder; useful for application keyboard actions. */
  reorder(oldIndex:number,newIndex:number):void{invariant(this.live&&!this.drag,'reorder-admission','Programmatic reorder needs an active idle list');const count=this.order.length;invariant(Number.isSafeInteger(oldIndex)&&oldIndex>=0&&oldIndex<count&&Number.isSafeInteger(newIndex)&&newIndex>=0&&newIndex<=count,'invalid-reorder-index','Invalid reorder index');if(newIndex===oldIndex||newIndex===oldIndex+1)return;this.widget.onReorder(oldIndex,newIndex);}
  build(_context:BuildContext):Widget{
    this.body??=new ListView({controller:this.scrollController,primary:false,scrollDirection:this.widget.scrollDirection,reverse:this.widget.reverse,physics:this.widget.physics,itemExtent:this.widget.itemExtent,children:this.order.map(key=>new _ReorderItem(this,key,this.content.get(key)!,new ValueKey(key,itemKeyType,equalKeys,hashKey)))});
    return new Stack([this.body,new Positioned(new IgnorePointer(new _ReorderFeedback(this.feedback(),this.widget.feedbackColor)),{left:0,top:0,right:0,bottom:0})]);
  }
  override deactivate():void{this.clear(false);super.deactivate();}
  override dispose():void{this.lifetime.current=null;this.autoScroller?.stopAutoScroll();this.autoScroller=null;this.items.clear();try{this.owned?.dispose();}finally{super.dispose();}}
}
class _ReorderItem extends StatefulWidget {
  constructor(readonly owner:ReorderableListViewState,readonly itemKey:Key,readonly child:Widget,key:Key){super(key);}
  createState():_ReorderItemState{return new _ReorderItemState();}
}
class _ReorderItemState extends AutomaticKeepAliveClientMixin<_ReorderItem> {
  protected get wantKeepAlive():boolean{return this.widget.owner._isDragged(this.widget.itemKey);}
  override initState():void{super.initState();this.widget.owner._register(this);}
  override didUpdateWidget(old:_ReorderItem):void{super.didUpdateWidget(old);this.updateKeepAlive();}
  dragChanged():void{if(this.mounted&&(this.context as Element).active){this.updateKeepAlive();this.setState(()=>{});}}
  build(context:BuildContext):Widget{super.build(context);return new _ReorderScope(this,this.widget.child);}
  override dispose():void{try{this.widget.owner._unregister(this);}finally{super.dispose();}}
}
class _ReorderScope extends InheritedWidget {
  constructor(readonly item:_ReorderItemState,child:Widget){super(child);}
  updateShouldNotify(old:this):boolean{return old.item!==this.item;}
}
export interface ReorderableDragHandleOptions extends WidgetOptions {readonly child:Widget;readonly enabled?:boolean}
/** Place a handle inside each keyed child. Dragging elsewhere retains normal list/editor gestures. */
export class ReorderableDragHandle extends StatelessWidget {
  readonly child:Widget;readonly enabled:boolean;
  constructor({child,enabled=true,key=null}:ReorderableDragHandleOptions){super(key);this.child=child;this.enabled=enabled;}
  build(context:BuildContext):Widget{
    const scope=context.dependOn(_ReorderScope),owner=scope.item.widget.owner;if(!this.enabled)return this.child;
    const options:GestureOptions=owner.widget.scrollDirection===Axis.vertical?{onVerticalDragStart:details=>owner._start(scope.item,details.globalPosition),onVerticalDragUpdate:details=>owner._move(details.globalPosition),onVerticalDragEnd:()=>owner._end(),onVerticalDragCancel:()=>owner._cancel()}:{onHorizontalDragStart:details=>owner._start(scope.item,details.globalPosition),onHorizontalDragUpdate:details=>owner._move(details.globalPosition),onHorizontalDragEnd:()=>owner._end(),onHorizontalDragCancel:()=>owner._cancel()};
    return new Listener(new GestureDetector(this.child,options),{onPointerCancel:()=>owner._cancel()});
  }
}
class _ReorderFeedback extends LeafRenderObjectWidget {
  constructor(readonly target:Rect|null,readonly color:number){super();}
  createRenderObject():_RenderReorderFeedback{return new _RenderReorderFeedback(this.target,this.color);}
  override updateRenderObject(_context:BuildContext,render:RenderBox):void{(render as _RenderReorderFeedback).configure(this.target,this.color);}
}
class _RenderReorderFeedback extends RenderBox {
  constructor(private target:Rect|null,private color:number){super();}
  configure(target:Rect|null,color:number):void{this.target=target;this.color=color;this.markNeedsPaint();}
  protected override performLayout(constraints:BoxConstraints):Size{return constraints.constrain({width:0,height:0});}
  override paint(context:PaintingContext):void{if(this.target===null)return;const a=this.globalToLocal(this.target.topLeft),b=this.globalToLocal(this.target.bottomRight),rect=Rect.fromPoints(a,b).intersect(Rect.fromLTWH(0,0,this.size.width,this.size.height));if(rect.isEmpty||!rect.isFinite)return;context.drawRect(rect,new Paint({color:this.color}));}
}
