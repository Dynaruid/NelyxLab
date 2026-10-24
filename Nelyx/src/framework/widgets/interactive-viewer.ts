// SPDX-License-Identifier: BSD-3-Clause
// Nelyx finite-content pan/uniform-scale viewer on the shared Transform/gesture pipeline.
import {ChangeNotifier} from '../../foundation/notifier.ts';
import {invariant} from '../../foundation/errors.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import {Matrix4} from '../../math/matrix4.ts';
import {Offset} from '../../ui/offset.ts';
import type {Size} from '../../ui/geometry.ts';
import {StatefulWidget,Element} from './framework.ts';
import type {Widget,WidgetOptions,BuildContext,State} from './framework.ts';
import {TickerProviderStateMixin} from './ticker-provider.ts';
import {AnimationController} from '../animation/animation-controller.ts';
import {Curves} from '../animation/curves.ts';
import type {Curve} from '../animation/curves.ts';
import {TickerCanceled} from '../animation/ticker-future.ts';
import {LayoutBuilder} from './layout-builder.ts';
import {SizedBox} from './basic.ts';
import {FiniteViewerSource,FiniteViewerTransformer} from './viewer-finite-source.ts';
import type {FiniteViewerPort} from './viewer-finite-source.ts';
import {EdgeInsets} from '../painting/edge-insets.ts';
import {Listener} from './listener.ts';
import type {ScaleStartDetails,ScaleUpdateDetails,ScaleEndDetails} from '../gestures/scale.ts';
import {RestorationOwner} from './restoration.ts';

type TransformValue={readonly scale:number;readonly x:number;readonly y:number};
function unpack(value:Matrix4):TransformValue{invariant(value instanceof Matrix4,'invalid-viewer-transform','TransformationController requires a Matrix4');const m=Array.from(value.storage);invariant(m.every(Number.isFinite)&&m[0]!>=1e-6&&m[0]!<=1e6&&m[0]===m[5]&&m[10]!>0&&m[15]===1&&[1,2,3,4,6,7,8,9,11,14].every(i=>m[i]===0)&&[m[0]!,m[12]!,m[13]!].every(n=>Math.abs(n)<=Number.MAX_SAFE_INTEGER),'unsupported-viewer-transform','Viewer requires safe finite translation and a positive uniform XY scale, without rotation/skew/perspective');return {scale:m[0]!,x:m[12]!,y:m[13]!};}
function matrix(value:TransformValue):Matrix4{return Matrix4.fromList([value.scale,0,0,0,0,value.scale,0,0,0,0,1,0,value.x,value.y,0,1]);}
function same(a:TransformValue,b:TransformValue):boolean{return a.scale===b.scale&&a.x===b.x&&a.y===b.y;}
export interface ViewerAnimationOptions{readonly duration:number;readonly curve?:Curve}
export type ViewerMotionResult={readonly status:'completed'|'cancelled'};
interface ViewerBinding{readonly token:object;readonly normalize:(value:TransformValue)=>TransformValue;readonly changed:(rebuild:boolean)=>void;readonly cancel:()=>void;readonly animate:(value:TransformValue,options:ViewerAnimationOptions)=>Promise<ViewerMotionResult>}
/** Matrix values are copied on get/set. Assign a new Matrix4 to change the viewer.
 * Public notifications coalesce after input dispatch; toScene uses the current value immediately. */
export class TransformationController extends ChangeNotifier {
  private current:TransformValue;private binding:ViewerBinding|null=null;private retired=false;private pending=false;private delivering=false;private deferredDispose=false;
  private readonly lifetime:{current:TransformationController|null}={current:this};
  constructor(value:Matrix4=Matrix4.identity()){super();this.current=unpack(value);}
  get value():Matrix4{this.ensureAlive();invariant(!this.retired,'disposed-viewer-controller','TransformationController is disposed');return matrix(this.current);}
  set value(value:Matrix4){const next=unpack(value);this.ensureAlive();invariant(!this.retired,'disposed-viewer-controller','TransformationController is disposed');this.binding?.cancel();this.replace(this.binding?.normalize(next)??next,true);}
  get scale():number{return unpack(this.value).scale;}
  toScene(viewportPoint:Offset):Offset{invariant(viewportPoint instanceof Offset&&[viewportPoint.dx,viewportPoint.dy].every(Number.isFinite),'invalid-viewer-point','Viewer scene conversion requires a finite Offset');const value=unpack(this.value);return new Offset((viewportPoint.dx-value.x)/value.scale,(viewportPoint.dy-value.y)/value.scale);}
  animateTo(value:Matrix4,options:ViewerAnimationOptions):Promise<ViewerMotionResult>{const target=unpack(value);this.ensureAlive();invariant(!this.retired&&this.binding,'unattached-viewer-controller','Viewer animation needs its mounted viewport');invariant(Number.isFinite(options.duration)&&options.duration>=0,'invalid-viewer-duration','Viewer duration must be finite and nonnegative');return this.binding.animate(this.binding.normalize(target),options);}
  /** @internal */ _bind(binding:ViewerBinding):void{this.ensureAlive();invariant(!this.retired&&(this.binding===null||this.binding.token===binding.token),'viewer-controller-in-use','TransformationController can own only one mounted viewer');this.binding=binding;}
  /** @internal */ _unbind(token:object):void{if(this.binding?.token===token)this.binding=null;}
  /** @internal */ _set(token:object,value:TransformValue,rebuild=true):void{if(this.binding?.token===token)this.replace(this.binding.normalize(value),rebuild);}
  private replace(value:TransformValue,rebuild:boolean):void{if(same(this.current,value))return;this.current=Object.freeze({...value});this.binding?.changed(rebuild);if(this.pending)return;this.pending=true;const token=this.lifetime;void Promise.resolve().then(()=>{const controller=token.current;if(!controller)return;controller.pending=false;controller.delivering=true;try{controller.notifyListeners();}finally{controller.delivering=false;if(controller.deferredDispose)controller.finishDispose();}});}
  override dispose():void{if(this.retired)return;invariant(this.binding===null,'attached-viewer-dispose','Unmount the viewer before disposing its transformation controller');this.retired=true;this.lifetime.current=null;if(this.delivering){this.deferredDispose=true;return;}this.finishDispose();}
  private finishDispose():void{super.dispose();}
}
export interface InteractiveViewerOptions extends WidgetOptions {
  readonly child:Widget;readonly transformationController?:TransformationController|null;
  /** Omit for a viewport-sized child; explicit content sizes remain finite and independent of zoom. */
  readonly contentSize?:Size|null;readonly minScale?:number;readonly maxScale?:number;readonly boundaryMargin?:EdgeInsets;
  readonly panEnabled?:boolean;readonly scaleEnabled?:boolean;readonly scaleFactor?:number;readonly inertiaEnabled?:boolean;
  readonly trackpadScrollCausesScale?:boolean;readonly restorationId?:string|null;
  readonly onInteractionStart?:((details:ScaleStartDetails)=>void)|null;
  readonly onInteractionUpdate?:((details:ScaleUpdateDetails)=>void)|null;
  readonly onInteractionEnd?:((details:ScaleEndDetails)=>void)|null;
}
/** Finite painted content with uniform XY scale, focal anchoring and bounded pan.
 * Native/HTML editor font/style scaling is a separate integration contract. */
export class InteractiveViewer extends StatefulWidget {
  readonly options:InteractiveViewerOptions;
  constructor(options:InteractiveViewerOptions){super(options.key??null);const {minScale=.5,maxScale=4,boundaryMargin=EdgeInsets.zero,contentSize=null,scaleFactor=200}=options;invariant(Number.isFinite(minScale)&&minScale>=1e-6&&Number.isFinite(maxScale)&&maxScale>=minScale&&maxScale<=1e6,'invalid-viewer-scale','Viewer scales must be ordered and within1e-6..1e6');invariant(boundaryMargin instanceof EdgeInsets&&[boundaryMargin.left,boundaryMargin.right,boundaryMargin.top,boundaryMargin.bottom].every(n=>Number.isFinite(n)&&n>=0&&n*maxScale<=Number.MAX_SAFE_INTEGER),'invalid-viewer-margin','Viewer boundary margin must be finite and nonnegative');invariant(contentSize===null||[contentSize.width,contentSize.height].every(n=>Number.isFinite(n)&&n>0&&n*maxScale<=Number.MAX_SAFE_INTEGER),'invalid-viewer-content','Viewer content must have finite positive safe dimensions');invariant(Number.isFinite(scaleFactor)&&scaleFactor>0,'invalid-viewer-wheel-scale','Wheel scaleFactor must be finite and positive');this.options=Object.freeze({...options,minScale,maxScale,boundaryMargin,contentSize:contentSize===null?null:Object.freeze({...contentSize}),scaleFactor});}
  createState():State<InteractiveViewer>{return new InteractiveViewerState();}
}
export class InteractiveViewerState extends TickerProviderStateMixin<InteractiveViewer> {
  private owned:TransformationController|null=null;private readonly token={};private suspended=false;private cancelDispatch=false;
  private viewport:Size|null=null;
  private source:FiniteViewerTransformer|null=null;
  private readonly sourcePort:FiniteViewerPort={state:null,admitted:()=>this.live,cancelled:()=>this.cancelDispatch,inertia:()=>this.widget.options.inertiaEnabled!==false};
  private motion:AnimationController|null=null;private from:TransformValue|null=null;private target:TransformValue|null=null;private revision=0;
  private readonly lifetime:{current:InteractiveViewerState|null}={current:this};
  private readonly restoration=new RestorationOwner(this,(bucket,_initial,needsRestore)=>{if(needsRestore){const value=bucket?.read<unknown>('matrix');if(value!==null&&value!==undefined){invariant(Array.isArray(value)&&value.length===16&&value.every(n=>typeof n==='number'),'invalid-viewer-restoration','Viewer restoration needs sixteen matrix numbers');this.controller._set(this.token,unpack(Matrix4.fromList(value)),false);}}});
  private get controller():TransformationController{return this.widget.options.transformationController??this.owned!;}
  private get live():boolean{return this.mounted&&!this.suspended&&(this.context as Element).active;}
  override initState():void{super.initState();if(this.widget.options.transformationController==null)this.owned=new TransformationController();this.source=new FiniteViewerTransformer(this.controller.value,value=>{this.controller._set(this.token,unpack(value),false);return this.controller.value;});this.motion=new AnimationController({vsync:this,duration:400});this.motion.addListener(this.animateFrame);this.bind();}
  private bind():void{this.controller._bind({token:this.token,normalize:v=>this.normalize(v),changed:rebuild=>{if(!this.live)return;this.source?.synchronize(this.controller.value);this.restoration.bucket?.write('matrix',Array.from(this.controller.value.storage));if(rebuild)this.setState(()=>{});},cancel:()=>this.stopMotion(),animate:(v,o)=>this.animate(v,o)});}
  override didChangeDependencies():void{super.didChangeDependencies();this.restoration.update(this.context,this.widget.options.restorationId??null);}
  override didUpdateWidget(old:InteractiveViewer):void{super.didUpdateWidget(old);invariant(old.options.transformationController===this.widget.options.transformationController,'changed-viewer-controller','Use a new Widget key when changing the viewer controller');this.restoration.update(this.context,this.widget.options.restorationId??null);if(old.options.contentSize?.width!==this.widget.options.contentSize?.width||old.options.contentSize?.height!==this.widget.options.contentSize?.height||old.options.minScale!==this.widget.options.minScale||old.options.maxScale!==this.widget.options.maxScale)this.stopMotion();}
  private normalize(value:TransformValue):TransformValue{const o=this.widget.options,scale=Math.max(o.minScale??.5,Math.min(o.maxScale??4,value.scale)),viewport=this.viewport;if(!viewport)return {...value,scale};const content=o.contentSize??viewport,margin=o.boundaryMargin??EdgeInsets.zero;
    const clampAxis=(translation:number,view:number,size:number,leading:number,trailing:number)=>{const extra=view-size*scale,low=extra>0?extra/2-trailing*scale:extra-trailing*scale,high=extra>0?extra/2+leading*scale:leading*scale;return Math.max(low,Math.min(high,translation));};return {scale,x:clampAxis(value.x,viewport.width,content.width,margin.left,margin.right),y:clampAxis(value.y,viewport.height,content.height,margin.top,margin.bottom)};
  }
  private stopMotion():void{this.sourcePort.state?.stopMotion();this.revision++;this.motion?.stop();this.from=null;this.target=null;}
  private readonly animateFrame=()=>{if(!this.live||!this.from||!this.target)return;const t=this.motion!.value,a=this.from,b=this.target;this.controller._set(this.token,{scale:a.scale+(b.scale-a.scale)*t,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});};
  private animate(target:TransformValue,{duration,curve=Curves.easeOut}:ViewerAnimationOptions):Promise<ViewerMotionResult>{invariant(this.live&&this.viewport,'unlaid-viewer-animation','Lay out the viewer before animating it');this.stopMotion();const from=unpack(this.controller.value);target=this.normalize(target);if(duration===0||same(from,target)){this.controller._set(this.token,target);return Promise.resolve({status:'completed'});}this.motion!.value=0;this.from=from;this.target=target;const revision=this.revision,token=this.lifetime,future=this.motion!.animateTo(1,{duration,curve}).orCancel;return future.then(()=>{const state=token.current;if(!state?.live||state.revision!==revision)return {status:'cancelled'} as const;state.from=null;state.target=null;return {status:'completed'} as const;},error=>{if(error instanceof TickerCanceled)return {status:'cancelled'} as const;throw error;});}
  private dispatch(kind:'start'|'update'|'end',details:ScaleStartDetails|ScaleUpdateDetails|ScaleEndDetails):void{const token=this.lifetime;void Promise.resolve().then(()=>{const state=token.current;if(!state?.live)return;const options=state.widget.options,report=state.context.services.reportError??(exception=>FlutterError.reportError(new FlutterErrorDetails({exception,library:'widgets interactive viewer'})));try{if(kind==='start')options.onInteractionStart?.(details as ScaleStartDetails);else if(kind==='update')options.onInteractionUpdate?.(details as ScaleUpdateDetails);else options.onInteractionEnd?.(details as ScaleEndDetails);}catch(error){report(error);}});}
  build(_context:BuildContext):Widget{return new LayoutBuilder((_context,constraints)=>{const width=constraints.maxWidth,height=constraints.maxHeight;invariant(Number.isFinite(width)&&width>0&&Number.isFinite(height)&&height>0,'unbounded-interactive-viewer','InteractiveViewer requires a finite positive viewport');const previous=this.viewport;let value=unpack(this.controller.value);if(previous&&(previous.width!==width||previous.height!==height)){this.stopMotion();const scene=new Offset((previous.width/2-value.x)/value.scale,(previous.height/2-value.y)/value.scale);value={...value,x:width/2-scene.dx*value.scale,y:height/2-scene.dy*value.scale};}this.viewport={width,height};this.controller._set(this.token,value,false);const o=this.widget.options,content=o.contentSize??this.viewport;
    const source=new FiniteViewerSource({child:new SizedBox(content.width,content.height,o.child),constrained:false,boundaryMargin:EdgeInsets.all(Infinity),transformationController:this.source!,minScale:o.minScale??.5,maxScale:o.maxScale??4,panEnabled:o.panEnabled??true,scaleEnabled:o.scaleEnabled??true,scaleFactor:o.scaleFactor??200,trackpadScrollCausesScale:o.scaleEnabled!==false&&(o.trackpadScrollCausesScale??false),onInteractionStart:d=>{this.stopMotion();this.dispatch('start',d);},onInteractionUpdate:d=>this.dispatch('update',d),onInteractionEnd:d=>this.dispatch('end',d)},this.sourcePort);
    return new Listener(source,{onPointerDown:()=>{this.cancelDispatch=false;this.stopMotion();},onPointerPanZoomStart:()=>{this.cancelDispatch=false;this.stopMotion();},onPointerCancel:()=>{this.cancelDispatch=true;this.stopMotion();}});
  });}

  override deactivate():void{this.suspended=true;this.cancelDispatch=true;this.stopMotion();super.deactivate();}
  override activate():void{super.activate();this.suspended=false;}
  override dispose():void{this.suspended=true;this.lifetime.current=null;this.controller._unbind(this.token);this.stopMotion();this.restoration.dispose();try{this.motion?.dispose();this.motion=null;this.source?.dispose();this.source=null;this.owned?.dispose();}finally{super.dispose();}}
}
