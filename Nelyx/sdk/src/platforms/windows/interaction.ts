// SPDX-License-Identifier: BSD-3-Clause
import type { ViewOwner } from '@nelyx/core/ui/types';
import { NativeInteraction } from '../../runtime/native-interaction.ts';
/** TSF observes input; Core owns glyphs/selection and native geometry is unavailable. */
export class WindowsInteraction extends NativeInteraction {
  constructor(owner: ViewOwner) {
    super(owner, {
      commands: true,
      selectionEvents: true,
      semantics: 'native-controls',
      nativeSnapshots: true,
      geometry: 'unavailable',
      inputControl: 'nonvisual',
    });
  }
}
