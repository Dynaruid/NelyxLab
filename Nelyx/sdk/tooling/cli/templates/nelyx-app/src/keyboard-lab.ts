// SPDX-License-Identifier: BSD-3-Clause
import {StatefulWidget,State,Element} from '@nelyx/core/framework/widgets/framework';
import type {Widget,BuildContext} from '@nelyx/core/framework/widgets/framework';
import {Column,Text} from '@nelyx/core/framework/widgets/basic';
import {Actions,Intent,Action,CallbackAction} from '@nelyx/core/framework/widgets/actions';
import type {ActionHandle,IntentType} from '@nelyx/core/framework/widgets/actions';
import {Shortcuts,SingleActivator,ShortcutManager} from '@nelyx/core/framework/widgets/shortcuts';
import type {ShortcutActivator} from '@nelyx/core/framework/widgets/shortcuts';
import {LogicalKeyboardKey} from '@nelyx/core/services/keyboard-key';
import type {KeyEvent,HardwareKeyboard} from '@nelyx/core/services/hardware-keyboard';
import {Scaffold,FilledButton} from '@nelyx/material/widgets';
import {AppTheme} from '@nelyx/core/framework/widgets/app-data';
import {ActionsLab} from './actions-lab.ts';
import {KeyboardDispatchLab} from './keyboard-dispatch-lab.ts';
import type {FrameScheduler} from '@nelyx/core/framework/scheduler/scheduler';

class IncrementIntent extends Intent {}
class IncrementAction extends Action<IncrementIntent> {
  private enabled=true;
  constructor(private readonly increment:()=>void){super(IncrementIntent);}
  override get isActionEnabled():boolean{return this.enabled;}
  setEnabled(value:boolean):void{if(value===this.enabled)return;this.enabled=value;this.notifyActionListeners();}
  invoke(_intent:IncrementIntent):null{this.increment();return null;}
}
export class KeyboardLab extends StatefulWidget {
  constructor(readonly onBack:()=>void,readonly scheduler:FrameScheduler){super();}
  createState():State{return new KeyboardLabState();}
}
class KeyboardLabState extends State<KeyboardLab> {
  private inner=0;private outer=0;private modal=false;private keys='none';private actionsPanel=false;private dispatchPanel=false;
  private readonly innerAction=new IncrementAction(()=>this.setState(()=>{this.inner++;}));
  private readonly openManager=new ShortcutManager();private readonly modalManager=new ShortcutManager({modal:true});
  private keyboard:HardwareKeyboard|undefined;
  private readonly keyChanged=(_event:KeyEvent)=>{if(this.mounted){const keys=[...this.keyboard!.logicalKeysPressed].map(key=>key.keyLabel).join(' + ')||'none';if(keys!==this.keys)this.setState(()=>{this.keys=keys;});}return false;};
  override initState():void{if(!(this.context instanceof Element))throw new Error('KeyboardLab requires Element');this.keyboard=this.context.owner.keyboard;this.keyboard.addHandler(this.keyChanged);}
  override dispose():void{this.keyboard?.removeHandler(this.keyChanged);this.openManager.dispose();this.modalManager.dispose();}
  build(context:BuildContext):Widget{
    if(this.dispatchPanel)return new KeyboardDispatchLab(()=>this.setState(()=>{this.dispatchPanel=false;}));
    if(this.actionsPanel)return new ActionsLab(this.widget.scheduler,()=>this.setState(()=>{this.actionsPanel=false;}));
    const color=AppTheme.of(context).foreground;
    const innerActions=new Map<IntentType,ActionHandle>([[IncrementIntent,this.innerAction]]),outerActions=new Map<IntentType,ActionHandle>([[IncrementIntent,new CallbackAction(IncrementIntent,()=>this.setState(()=>{this.outer++;}))]]);
    const shortcuts=new Map<ShortcutActivator,Intent>([[new SingleActivator(LogicalKeyboardKey.keyK,{control:true,includeRepeats:false}),new IncrementIntent()]]);
    return new Shortcuts({shortcuts,child:new Actions({actions:outerActions,child:new Scaffold('Keyboard lab',new Column([
      new Text('Tab / Shift+Tab to move. Enter / Space to activate.',{fontSize:15,color}),
      new Text(`Inner ${this.inner} · Outer ${this.outer}`,{fontSize:22,color}),
      new Text(`Keys: ${this.keys}`,{fontSize:14,color}),
      new FilledButton('keyboard-outer','Outer target · Ctrl+K',()=>{}),
      Shortcuts.manager(this.modal?this.modalManager:this.openManager,new Actions({actions:innerActions,child:new Column([
        new FilledButton('keyboard-inner','Inner target · Ctrl+K',()=>{}),
        new FilledButton('keyboard-enable',this.innerAction.isActionEnabled?'Disable inner action':'Enable inner action',()=>this.setState(()=>this.innerAction.setEnabled(!this.innerAction.isActionEnabled))),
        new FilledButton('keyboard-modal',this.modal?'Open shortcut propagation':'Block shortcut propagation',()=>this.setState(()=>{this.modal=!this.modal;})),
      ],{spacing:10,crossAlign:'stretch'})})),
      new FilledButton('keyboard-actions-lab','Actions and focus',()=>this.setState(()=>{this.actionsPanel=true;})),
      new FilledButton('keyboard-dispatch-lab','Keyboard dispatch',()=>this.setState(()=>{this.dispatchPanel=true;})),
    ],{spacing:12,crossAlign:'stretch'}),new FilledButton('keyboard-back','Back',this.widget.onBack))})});
  }
}
