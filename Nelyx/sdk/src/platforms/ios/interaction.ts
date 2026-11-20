// SPDX-License-Identifier: BSD-3-Clause
import type { ViewOwner } from '@nelyx/core/ui/types';
import { NativeInteraction } from '../../runtime/native-interaction.ts';
/** A UIKit observation bridge adds the marked range to RN's public editor. */
export class IOSInteraction extends NativeInteraction {
  constructor(owner: ViewOwner, observesMarkedText = false) {
    super(owner, {
      commands: true,
      selectionEvents: true,
      semantics: 'native-controls',
      nativeSnapshots: observesMarkedText,
      selectionDirection: 'unavailable',
      geometry: 'unavailable',
    });
  }
}
