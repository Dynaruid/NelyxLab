// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Shared application keyboard/traversal composition on the owning Core tree.
import {StatelessWidget} from './framework.ts';
import type {Widget,WidgetOptions} from './framework.ts';
import {Actions,ActivateIntent,ButtonActivateIntent} from './actions.ts';
import type {Intent,IntentType,ActionHandle} from './actions.ts';
import {Shortcuts,SingleActivator} from './shortcuts.ts';
import type {ShortcutActivator} from './shortcuts.ts';
import {NextFocusAction,NextFocusIntent,PreviousFocusAction,PreviousFocusIntent,DirectionalFocusAction,DirectionalFocusIntent} from './focus-traversal.ts';
import {FocusTraversalGroup} from './focus-traversal-group.ts';
import {FocusScope} from './focus-scope.ts';
import {LogicalKeyboardKey} from '../../services/keyboard-key.ts';
import {DefaultTextEditingShortcuts} from './default-text-editing-shortcuts.ts';
export interface AppFocusOptions extends WidgetOptions {
  readonly shortcuts?:ReadonlyMap<ShortcutActivator,Intent>;
  readonly actions?:ReadonlyMap<IntentType,ActionHandle>;
}
export class AppFocus extends StatelessWidget {
  constructor(readonly child:Widget,readonly options:AppFocusOptions={}){super(options.key??null);}
  build():Widget {
    const shortcuts=this.options.shortcuts??new Map<ShortcutActivator,Intent>([
      [new SingleActivator(LogicalKeyboardKey.tab),new NextFocusIntent()],
      [new SingleActivator(LogicalKeyboardKey.tab,{shift:true}),new PreviousFocusIntent()],
      [new SingleActivator(LogicalKeyboardKey.enter,{includeRepeats:false}),new ButtonActivateIntent()],
      [new SingleActivator(LogicalKeyboardKey.numpadEnter,{includeRepeats:false}),new ButtonActivateIntent()],
      [new SingleActivator(LogicalKeyboardKey.space,{includeRepeats:false}),new ActivateIntent()],
      [new SingleActivator(LogicalKeyboardKey.arrowUp),new DirectionalFocusIntent('up')],
      [new SingleActivator(LogicalKeyboardKey.arrowDown),new DirectionalFocusIntent('down')],
      [new SingleActivator(LogicalKeyboardKey.arrowLeft),new DirectionalFocusIntent('left')],
      [new SingleActivator(LogicalKeyboardKey.arrowRight),new DirectionalFocusIntent('right')],
    ]);
    const actions=this.options.actions??new Map<IntentType,ActionHandle>([[NextFocusIntent,new NextFocusAction()],[PreviousFocusIntent,new PreviousFocusAction()],[DirectionalFocusIntent,new DirectionalFocusAction()]]);
    return new Actions({actions:new Map(actions),child:new Shortcuts({shortcuts:new Map(shortcuts),child:new DefaultTextEditingShortcuts(new FocusTraversalGroup(new FocusScope(this.child,{autofocus:true,skipTraversal:true,includeSemantics:false})))})});
  }
}
