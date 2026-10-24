// SPDX-License-Identifier: BSD-3-Clause
// Nelyx leading-edge vertical pull adapter; async application work remains application-owned.
import {invariant} from '../../foundation/errors.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import {State,StatefulWidget,Element} from './framework.ts';
import type {Widget,BuildContext,WidgetOptions} from './framework.ts';
import {RefreshController} from './refresh-controller.ts';
import type {RefreshAttachment,RefreshCallback,RefreshSnapshot,RefreshResult} from './refresh-controller.ts';
import {NotificationListener} from './notification-listener.ts';
import {ScrollNotification,ScrollStartNotification,ScrollUpdateNotification,ScrollEndNotification,OverscrollNotification} from './scroll-notification.ts';
import {Axis,AxisDirection} from '../painting/basic-types.ts';
import {Stack,Positioned,Align,SizedBox,ColoredBox} from './basic.ts';
import {LayoutBuilder} from './layout-builder.ts';
import {Listener} from './listener.ts';
import {IgnorePointer} from './pointer-blocking.ts';
import {Alignment} from '../painting/alignment.ts';
export {RefreshController};
export {RefreshCancellationSignal} from './refresh-controller.ts';
export type {RefreshCallback,RefreshSnapshot,RefreshResult,RefreshPhase} from './refresh-controller.ts';
export interface RefreshIndicatorOptions extends WidgetOptions {
  readonly child:Widget;
  readonly onRefresh:RefreshCallback;
  readonly controller?:RefreshController|null;
  readonly triggerDistance?:number;
  readonly gestureEnabled?:boolean;
  readonly notificationPredicate?:(notification:ScrollNotification)=>boolean;
  readonly indicatorBuilder?:(context:BuildContext,snapshot:RefreshSnapshot)=>Widget;
  readonly edge?:'auto'|'top'|'bottom';
  readonly color?:number;
  readonly errorColor?:number;
}
/** Touch/trackpad drag notifications only; pointer wheel/programmatic deltas never arm refresh. */
export class RefreshIndicator extends StatefulWidget {
  readonly child:Widget;readonly onRefresh:RefreshCallback;readonly controller:RefreshController|null;readonly triggerDistance:number;readonly gestureEnabled:boolean;readonly notificationPredicate:(notification:ScrollNotification)=>boolean;readonly indicatorBuilder:RefreshIndicatorOptions['indicatorBuilder'];readonly edge:'auto'|'top'|'bottom';readonly color:number;readonly errorColor:number;
  constructor({child,onRefresh,controller=null,triggerDistance=80,gestureEnabled=true,notificationPredicate=notification=>notification.depth===0,indicatorBuilder,edge='auto',color=0xff448aff,errorColor=0xffba1a1a,...options}:RefreshIndicatorOptions){
    super(options.key??null);invariant(typeof onRefresh==='function'&&typeof notificationPredicate==='function'&&(indicatorBuilder===undefined||typeof indicatorBuilder==='function'),'invalid-refresh-callback','Refresh callbacks must be functions');invariant(Number.isFinite(triggerDistance)&&triggerDistance>0&&typeof gestureEnabled==='boolean'&&['auto','top','bottom'].includes(edge),'invalid-refresh-configuration','Refresh requires positive finite trigger distance, boolean gesture mode and a valid edge');for(const value of [color,errorColor])invariant(Number.isSafeInteger(value)&&value>=0&&value<=0xffffffff,'invalid-refresh-color','Refresh colors must be ARGB32');
    this.child=child;this.onRefresh=onRefresh;this.controller=controller;this.triggerDistance=triggerDistance;this.gestureEnabled=gestureEnabled;this.notificationPredicate=notificationPredicate;this.indicatorBuilder=indicatorBuilder;this.edge=edge;this.color=color;this.errorColor=errorColor;
  }
  createState():RefreshIndicatorState{return new RefreshIndicatorState();}
}
export class RefreshIndicatorState extends State<RefreshIndicator> {
  private owned:RefreshController|null=null;private attachment:RefreshAttachment|undefined;private controller!:RefreshController;
  private readonly completion:{active:boolean;gestureAdmission:boolean;report:((error:unknown)=>void)|null}={active:true,gestureAdmission:false,report:null};
  private closed=false;private suspended=false;private dragging=false;private distance=0;private bottom=false;
  private readonly changed=()=>{if(!this.closed&&!this.suspended&&this.mounted&&this.context instanceof Element&&this.context.active)this.setState(()=>{});};
  override initState():void{super.initState();this.controller=this.widget.controller??(this.owned=new RefreshController());this.attachment=this.controller._attach(this.widget.onRefresh);this.controller.addListener(this.changed);}
  override didUpdateWidget(old:RefreshIndicator):void{super.didUpdateWidget(old);invariant(old.controller===this.widget.controller,'changed-refresh-controller','Use a new Widget key when changing refresh controller');this.attachment!.update(this.widget.onRefresh);if(!this.widget.gestureEnabled){this.dragging=false;this.distance=0;if(!this.controller.snapshot.pending)this.controller._setPull(0,this.widget.triggerDistance);}}
  show():Promise<RefreshResult>{return this.controller.refresh();}
  private release(commit:boolean):void{
    if(!this.dragging)return;this.dragging=false;this.distance=0;
    if(commit&&this.controller.snapshot.phase==='armed'){
      const completion=this.completion;completion.gestureAdmission=true;completion.report=this.context.services.reportError??(error=>FlutterError.reportError(new FlutterErrorDetails({exception:error,library:'widgets refresh'})));
      // This continuation retains a cleared-on-dispose token, not the Widget State/View context.
      void this.controller.refresh().then(result=>{if(result.status==='failed'&&completion.active)completion.report?.(result.error);});
      void Promise.resolve().then(()=>{completion.gestureAdmission=false;});
    }
    else if(!this.controller.snapshot.pending)this.controller._setPull(0,this.widget.triggerDistance);
  }
  private cancelGesture():void{
    if(this.closed)return;const queued=this.completion.gestureAdmission;this.completion.gestureAdmission=false;
    if(!this.dragging&&!queued)return;this.dragging=false;this.distance=0;
    // An accepted legacy drag may report end for a raw pointer cancellation. Fence only
    // this gesture's deferred refresh admission, leaving earlier application refresh work alone.
    if(queued)this.controller.cancel();else if(!this.controller.snapshot.pending)this.controller._setPull(0,this.widget.triggerDistance);
  }
  private notification(notification:ScrollNotification):boolean{
    if(this.closed||!this.widget.gestureEnabled||notification.metrics.axis!==Axis.vertical||!this.widget.notificationPredicate(notification))return false;
    this.bottom=notification.metrics.axisDirection===AxisDirection.up;
    if(notification instanceof ScrollStartNotification){this.dragging=notification.dragDetails!==null&&!this.controller.snapshot.pending&&notification.metrics.pixels<=notification.metrics.minScrollExtent;this.distance=0;if(this.dragging)this.controller._setPull(0,this.widget.triggerDistance);}
    else if(this.dragging&&notification instanceof OverscrollNotification&&notification.dragDetails!==null){this.distance=Math.max(0,this.distance-notification.overscroll);this.controller._setPull(this.distance,this.widget.triggerDistance);}
    else if(this.dragging&&notification instanceof ScrollUpdateNotification){
      if(notification.dragDetails===null)this.release(true);
      else if(notification.scrollDelta!==null){if(notification.metrics.pixels<=notification.metrics.minScrollExtent)this.distance=Math.max(0,this.distance-notification.scrollDelta);else this.distance=0;this.controller._setPull(this.distance,this.widget.triggerDistance);}
    }else if(notification instanceof ScrollEndNotification)this.release(notification.dragDetails!==null);
    return false;
  }
  override deactivate():void{this.suspended=true;this.dragging=false;this.distance=0;if(!this.controller.snapshot.pending)this.controller._setPull(0,this.widget.triggerDistance);super.deactivate();}
  override activate():void{super.activate();this.suspended=false;}
  build(context:BuildContext):Widget{
    const snapshot=this.controller.snapshot,children:Widget[]=[this.widget.child];
    if(snapshot.phase!=='idle'){
      const indicator=this.widget.indicatorBuilder?.(context,snapshot)??new LayoutBuilder((_context,constraints)=>{invariant(Number.isFinite(constraints.maxWidth),'unbounded-refresh-indicator','Refresh indicator needs bounded width');return new Align(new SizedBox(constraints.maxWidth*(snapshot.phase==='error'||snapshot.phase==='refresh'?1:snapshot.progress),3,new ColoredBox({color:snapshot.phase==='error'?this.widget.errorColor:this.widget.color})),{alignment:Alignment.centerLeft});});
      const bottom=this.widget.edge==='bottom'||this.widget.edge==='auto'&&this.bottom;children.push(new Positioned(new IgnorePointer(indicator),{left:0,right:0,...(bottom?{bottom:0}:{top:0})}));
    }
    return new Listener(new NotificationListener({notificationType:ScrollNotification,onNotification:notification=>this.notification(notification),child:new Stack(children)}),{onPointerCancel:()=>this.cancelGesture()});
  }
  override dispose():void{this.closed=true;this.completion.active=false;this.completion.gestureAdmission=false;this.completion.report=null;this.controller.removeListener(this.changed);const errors:unknown[]=[];for(const action of [()=>this.attachment?.dispose(),()=>this.owned?.dispose(),()=>super.dispose()])try{action();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Refresh Widget retirement failed');}
}
