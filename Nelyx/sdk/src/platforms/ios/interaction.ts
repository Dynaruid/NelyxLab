// SPDX-License-Identifier: BSD-3-Clause
import type {ViewOwner} from '@nelyx/core/ui/types';
import {NativeInteraction} from '../../runtime/native-interaction.ts';
/** Apple public TextInput events expose UTF-16 selection/event counts; composing ranges remain unavailable. */
export class IOSInteraction extends NativeInteraction {
  constructor(owner:ViewOwner){super(owner,{commands:true,selectionEvents:true,semantics:'native-controls'});}
}
