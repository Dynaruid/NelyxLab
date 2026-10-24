// SPDX-License-Identifier: BSD-3-Clause
import {StatelessWidget,StatefulWidget,State,Element} from '@nelyx/core/framework/widgets/framework';
import type {Widget,BuildContext} from '@nelyx/core/framework/widgets/framework';
import {Builder,Column,Padding,Text,DecoratedBox} from '@nelyx/core/framework/widgets/basic';
import {Action,ContextAction,CallbackAction,Actions,Intent,PrioritizedIntents,PrioritizedAction,ActivateIntent,ButtonActivateIntent} from '@nelyx/core/framework/widgets/actions';
import type {ActionHandle,IntentType} from '@nelyx/core/framework/widgets/actions';
import {ShortcutRegistrar,ShortcutRegistry,SingleActivator} from '@nelyx/core/framework/widgets/shortcuts';
import type {ShortcutRegistryEntry,ShortcutMap} from '@nelyx/core/framework/widgets/shortcuts';
import {FocusableActionDetector} from '@nelyx/core/framework/widgets/focusable-action-detector';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';import type {FocusManager,FocusHighlightMode,FocusHighlightStrategy} from '@nelyx/core/framework/widgets/focus';
import {FocusScope} from '@nelyx/core/framework/widgets/focus-scope';import {GestureDetector} from '@nelyx/core/framework/widgets/gesture-detector';
import {MediaQuery,AppTheme} from '@nelyx/core/framework/widgets/app-data';import {Scaffold,FilledButton} from '@nelyx/material/widgets';
import {SingleChildScrollView,ScrollController} from '@nelyx/core/framework/widgets/scroll';import type {FrameScheduler} from '@nelyx/core/framework/scheduler/scheduler';
import {LogicalKeyboardKey as L} from '@nelyx/core/services/keyboard-key';import {allInsets} from '@nelyx/core/ui/geometry';
class ComposeIntent extends Intent{}class FallbackIntent extends Intent{}
class DefaultComposeAction extends ContextAction<ComposeIntent>{constructor(private readonly compose:(context:BuildContext)=>void){super(ComposeIntent);}invoke(_intent:ComposeIntent,context?:BuildContext):null{if(!context)throw new Error('Compose requires a focus context');this.compose(context);return null;}}
class ComposeOverride extends Action<ComposeIntent>{
  private enabled=true;delegate=true;constructor(private readonly compose:()=>void){super(ComposeIntent);}
  override get isActionEnabled():boolean{return this.enabled;}
  setEnabled(value:boolean):void{this.enabled=value;this.notifyActionListeners();}
  invoke(intent:ComposeIntent):null{this.compose();if(this.delegate){if(!this.callingAction)throw new Error('Override requires its default action');this.callingAction.invoke(intent);}return null;}
}
export class ActionsLab extends StatelessWidget {
  constructor(readonly scheduler:FrameScheduler,readonly onBack:()=>void){super();}
  build():Widget{return new ShortcutRegistrar(new ActionsLabBody(this.scheduler,this.onBack));}
}
class ActionsLabBody extends StatefulWidget {constructor(readonly scheduler:FrameScheduler,readonly onBack:()=>void){super();}createState():State{return new ActionsLabState();}}
class ActionsLabState extends State<ActionsLabBody> {
  private readonly scroll=new ScrollController();private readonly targetFocus=new FocusNode({debugLabel:'Action target'});private manager!:FocusManager;private previousStrategy!:FocusHighlightStrategy;
  private registry:ShortcutRegistry|null=null;private entry:ShortcutRegistryEntry|null=null;private registered=true;private rebound=false;private enabled=true;private directional=false;
  private defaults=0;private overrides=0;private fallback=0;private activated=0;private contextStatus='none';private targetFocused=false;private focusHighlight=false;private hoverHighlight=false;private mode:FocusHighlightMode='traditional';
  private readonly overrideAction=new ComposeOverride(()=>this.setState(()=>{this.overrides++;}));
  private readonly defaultAction=new DefaultComposeAction(context=>this.setState(()=>{this.defaults++;this.contextStatus=context instanceof Element&&context.owner.focus.primaryFocus?.context===context?'current focus':'unexpected context';}));
  private readonly fallbackAction=new CallbackAction(FallbackIntent,()=>this.setState(()=>{this.fallback++;}));private readonly priority=new PrioritizedAction();
  private readonly modeChanged=(mode:FocusHighlightMode)=>{if(this.mounted&&mode!==this.mode)this.setState(()=>{this.mode=mode;});};
  override initState():void{super.initState();if(!(this.context instanceof Element))throw new Error('ActionsLab requires Element');this.manager=this.context.owner.focus;this.mode=this.manager.highlightMode;this.previousStrategy=this.manager.highlightStrategy;this.manager.addHighlightModeListener(this.modeChanged);}
  private shortcuts():ShortcutMap{return new Map([[new SingleActivator(this.rebound?L.keyJ:L.keyK,{control:true,includeRepeats:false}),new ComposeIntent()],[new SingleActivator(L.keyP,{control:true,includeRepeats:false}),new PrioritizedIntents({orderedIntents:[new ComposeIntent(),new FallbackIntent()]})]]);}
  override didChangeDependencies():void{super.didChangeDependencies();const registry=ShortcutRegistry.of(this.context);if(registry!==this.registry){this.entry?.dispose();this.registry=registry;this.entry=this.registered?registry.addAll(this.shortcuts()):null;}}
  override dispose():void{this.manager.removeHighlightModeListener(this.modeChanged);this.manager.highlightStrategy=this.previousStrategy;this.entry?.dispose();this.targetFocus.dispose();this.scroll.dispose();super.dispose();}
  private rebind():void{this.setState(()=>{this.rebound=!this.rebound;this.entry?.replaceAll(this.shortcuts());});}
  private registration():void{this.setState(()=>{this.registered=!this.registered;if(this.registered)this.entry=this.registry!.addAll(this.shortcuts());else{this.entry?.dispose();this.entry=null;}});}
  private strategy():void{this.setState(()=>{this.manager.highlightStrategy=this.manager.highlightStrategy==='automatic'?'alwaysTouch':this.manager.highlightStrategy==='alwaysTouch'?'alwaysTraditional':'automatic';});}
  private activateTarget():void{this.setState(()=>{this.activated++;});}
  build(context:BuildContext):Widget{
    const theme=AppTheme.of(context),media=MediaQuery.of(context),outer=new Map<IntentType,ActionHandle>([[ComposeIntent,this.overrideAction],[FallbackIntent,this.fallbackAction]]);
    return new Actions({actions:outer,child:new Builder(lookup=>{
      const local=new Map<IntentType,ActionHandle>([[ComposeIntent,Action.overridable({defaultAction:this.defaultAction,context:lookup})],[PrioritizedIntents,this.priority]]);
      const target=new FocusableActionDetector(new GestureDetector(new DecoratedBox(new Padding(allInsets(2),new DecoratedBox(new Padding(allInsets(18),new Text('Action target · Enter / Space',{color:theme.foreground,fontSize:18})),theme.surface,theme.radius)),this.focusHighlight?theme.foreground:this.hoverHighlight?theme.accent:theme.surface,theme.radius),{...(this.enabled?{onTap:()=>{this.targetFocus.requestFocus();this.activateTarget();}}:{})}),{
        focusNode:this.targetFocus,autofocus:true,enabled:this.enabled,actions:new Map<IntentType,ActionHandle>([[ActivateIntent,new CallbackAction(ActivateIntent,()=>this.activateTarget())],[ButtonActivateIntent,new CallbackAction(ButtonActivateIntent,()=>this.activateTarget())]]),
        shortcuts:new Map([[new SingleActivator(L.enter,{includeRepeats:false}),new ActivateIntent()],[new SingleActivator(L.space,{includeRepeats:false}),new ActivateIntent()]]),
        onShowFocusHighlight:value=>{if(this.mounted&&value!==this.focusHighlight)this.setState(()=>{this.focusHighlight=value;});},onShowHoverHighlight:value=>{if(this.mounted&&value!==this.hoverHighlight)this.setState(()=>{this.hoverHighlight=value;});},
        onFocusChange:value=>{if(this.mounted&&value!==this.targetFocused)this.setState(()=>{this.targetFocused=value;});},
      });
      return new Actions({actions:local,child:new FocusScope(new MediaQuery({...media,navigationMode:this.directional?'directional':'traditional'},new Scaffold('Actions and focus',new SingleChildScrollView(new Padding(allInsets(12),new Column([
        new Text(`Ctrl+${this.rebound?'J':'K'} invokes compose. Ctrl+P chooses an enabled action.`,{fontSize:15,color:theme.foreground}),
        new Text(`Default ${this.defaults} · Override ${this.overrides} · Fallback ${this.fallback}`,{fontSize:18,color:theme.foreground}),
        new Text(`Context: ${this.contextStatus} · Activated ${this.activated}`,{fontSize:15,color:theme.foreground}),new Text(`Mode: ${this.mode} · Strategy: ${this.manager.highlightStrategy}`,{fontSize:15,color:theme.foreground}),
        new Text(`Focus highlight: ${this.focusHighlight?'on':'off'} · Hover highlight: ${this.hoverHighlight?'on':'off'}`,{fontSize:15,color:theme.foreground}),target,
        new Text(`Target focus: ${this.targetFocused?'on':'off'}`,{fontSize:15,color:theme.foreground}),
        new FilledButton('actions-override',this.overrideAction.isActionEnabled?'Disable override':'Enable override',()=>this.setState(()=>this.overrideAction.setEnabled(!this.overrideAction.isActionEnabled))),
        new FilledButton('actions-default',this.overrideAction.delegate?'Override calls default':'Override handles alone',()=>this.setState(()=>{this.overrideAction.delegate=!this.overrideAction.delegate;})),
        new FilledButton('actions-rebind',this.rebound?'Binding: Ctrl+J':'Binding: Ctrl+K',()=>this.rebind()),
        new FilledButton('actions-register',this.registered?'Unregister shortcuts':'Register shortcuts',()=>this.registration()),
        new FilledButton('actions-target',this.enabled?'Disable target':'Enable target',()=>this.setState(()=>{this.enabled=!this.enabled;})),
        new FilledButton('actions-navigation','Navigation: '+(this.directional?'directional':'traditional'),()=>this.setState(()=>{this.directional=!this.directional;})),
        new FilledButton('actions-strategy','Highlight: '+this.manager.highlightStrategy,()=>this.strategy()),
      ],{spacing:10,crossAlign:'stretch'})),this.scroll,this.widget.scheduler),new FilledButton('actions-back','Back',this.widget.onBack))),{autofocus:true,skipTraversal:true,includeSemantics:false})});
    })});
  }
}
