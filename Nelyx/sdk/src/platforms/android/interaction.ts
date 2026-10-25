// SPDX-License-Identifier: BSD-3-Clause
import type {ViewOwner} from '@nelyx/core/ui/types';
import {NativeInteraction} from '../../runtime/native-interaction.ts';
/** Android's nonvisual InputConnection observes the IME; Core supplies geometry. */
export class AndroidInteraction extends NativeInteraction {
  constructor(owner:ViewOwner){super(owner,{commands:true,selectionEvents:true,semantics:'native-controls',nativeSnapshots:true,geometry:'unavailable'});}
}
