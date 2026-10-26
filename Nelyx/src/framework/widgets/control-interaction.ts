// SPDX-License-Identifier: BSD-3-Clause
// Shared Nelyx control ownership; consumes the source-derived Core state/focus/gesture APIs.
import {StatefulWidget,Element} from './framework.ts';
import type {BuildContext,Widget,WidgetOptions} from './framework.ts';
import {TickerProviderStateMixin} from './ticker-provider.ts';
import {AnimationController} from '../animation/animation-controller.ts';
import {Curves} from '../animation/curves.ts';
import {WidgetState,WidgetStatesController} from './widget-state.ts';
import type {DartSet} from '../../foundation/dart-collections.ts';
import {FocusNode} from './focus.ts';
import {FocusableActionDetector} from './focusable-action-detector.ts';
import {GestureDetector} from './gesture-detector.ts';
import type {GestureOptions} from './gesture-detector.ts';
import {Actions,ActivateIntent,ButtonActivateIntent,CallbackAction} from './actions.ts';
import type {Intent,IntentType,ActionHandle} from './actions.ts';
import type {ShortcutMap} from './shortcuts.ts';
import {Semantics} from './semantics.ts';
import type {SemanticsWidgetOptions} from './semantics.ts';
import {SystemMouseCursors} from '../../services/mouse-cursor.ts';
import {HitTestBehavior} from '../rendering/pointer-listener.ts';
import {MouseRegion} from './mouse-region.ts';
import type {MouseCursor} from '../../services/mouse-cursor.ts';
import {invariant} from '../../foundation/errors.ts';
import {TapSemanticEvent} from '../semantics/semantics-event.ts';
import {createFrameworkAnchorKey} from './global-key.ts';

export interface ControlVisualState {
  readonly states:DartSet<WidgetState>;readonly focusNode:FocusNode;
  readonly pressed:boolean;readonly hovered:boolean;readonly focused:boolean;
  readonly showFocusHighlight:boolean;readonly showHoverHighlight:boolean;readonly pressProgress:number;
}
export interface ControlInteractionOptions extends WidgetOptions {
  readonly enabled?:boolean;readonly selected?:boolean;readonly focusNode?:FocusNode|null;readonly autofocus?:boolean;readonly skipTraversal?:boolean;
  readonly statesController?:WidgetStatesController|null;readonly mouseCursor?:MouseCursor;
  readonly onPressed?:(()=>void)|null;readonly onLongPress?:(()=>void)|null;readonly onFocusChange?:(focused:boolean)=>void;
  readonly onHover?:(hovered:boolean)=>void;readonly onHighlightChanged?:(pressed:boolean)=>void;
  readonly onShowFocusHighlight?:(focused:boolean)=>void;readonly onShowHoverHighlight?:(hovered:boolean)=>void;
  readonly requestFocusOnPointer?:boolean;readonly preserveInteractionOnDeactivate?:boolean;
  readonly mouseCursorResolver?:((states:DartSet<WidgetState>)=>MouseCursor);
  readonly dragStartBehavior?:GestureOptions['dragStartBehavior'];
  readonly semantics?:Omit<SemanticsWidgetOptions,'child'|'key'|'onTap'|'onLongPress'|'focused'|'enabled'|'focusable'>;
  readonly shortcuts?:ShortcutMap;readonly actions?:ReadonlyMap<IntentType,ActionHandle>;
  readonly gestures?:Pick<GestureOptions,'onTapDown'|'onTapUp'|'onTapCancel'|'onHorizontalDragStart'|'onHorizontalDragUpdate'|'onHorizontalDragEnd'|'onHorizontalDragCancel'>;
}
/** A single owner for input, semantic activation, focus, source state properties and press motion.
 * Design packages supply their visuals. External focus nodes/controllers are never disposed here. */
export class ControlInteraction extends StatefulWidget {
  readonly options:Readonly<ControlInteractionOptions>;
  constructor(readonly builder:(context:BuildContext,state:ControlVisualState)=>Widget,options:ControlInteractionOptions={}){super(options.key??null);this.options=Object.freeze({...options});invariant(typeof builder==='function','invalid-control-builder','Control requires a visual builder');}
  get enabled():boolean{return this.options.enabled??true;}
  createState():ControlInteractionState{return new ControlInteractionState();}
}
class ControlAction<T extends Intent> extends CallbackAction<T> {
  constructor(type:IntentType<T>,private readonly owner:ControlInteractionState){super(type,()=>owner.activateControl());}
  override get isActionEnabled():boolean{return this.owner.canActivate;}
}
export class ControlInteractionState extends TickerProviderStateMixin<ControlInteraction> {
  private internalNode:FocusNode|undefined;private controller!:WidgetStatesController;private ownsController=false;
  private readonly semanticsKey=createFrameworkAnchorKey('Control semantics');
  private motion!:AnimationController;private held=false;private focusHighlight=false;private hoverHighlight=false;private retiring=false;private suspended=false;private hovering=false;
  private readonly controlChanged=()=>{if(this.live)this.setState(()=>{});};
  private readonly activateAction=new ControlAction(ActivateIntent,this);private readonly buttonAction=new ControlAction(ButtonActivateIntent,this);
  private get live():boolean{return this.mounted&&!this.retiring&&!this.suspended&&(this.context as Element).active;}
  get focusNode():FocusNode{return this.widget.options.focusNode??(this.internalNode??=new FocusNode({debugLabel:'ControlInteraction'}));}
  get canActivate():boolean{return this.live&&this.widget.enabled&&this.widget.options.onPressed!=null;}
  activateControl():void{if(this.canActivate){this.widget.options.onPressed!();if(this.live&&this.context.services.binaryMessenger)this.semanticsKey.currentContext?.findRenderObject()?.sendSemanticsEvent(new TapSemanticEvent());}}
  private connect():void{this.ownsController=this.widget.options.statesController==null;this.controller=this.widget.options.statesController??new WidgetStatesController();this.controller.addListener(this.controlChanged);}
  private sync():void{this.controller.update(WidgetState.disabled,!this.widget.enabled);this.controller.update(WidgetState.selected,this.widget.options.selected??false);this.controller.update(WidgetState.hovered,this.hovering&&this.widget.enabled);if(!this.widget.enabled)this.release();}
  override initState():void{super.initState();this.connect();this.motion=new AnimationController({vsync:this,value:0,duration:100,reverseDuration:100});this.motion.addListener(this.controlChanged);this.sync();}
  override didUpdateWidget(old:ControlInteraction):void{super.didUpdateWidget(old);if(old.options.statesController!==this.widget.options.statesController){this.disconnect();this.connect();this.controller.update(WidgetState.pressed,this.held);this.controller.update(WidgetState.focused,this.focusNode.hasFocus);}this.sync();}
  private disconnect():void{this.controller.removeListener(this.controlChanged);if(this.ownsController)this.controller.dispose();}
  private press(value:boolean):void{if(!this.live||value&&!this.widget.enabled||this.held===value)return;this.held=value;try{this.controller.update(WidgetState.pressed,value);}finally{if(this.live){this.motion.animateTo(value?1:0,{duration:100,curve:Curves.easeInOut});this.widget.options.onHighlightChanged?.(value);}}}
  private release():void{this.press(false);}
  override deactivate():void{this.suspended=true;if(this.widget.options.preserveInteractionOnDeactivate){super.deactivate();return;}this.held=false;this.hovering=false;try{this.motion.stop();this.motion.value=0;this.controller.update(WidgetState.pressed,false);this.controller.update(WidgetState.hovered,false);}finally{super.deactivate();}}
  override activate():void{super.activate();this.suspended=false;this.sync();}
  override dispose():void{this.retiring=true;const errors:unknown[]=[];for(const close of [()=>this.disconnect(),()=>this.motion.dispose(),()=>this.internalNode?.dispose(),()=>super.dispose()])try{close();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Control teardown failed');}
  build(context:BuildContext):Widget {
    const options=this.widget.options,enabled=this.widget.enabled,states=this.controller.value,node=this.focusNode;
    const body=this.widget.builder(context,Object.freeze({states,focusNode:node,pressed:this.held,hovered:states.contains(WidgetState.hovered),focused:node.hasFocus,showFocusHighlight:this.focusHighlight,showHoverHighlight:this.hoverHighlight,pressProgress:this.motion.value}));
    const gestures=options.gestures;
    const gesture=new GestureDetector(body,{behavior:HitTestBehavior.opaque,excludeFromSemantics:true,enabled,...(options.dragStartBehavior?{dragStartBehavior:options.dragStartBehavior}:{}),
      onTap:()=>{if(this.canActivate){if(options.requestFocusOnPointer??true)node.requestFocus();this.activateControl();}},
      onTapDown:details=>{this.press(true);if(this.live&&enabled)gestures?.onTapDown?.(details);},
      onTapUp:details=>{try{if(this.live&&this.widget.enabled)gestures?.onTapUp?.(details);}finally{this.release();}},
      onTapCancel:()=>{try{if(this.live)gestures?.onTapCancel?.();}finally{this.release();}},
      ...(options.onLongPress?{onLongPress:()=>{try{if(this.live&&this.widget.enabled)this.widget.options.onLongPress?.();}finally{this.release();}}}:{}),
      ...(gestures?.onHorizontalDragStart?{onHorizontalDragStart:details=>{if(this.live&&this.widget.enabled){this.press(true);if(this.widget.options.requestFocusOnPointer??true)node.requestFocus();this.widget.options.gestures?.onHorizontalDragStart?.(details);}}}:{}),
      ...(gestures?.onHorizontalDragUpdate?{onHorizontalDragUpdate:details=>{if(this.live&&this.widget.enabled)this.widget.options.gestures?.onHorizontalDragUpdate?.(details);}}:{}),
      ...(gestures?.onHorizontalDragEnd?{onHorizontalDragEnd:details=>{try{if(this.live&&this.widget.enabled)this.widget.options.gestures?.onHorizontalDragEnd?.(details);}finally{this.release();}}}:{}),
      ...(gestures?.onHorizontalDragCancel?{onHorizontalDragCancel:()=>{try{if(this.live)this.widget.options.gestures?.onHorizontalDragCancel?.();}finally{this.release();}}}:{})});
    const hover=(value:boolean)=>{if(!this.live)return;this.hovering=value;this.controller.update(WidgetState.hovered,value&&this.widget.enabled);this.widget.options.onHover?.(value&&this.widget.enabled);};
    const semantics=new Semantics({...options.semantics,key:this.semanticsKey,container:true,child:new MouseRegion(gesture,{onEnter:()=>hover(true),onExit:()=>hover(false)}),enabled,focusable:enabled,focused:node.hasFocus,
      onFocus:enabled?()=>{if(this.live&&this.widget.enabled&&node===this.focusNode){node.requestFocus();this.widget.options.semantics?.onFocus?.();}}:null,
      onTap:enabled&&options.onPressed?()=>this.activateControl():null,onLongPress:enabled&&options.onLongPress?()=>{if(this.live&&this.widget.enabled)this.widget.options.onLongPress?.();}:null});
    const actions=new Map<IntentType,ActionHandle>([[ActivateIntent,this.activateAction],[ButtonActivateIntent,this.buttonAction],...options.actions??[]]);
    return new Actions({actions,child:new FocusableActionDetector(semantics,{enabled,focusNode:node,autofocus:options.autofocus??false,skipTraversal:options.skipTraversal??false,includeFocusSemantics:false,mouseCursor:options.mouseCursorResolver?.(states)??options.mouseCursor??(enabled?SystemMouseCursors.click:SystemMouseCursors.basic),shortcuts:options.shortcuts??null,
      onFocusChange:value=>{if(!this.live)return;this.controller.update(WidgetState.focused,value);this.widget.options.onFocusChange?.(value);},
      onShowFocusHighlight:value=>{if(this.live&&this.focusHighlight!==value){this.setState(()=>{this.focusHighlight=value;});this.widget.options.onShowFocusHighlight?.(value);}},
      onShowHoverHighlight:value=>{if(!this.live)return;this.hoverHighlight=value;this.controlChanged();this.widget.options.onShowHoverHighlight?.(value);}})});
  }
}
