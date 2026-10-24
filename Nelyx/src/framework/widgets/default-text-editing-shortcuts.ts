// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed wrapper and fixed platform data from default_text_editing_shortcuts.dart.
import {StatelessWidget} from './framework.ts';
import type {Widget,BuildContext,WidgetOptions} from './framework.ts';
import {FoundationPlatform} from '../../foundation/platform.ts';
import {Shortcuts} from './shortcuts.ts';
import type {Intent} from './actions.ts';
import {textEditingShortcutMaps,macOSSelectorIntents} from './text-editing-shortcuts-data.ts';

export class DefaultTextEditingShortcuts extends StatelessWidget {
  constructor(readonly child:Widget,{key=null}:WidgetOptions={}){super(key);}
  build(_context:BuildContext):Widget{
    // Core owns visible editing; OS/DOM carriers must not disable its Actions.
    return new Shortcuts({debugLabel:'<Default Text Editing Shortcuts>',shortcuts:textEditingShortcutMaps[FoundationPlatform.defaultTargetPlatform],child:this.child});
  }
}

export function intentForMacOSSelector(selectorName:string):Intent|null{return macOSSelectorIntents.get(selectorName)??null;}
