// SPDX-License-Identifier: BSD-3-Clause
import type {ViewOwner} from '@nelyx/core/ui/types';
import {ReactNativeInteraction} from '../../backends/react-native/interaction.ts';
/** The owned single-line RNL port supplies UTF-16 selection and event-count-gated commands. Composing/direction remain unavailable. */
export class LinuxInteraction extends ReactNativeInteraction {
  constructor(owner:ViewOwner){super(owner,{commands:true,selectionEvents:true,semantics:'native-controls'});}
}
