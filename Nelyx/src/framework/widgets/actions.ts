// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Actions adapted from Flutter widgets/actions.dart. Intent type tokens are explicit
// constructors because TypeScript erases generic types at runtime.
import {StatefulWidget,State,InheritedWidget,Element,InheritedElement} from './framework.ts';
import type {Widget,BuildContext} from './framework.ts';
import type {Key} from '../../foundation/key.ts';
import type {KeyEventResult} from './focus.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';

export type IntentType<T extends Intent=Intent>=abstract new (...args:never[])=>T;
export abstract class Intent {
  get typeToken():IntentType{return this.constructor as IntentType;}
  static get doNothing():DoNothingIntent{return doNothingIntent;}
}
/** Heterogeneous action maps use the checked dispatch adapter, never an any cast. */
export interface ActionHandle {
  readonly intentType:IntentType;
  isEnabledFor(intent:Intent,context?:BuildContext):boolean;
  invokeFor(intent:Intent,context?:BuildContext):unknown;
  toKeyEventResultFor(intent:Intent,result:unknown):KeyEventResult;
  addActionListener(listener:ActionListenerCallback):void;
  removeActionListener(listener:ActionListenerCallback):void;
}
export type ActionListenerCallback=(action:ActionHandle)=>void;
const callingActions=new WeakMap<ActionHandle,ActionHandle>();
const callingDelegates=new WeakMap<ActionHandle,ActionHandle>();
const callingAliases=new WeakMap<ActionHandle,ActionHandle>();
function withCallingAction<R>(action:ActionHandle,caller:ActionHandle,callback:()=>R):R{
  const previous:{action:ActionHandle;caller:ActionHandle|undefined}[]=[],seen=new Set<ActionHandle>();
  for(let value:ActionHandle|undefined=action;value;value=callingDelegates.get(value)){
    if(seen.has(value))throw new FlutterError('Calling action delegation cannot form a cycle');seen.add(value);previous.push({action:value,caller:callingActions.get(value)});
  }
  for(const entry of previous)callingActions.set(entry.action,caller);
  try{return callback();}finally{for(const entry of previous){if(entry.caller)callingActions.set(entry.action,entry.caller);else callingActions.delete(entry.action);}}
}
export abstract class Action<T extends Intent> implements ActionHandle {
  private readonly listeners:ActionListenerCallback[]=[];
  constructor(readonly intentType:IntentType<T>){}
  static overridable<T extends Intent>({defaultAction,context}:{readonly defaultAction:Action<T>;readonly context:BuildContext}):ContextAction<T>{return new OverridableAction(defaultAction instanceof OverridableAction?defaultAction.defaultAction:defaultAction,context);}
  protected get callingAction():Action<T>|null{const action=callingAliases.get(this)??this;return (callingActions.get(action)??null) as Action<T>|null;}
  get isActionEnabled():boolean{return true;}
  isEnabled(_intent:T,_context?:BuildContext):boolean{return this.isActionEnabled;}
  consumesKey(_intent:T):boolean{return true;}
  toKeyEventResult(intent:T,_invokeResult:unknown):KeyEventResult{return this.consumesKey(intent)?'handled':'skipRemainingHandlers';}
  abstract invoke(intent:T,context?:BuildContext):unknown;
  private checked(intent:Intent):T{if(!(intent instanceof this.intentType))throw new FlutterError('Action received an incompatible Intent');return intent;}
  isEnabledFor(intent:Intent,context?:BuildContext):boolean{return this.isEnabled(this.checked(intent),context);}
  invokeFor(intent:Intent,context?:BuildContext):unknown{return this.invoke(this.checked(intent),context);}
  toKeyEventResultFor(intent:Intent,result:unknown):KeyEventResult{return this.toKeyEventResult(this.checked(intent),result);}
  addActionListener(listener:ActionListenerCallback):void{this.listeners.push(listener);}
  removeActionListener(listener:ActionListenerCallback):void{const index=this.listeners.indexOf(listener);if(index>=0)this.listeners.splice(index,1);}
  protected notifyActionListeners():void{for(const listener of [...this.listeners])if(this.listeners.includes(listener))try{listener(this);}catch(exception){FlutterError.reportError(new FlutterErrorDetails({exception,library:'widgets library'}));}}
  protected notifyActionListenersFor(action:Action<T>):void{action.notifyActionListeners();}
}
export abstract class ContextAction<T extends Intent> extends Action<T>{}
export class CallbackAction<T extends Intent> extends Action<T> {
  constructor(type:IntentType<T>,readonly onInvoke:(intent:T)=>unknown){super(type);}
  invoke(intent:T):unknown{return this.onInvoke(intent);}
}
export class ActionDispatcher {
  /** Explicit primary-focus supplier for direct dispatch outside Actions lookup. */
  constructor(private readonly readPrimaryContext?:()=>BuildContext|undefined){}
  invokeAction(action:ActionHandle,intent:Intent,context?:BuildContext):unknown{const target=context??this.readPrimaryContext?.();if(!action.isEnabledFor(intent,target))throw new FlutterError('Action must be enabled when calling invokeAction');return action.invokeFor(intent,target);}
  invokeActionIfEnabled(action:ActionHandle,intent:Intent,context?:BuildContext):readonly [boolean,unknown]{const target=context??this.readPrimaryContext?.();return action.isEnabledFor(intent,target)?[true,action.invokeFor(intent,target)]:[false,null];}
}
export interface ActionsOptions {readonly actions:ReadonlyMap<IntentType,ActionHandle>;readonly child:Widget;readonly dispatcher?:ActionDispatcher;readonly key?:Key|null}
class ActionsScope extends InheritedWidget {
  constructor(readonly actions:ReadonlyMap<IntentType,ActionHandle>,readonly dispatcher:ActionDispatcher|undefined,readonly revision:number,child:Widget){super(child);}
  updateShouldNotify(old:this):boolean{return old.revision!==this.revision||old.dispatcher!==this.dispatcher||!sameActions(old.actions,this.actions);}
}
function sameActions(a:ReadonlyMap<IntentType,ActionHandle>,b:ReadonlyMap<IntentType,ActionHandle>):boolean{return a.size===b.size&&[...a].every(([type,action])=>b.get(type)===action);}
function scopes(context:BuildContext):InheritedElement[]{if(!context.mounted)return [];const result:InheritedElement[]=[];context.visitAncestorElements(element=>{if(element instanceof InheritedElement&&element.widget instanceof ActionsScope)result.push(element);return true;});return result;}
function findMapping(context:BuildContext,type:IntentType,depend:boolean):{element:InheritedElement;action:ActionHandle}|undefined{for(const element of scopes(context)){const action=(element.widget as ActionsScope).actions.get(type);if(action){if(depend)context.dependOnInheritedElement(element);return {element,action};}}return undefined;}
function dispatcher(context:BuildContext):ActionDispatcher{for(const element of scopes(context)){const found=(element.widget as ActionsScope).dispatcher;if(found)return found;}return new ActionDispatcher(context instanceof Element?()=>context.owner.focus.primaryFocus?.context??undefined:undefined);}
function mappingDispatcher(element:InheritedElement):ActionDispatcher{return (element.widget as ActionsScope).dispatcher??dispatcher(element);}
export class Actions extends StatefulWidget {
  readonly actions:ReadonlyMap<IntentType,ActionHandle>;readonly child:Widget;readonly dispatcher:ActionDispatcher|undefined;
  constructor(options:ActionsOptions){super(options.key??null);this.actions=new Map(options.actions);this.child=options.child;this.dispatcher=options.dispatcher;for(const [type,action]of this.actions)if(type!==action.intentType&&action.intentType!==Intent)throw new FlutterError('Action mapping type does not match its intentType');}
  createState():State{return new ActionsState();}
  static maybeFind(context:BuildContext,intent:Intent|IntentType):ActionHandle|undefined{return findMapping(context,intent instanceof Intent?intent.typeToken:intent,true)?.action;}
  static find(context:BuildContext,intent:Intent|IntentType):ActionHandle{const action=this.maybeFind(context,intent);if(!action)throw new FlutterError('No Actions mapping for the requested Intent');return action;}
  static of(context:BuildContext):ActionDispatcher{const marker=context.maybeDependOn(ActionsScope);return marker?.dispatcher??dispatcher(context);}
  static handler(context:BuildContext,intent:Intent):(()=>void)|undefined{const action=this.maybeFind(context,intent);if(!action?.isEnabledFor(intent,context))return undefined;return ()=>{if(context.mounted&&action.isEnabledFor(intent,context))this.of(context).invokeAction(action,intent,context);};}
  static invoke(context:BuildContext,intent:Intent):unknown{const mapping=findMapping(context,intent.typeToken,false);if(!mapping)throw new FlutterError('No Actions mapping for the requested Intent');if(!mapping.action.isEnabledFor(intent,context))return null;return mappingDispatcher(mapping.element).invokeAction(mapping.action,intent,context);}
  static maybeInvoke(context:BuildContext,intent:Intent):unknown{const mapping=findMapping(context,intent.typeToken,false);if(!mapping||!mapping.action.isEnabledFor(intent,context))return null;return mappingDispatcher(mapping.element).invokeAction(mapping.action,intent,context);}
}
class ActionsState extends State<Actions> {
  private listened=new Set<ActionHandle>();private revision=0;
  private readonly changed=()=>{if(this.mounted)this.setState(()=>{this.revision++;});};
  private updateListeners():void{const next=new Set(this.widget.actions.values());for(const action of this.listened)if(!next.has(action))action.removeActionListener(this.changed);for(const action of next)if(!this.listened.has(action))action.addActionListener(this.changed);this.listened=next;}
  override initState():void{this.updateListeners();}
  override didUpdateWidget(_old:Actions):void{this.updateListeners();}
  override dispose():void{for(const action of this.listened)action.removeActionListener(this.changed);this.listened.clear();}
  build():Widget{return new ActionsScope(this.widget.actions,this.widget.dispatcher,this.revision,this.widget.child);}
}
export class ActionListener extends StatefulWidget {
  constructor(readonly action:ActionHandle,readonly listener:ActionListenerCallback,readonly child:Widget,key:Key|null=null){super(key);}
  createState():State{return new ActionListenerState();}
}
class ActionListenerState extends State<ActionListener> {
  override initState():void{this.widget.action.addActionListener(this.widget.listener);}
  override didUpdateWidget(old:ActionListener):void{if(old.action===this.widget.action&&old.listener===this.widget.listener)return;old.action.removeActionListener(old.listener);this.widget.action.addActionListener(this.widget.listener);}
  override dispose():void{this.widget.action.removeActionListener(this.widget.listener);}
  build():Widget{return this.widget.child;}
}
export class VoidCallbackIntent extends Intent {constructor(readonly callback:()=>void){super();}}
export class VoidCallbackAction extends Action<VoidCallbackIntent> {constructor(){super(VoidCallbackIntent);}invoke(intent:VoidCallbackIntent):null{intent.callback();return null;}}
export class DoNothingIntent extends Intent {}
export class DoNothingAndStopPropagationIntent extends Intent {}
const doNothingIntent=new DoNothingIntent();
export class DoNothingAction extends Action<Intent> {constructor(private readonly consumes=true){super(Intent);}override consumesKey(_intent:Intent):boolean{return this.consumes;}invoke(_intent:Intent):null{return null;}}
export class ActivateIntent extends Intent {}
export class ButtonActivateIntent extends Intent {}
export abstract class ActivateAction extends Action<ActivateIntent> {constructor(){super(ActivateIntent);}}
export class SelectIntent extends Intent {}
export abstract class SelectAction extends Action<SelectIntent> {constructor(){super(SelectIntent);}}
export class DismissIntent extends Intent {}
export abstract class DismissAction extends Action<DismissIntent> {constructor(){super(DismissIntent);}}

/** Explicit application context replaces Flutter's process-global primaryFocus. */
export class PrioritizedIntents extends Intent {
  readonly orderedIntents:readonly Intent[];
  constructor({orderedIntents}:{readonly orderedIntents:readonly Intent[]}){super();if(!orderedIntents.every(value=>value instanceof Intent))throw new FlutterError('PrioritizedIntents requires Intent values');this.orderedIntents=Object.freeze([...orderedIntents]);}
}
export class PrioritizedAction extends ContextAction<PrioritizedIntents> {
  private selected:{action:ActionHandle;intent:Intent}|undefined;
  constructor(private readonly readPrimaryContext?:()=>BuildContext|undefined){super(PrioritizedIntents);}
  override isEnabled(intent:PrioritizedIntents,context?:BuildContext):boolean{
    const primary=this.readPrimaryContext?this.readPrimaryContext():(context instanceof Element?context.owner.focus.primaryFocus?.context:undefined);
    if(!primary?.mounted)return false;
    for(const candidate of intent.orderedIntents){const action=Actions.maybeFind(primary,candidate);if(action?.isEnabledFor(candidate,context)){this.selected={action,intent:candidate};return true;}}
    return false;
  }
  invoke(_intent:PrioritizedIntents,context?:BuildContext):void{if(!this.selected)throw new FlutterError('PrioritizedAction must select an enabled intent before invocation');this.selected.action.invokeFor(this.selected.intent,context);}
}

/** Shared implementation of the source's ordinary/context overridable actions. */
class OverridableAction<T extends Intent> extends ContextAction<T> {
  private readonly active=new Set<string>();
  constructor(readonly defaultAction:Action<T>,readonly lookupContext:BuildContext){super(defaultAction.intentType);callingDelegates.set(this,defaultAction);}
  private guarded<R>(operation:string,callback:()=>R):R{if(this.active.has(operation))throw new FlutterError('Mutually recursive overridable action: '+operation);this.active.add(operation);try{return callback();}finally{this.active.delete(operation);}}
  private overrideAction(depend=false):Action<T>|null{
    if(!this.lookupContext.mounted)throw new FlutterError('Overridable action lookup context is unmounted');
    const action=findMapping(this.lookupContext,this.intentType,depend)?.action;
    if(!action)return null;if(action===this)throw new FlutterError('An overridable action cannot override itself');
    if(!(action instanceof Action))throw new FlutterError('An overridable mapping requires an Action instance');return action as Action<T>;
  }
  override get isActionEnabled():boolean{return this.guarded('isActionEnabled',()=>{const action=this.overrideAction(true);return action?withCallingAction(action,this.defaultAction,()=>action.isActionEnabled):this.defaultAction.isActionEnabled;});}
  override isEnabled(intent:T,context?:BuildContext):boolean{return this.guarded('isEnabled',()=>{const action=this.overrideAction();return action?withCallingAction(action,this.defaultAction,()=>action.isEnabledFor(intent,context)):this.defaultAction.isEnabledFor(intent,context);});}
  override consumesKey(intent:T):boolean{return this.guarded('consumesKey',()=>{const action=this.overrideAction();return action?withCallingAction(action,this.defaultAction,()=>action.consumesKey(intent)):this.defaultAction.consumesKey(intent);});}
  invoke(intent:T,context?:BuildContext):unknown{return this.guarded('invoke',()=>{
    const action=this.overrideAction();if(!action)return this.defaultAction.invokeFor(intent,this.defaultAction instanceof ContextAction?context:undefined);
    if(this.defaultAction instanceof ContextAction&&!context)throw new FlutterError('A contextual action override requires an invocation context');
    const caller=this.defaultAction instanceof ContextAction?new ContextActionToActionAdapter(this.defaultAction,context!):this.defaultAction;
    return withCallingAction(action,caller,()=>action.invokeFor(intent,context));
  });}
}
class ContextActionToActionAdapter<T extends Intent> extends Action<T> {
  constructor(readonly action:ContextAction<T>,readonly invokeContext:BuildContext){super(action.intentType);callingDelegates.set(this,action);callingAliases.set(this,action);}
  override get isActionEnabled():boolean{return this.action.isActionEnabled;}
  override isEnabled(intent:T):boolean{return this.action.isEnabledFor(intent,this.invokeContext);}
  override consumesKey(intent:T):boolean{return this.action.consumesKey(intent);}
  override addActionListener(listener:ActionListenerCallback):void{super.addActionListener(listener);this.action.addActionListener(listener);}
  override removeActionListener(listener:ActionListenerCallback):void{super.removeActionListener(listener);this.action.removeActionListener(listener);}
  protected override notifyActionListeners():void{this.notifyActionListenersFor(this.action);}
  invoke(intent:T):unknown{return this.action.invokeFor(intent,this.invokeContext);}
}
