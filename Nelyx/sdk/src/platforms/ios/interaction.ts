// SPDX-License-Identifier: BSD-3-Clause
import type {ViewOwner} from '@nelyx/core/ui/types';
import {ReactNativeInteraction} from '../../backends/react-native/interaction.ts';
/** Apple public TextInput events expose UTF-16 selection/event counts; composing ranges remain unavailable. */
export class IOSInteraction extends ReactNativeInteraction {
  constructor(owner:ViewOwner){super(owner,{commands:true,selectionEvents:true,semantics:'native-controls'});}
}
