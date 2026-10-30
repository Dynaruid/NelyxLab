// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter widgets/gesture_detector.dart; explicit constructor tokens adapt Dart Type.
import {invariant} from '../../foundation/errors.ts';
import type {Key} from '../../foundation/key.ts';
import {objectRuntimeType} from '../../foundation/object.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {IterableProperty,EnumProperty} from '../../foundation/diagnostic-properties.ts';
import {Offset} from '../../ui/offset.ts';
import {PointerDeviceKind} from '../../ui/pointer.ts';
import {SemanticsAction} from '../../ui/semantics-action.ts';
import {GestureRecognizer} from '../gestures/recognizer.ts';
import {TapGestureRecognizer,TapDownDetails,TapUpDetails} from '../gestures/tap.ts';
import {LongPressGestureRecognizer,LongPressDownDetails,LongPressStartDetails,LongPressEndDetails} from '../gestures/long-press.ts';
import {PanGestureRecognizer,HorizontalDragGestureRecognizer,VerticalDragGestureRecognizer} from '../gestures/monodrag.ts';
import type {DragGestureRecognizer} from '../gestures/monodrag.ts';
import {DragDownDetails,DragStartDetails,DragEndDetails} from '../gestures/drag-details.ts';
import type {DragUpdateDetails,GestureDragUpdateCallback} from '../gestures/drag-details.ts';
import type {PointerDownEvent,PointerPanZoomStartEvent} from '../gestures/events.ts';
import {RenderSemanticsGestureHandler} from '../rendering/semantics-gesture-handler.ts';
import {HitTestBehavior} from '../rendering/pointer-listener.ts';
import type {RenderBox} from '../rendering/object.ts';
import {StatefulWidget,State,Element,RenderObjectWidget} from './framework.ts';
import type {Widget,BuildContext} from './framework.ts';
import {Listener} from './listener.ts';
export type GestureRecognizerType<T extends GestureRecognizer=GestureRecognizer>=abstract new (...args:never[])=>T;
export type GestureRecognizerFactoryConstructor<T extends GestureRecognizer>=()=>T;
export type GestureRecognizerFactoryInitializer<T extends GestureRecognizer>=(instance:T)=>void;
/** createRecognizer is the named TS form of Dart's constructor() method. */
export abstract class GestureRecognizerFactory<T extends GestureRecognizer=GestureRecognizer> {
  constructor(readonly type:GestureRecognizerType<T>){}
  abstract createRecognizer():T;
  abstract initializer(instance:T):void;
  assertTypeMatches(type:GestureRecognizerType):void{invariant(type===this.type,'gesture-factory-type-mismatch','The factory token must match its map key');}
}
export class GestureRecognizerFactoryWithHandlers<T extends GestureRecognizer> extends GestureRecognizerFactory<T> {
  constructor(type:GestureRecognizerType<T>,private readonly construct:GestureRecognizerFactoryConstructor<T>,private readonly initialize:GestureRecognizerFactoryInitializer<T>){super(type);}
  override createRecognizer():T{return this.construct();}
  override initializer(instance:T):void{this.initialize(instance);}
}
export type GestureRecognizerFactories=ReadonlyMap<GestureRecognizerType,GestureRecognizerFactory>;
export abstract class SemanticsGestureDelegate {
  abstract assignSemantics(renderObject:RenderSemanticsGestureHandler):void;
  toString():string{return objectRuntimeType(this,'SemanticsGestureDelegate')+'()';}
}
export interface RawGestureDetectorOptions {readonly gestures?:GestureRecognizerFactories;readonly behavior?:HitTestBehavior;readonly excludeFromSemantics?:boolean;readonly semantics?:SemanticsGestureDelegate|null;readonly key?:Key|null;readonly semanticsId?:string;readonly label?:string;readonly enabled?:boolean}
export class RawGestureDetector extends StatefulWidget {
  constructor(readonly child:Widget|null=null,readonly options:RawGestureDetectorOptions={}){super(options.key??null);}
  get gestures():GestureRecognizerFactories{return this.options.gestures??new Map();}
  get behavior():HitTestBehavior|null{return this.options.behavior??null;}
  get excludeFromSemantics():boolean{return this.options.excludeFromSemantics??false;}
  get semantics():SemanticsGestureDelegate|null{return this.options.semantics??null;}
  createState():RawGestureDetectorState{return new RawGestureDetectorState();}
}
export class RawGestureDetectorState extends State<RawGestureDetector> {
  private recognizers:Map<GestureRecognizerType,GestureRecognizer>|null=new Map();private semanticsDelegate:SemanticsGestureDelegate|null=null;
  override initState():void{super.initState();this.semanticsDelegate=this.widget.semantics??new DefaultSemanticsGestureDelegate(this);this.syncAll(this.widget.gestures);}
  override didUpdateWidget(oldWidget:RawGestureDetector):void{super.didUpdateWidget(oldWidget);if(!(oldWidget.semantics===null&&this.widget.semantics===null))this.semanticsDelegate=this.widget.semantics??new DefaultSemanticsGestureDelegate(this);this.syncAll(this.widget.gestures);}
  /** The actual recognizer instance retained for a constructor token. */
  recognizerFor<T extends GestureRecognizer>(type:GestureRecognizerType<T>):T|null{return this.recognizers?.get(type) as T|undefined??null;}
  replaceGestureRecognizers(gestures:GestureRecognizerFactories):void{const render=this.context.findRenderObject();invariant(render?.owner?.debugDoingLayout,'gesture-replacement-outside-layout','Replace recognizers only during this View\'s layout phase');this.syncAll(gestures);if(!this.widget.excludeFromSemantics){invariant(render instanceof RenderSemanticsGestureHandler,'missing-gesture-semantics-renderer','Expected the mounted gesture semantics renderer');this.updateSemanticsForRenderObject(render);}}
  replaceSemanticsActions(actions:Set<SemanticsAction>):void{if(this.widget.excludeFromSemantics)return;const render=this.context.findRenderObject();invariant(render instanceof RenderSemanticsGestureHandler,'missing-gesture-semantics-renderer','Semantics actions require the mounted gesture renderer');render.validActions=actions;}
  private syncAll(gestures:GestureRecognizerFactories):void {
    invariant(this.recognizers!==null&&this.context instanceof Element,'disposed-gesture-detector','Gesture detector is disposed');const binding=this.context.owner.gestureBinding,old=this.recognizers,next=new Map<GestureRecognizerType,GestureRecognizer>(),created=new Set<GestureRecognizer>();
    try{for(const [type,factory] of gestures){factory.assertTypeMatches(type);const recognizer=old.get(type)??factory.createRecognizer();invariant(recognizer instanceof GestureRecognizer&&recognizer.belongsToBinding(binding)&&!recognizer.isDisposed,'foreign-gesture-factory-owner','Factory recognizers must belong to this live View');if(!old.has(type))created.add(recognizer);invariant(recognizer.constructor===type,'gesture-factory-instance-mismatch','Factory must construct exactly its declared recognizer type');next.set(type,recognizer);factory.initializer(recognizer);invariant(!recognizer.isDisposed,'disposed-gesture-factory-instance','Factory initializer retired its recognizer');}}
    catch(error){const errors=[error];for(const recognizer of created)try{recognizer.dispose();}catch(retirement){errors.push(retirement);}if(errors.length===1)throw error;throw new AggregateError(errors,'Gesture factory setup failed');}
    this.recognizers=next;const errors:unknown[]=[];for(const [type,recognizer] of old)if(!next.has(type))try{recognizer.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Removed gesture recognizers failed to retire');
  }
  private readonly handlePointerDown=(event:PointerDownEvent)=>{const recognizers=this.recognizers;if(!recognizers)return;const snapshot=[...recognizers];for(const [type,recognizer] of snapshot)if(this.recognizers?.get(type)===recognizer&&!recognizer.isDisposed)recognizer.addPointer(event);};
  private readonly handlePointerPanZoomStart=(event:PointerPanZoomStartEvent)=>{const recognizers=this.recognizers;if(!recognizers)return;const snapshot1=[...recognizers];for(const [type,recognizer] of snapshot1)if(this.recognizers?.get(type)===recognizer&&!recognizer.isDisposed)recognizer.addPointerPanZoom(event);};
  private get defaultBehavior():HitTestBehavior{return this.widget.child===null?HitTestBehavior.translucent:HitTestBehavior.deferToChild;}
  private readonly updateSemanticsForRenderObject=(render:RenderSemanticsGestureHandler)=>{invariant(!this.widget.excludeFromSemantics&&this.semanticsDelegate!==null,'excluded-gesture-semantics','No gesture semantics delegate is active');render.semanticsId=this.widget.options.semanticsId??null;render.semanticsLabel=this.widget.options.label??'';render.semanticsEnabled=this.widget.options.enabled!==false;this.semanticsDelegate.assignSemantics(render);};
  override build(_context:BuildContext):Widget{const behavior=this.widget.behavior??this.defaultBehavior;let result:Widget=new Listener(this.widget.child,{onPointerDown:this.handlePointerDown,onPointerPanZoomStart:this.handlePointerPanZoomStart,behavior});if(!this.widget.excludeFromSemantics)result=new GestureSemantics(result,behavior,this.updateSemanticsForRenderObject);return result;}
  override dispose():void{const recognizers=this.recognizers;this.recognizers=null;this.semanticsDelegate=null;const errors:unknown[]=[];if(recognizers)for(const recognizer of recognizers.values())try{recognizer.dispose();}catch(error){errors.push(error);}super.dispose();if(errors.length)throw new AggregateError(errors,'Gesture detector retirement failed');}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new IterableProperty('gestures',this.recognizers===null?['DISPOSED']:[...this.recognizers.values()].map(recognizer=>recognizer.debugDescription),{ifEmpty:'<none>'}));properties.add(new EnumProperty('behavior',this.mounted?this.widget.behavior:null,{defaultValue:null}));properties.add(new DiagnosticsProperty('semantics',this.semanticsDelegate,{defaultValue:null}));}
}
class GestureSemantics extends RenderObjectWidget {
  constructor(readonly child:Widget,readonly behavior:HitTestBehavior,readonly assignSemantics:(render:RenderSemanticsGestureHandler)=>void){super();}
  get childWidgets():readonly Widget[]{return [this.child];}
  createRenderObject():RenderSemanticsGestureHandler{const render=new RenderSemanticsGestureHandler({behavior:this.behavior});this.assignSemantics(render);return render;}
  updateRenderObject(_context:BuildContext,object:RenderBox):void{const render=object as RenderSemanticsGestureHandler;render.behavior=this.behavior;this.assignSemantics(render);}
}
class DefaultSemanticsGestureDelegate extends SemanticsGestureDelegate {
  constructor(private readonly detector:RawGestureDetectorState){super();}
  private center(render:RenderSemanticsGestureHandler):{local:Offset;global:Offset}{const local=new Offset(render.size.width/2,render.size.height/2),global=render.localToGlobal(local);return {local,global:new Offset(global.x,global.y)};}
  override assignSemantics(render:RenderSemanticsGestureHandler):void {
    const tap=this.detector.recognizerFor(TapGestureRecognizer);render.onTap=tap===null?null:()=>{if(tap.isDisposed)return;const {local,global}=this.center(render);tap.onTapDown?.(new TapDownDetails({globalPosition:global,localPosition:local,kind:PointerDeviceKind.unknown}));if(tap.isDisposed)return;tap.onTapUp?.(new TapUpDetails({globalPosition:global,localPosition:local,kind:PointerDeviceKind.unknown}));if(!tap.isDisposed)tap.onTap?.();};
    const longPress=this.detector.recognizerFor(LongPressGestureRecognizer);render.onLongPress=longPress===null?null:()=>{if(longPress.isDisposed)return;const {local,global}=this.center(render);longPress.onLongPressDown?.(new LongPressDownDetails({localPosition:local,globalPosition:global}));if(longPress.isDisposed)return;longPress.onLongPressStart?.(new LongPressStartDetails({localPosition:local,globalPosition:global}));if(longPress.isDisposed)return;longPress.onLongPress?.();if(longPress.isDisposed)return;longPress.onLongPressEnd?.(new LongPressEndDetails({localPosition:local,globalPosition:global}));if(!longPress.isDisposed)longPress.onLongPressUp?.();};
    render.onHorizontalDragUpdate=this.dragHandler(render,HorizontalDragGestureRecognizer);
    render.onVerticalDragUpdate=this.dragHandler(render,VerticalDragGestureRecognizer);
  }
  private dragHandler(render:RenderSemanticsGestureHandler,type:GestureRecognizerType<DragGestureRecognizer>):GestureDragUpdateCallback|null{const directional=this.detector.recognizerFor(type),pan=this.detector.recognizerFor(PanGestureRecognizer);if(directional===null&&pan===null)return null;return details=>{this.performDrag(render,directional,details,true);this.performDrag(render,pan,details,false);};}
  private performDrag(render:RenderSemanticsGestureHandler,recognizer:DragGestureRecognizer|null,details:DragUpdateDetails,directional:boolean):void{if(recognizer===null||recognizer.isDisposed)return;const {local,global}=this.center(render),end=local.add(details.delta),endGlobal=render.localToGlobal(end);recognizer.onDown?.(new DragDownDetails({localPosition:local,globalPosition:global}));if(recognizer.isDisposed)return;recognizer.onStart?.(new DragStartDetails({localPosition:local,globalPosition:global}));if(recognizer.isDisposed)return;recognizer.onUpdate?.(details);if(recognizer.isDisposed)return;recognizer.onEnd?.(new DragEndDetails({...(directional?{primaryVelocity:0}:{}),localPosition:end,globalPosition:new Offset(endGlobal.x,endGlobal.y)}));}
}
