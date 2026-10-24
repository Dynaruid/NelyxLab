// SPDX-License-Identifier: BSD-3-Clause
import type {ViewOwner} from '@nelyx/core/ui/types';
import {ReactNativeInteraction} from '../../backends/react-native/interaction.ts';
/** Android's nonvisual InputConnection observes the IME; Core supplies geometry. */
export class AndroidInteraction extends ReactNativeInteraction {
  constructor(owner:ViewOwner){super(owner,{commands:true,selectionEvents:true,semantics:'native-controls',nativeSnapshots:true,geometry:'unavailable'});}
}
