// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/segmented_control.dart, sliding_segmented_control.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Focus } from '@nelyx/core/framework/widgets/focus-scope';
import { Element, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import type { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { RadioGroup } from '@nelyx/core/framework/widgets/radio-group';
import type { RadioClient, RadioGroupRegistry } from '@nelyx/core/framework/widgets/radio-group';
import { SingleActivator } from '@nelyx/core/framework/widgets/shortcuts';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';

const space = new SingleActivator(LogicalKeyboardKey.space);
const enter = new SingleActivator(LogicalKeyboardKey.enter);

export class SegmentFocusButton extends StatefulWidget {
  constructor(
    readonly token: object,
    readonly value: number,
    readonly enabled: boolean,
    readonly child: Widget,
    key: GlobalKey<SegmentFocusButtonState>,
    readonly onActivate: (() => void) | null = null,
  ) {
    super(key);
  }
  override createState(): SegmentFocusButtonState {
    return new SegmentFocusButtonState();
  }
}

export class SegmentFocusButtonState
  extends State<SegmentFocusButton>
  implements RadioClient<number>
{
  private registry: RadioGroupRegistry<number> | null = null;
  readonly focusNode = new FocusNode({ debugLabel: 'Cupertino segment' });
  readonly tristate = false;
  get enabled(): boolean {
    return this.widget.enabled;
  }
  get radioValue(): number {
    return this.widget.value;
  }
  override build(context: BuildContext): Widget {
    const registry = this.enabled ? RadioGroup.maybeOf<number>(context, this.widget.token) : null;
    if (registry !== this.registry) {
      this.registry?.unregisterClient(this);
      this.registry = registry;
      registry?.registerClient(this);
    }
    return new Focus(this.widget.child, {
      focusNode: this.focusNode,
      canRequestFocus: this.enabled,
      onKeyEvent: (_node, event) => {
        if (!this.registry || !(context instanceof Element)) return 'ignored';
        const callback = this.widget.onActivate;
        const keyboard = context.owner.keyboard;
        if (!space.accepts(event, keyboard) && (!callback || !enter.accepts(event, keyboard)))
          return 'ignored';
        if (callback) callback();
        else if (this.registry.groupValue !== this.radioValue)
          this.registry.onChanged(this.radioValue);
        return 'handled';
      },
    });
  }
  override dispose(): void {
    this.registry?.unregisterClient(this);
    this.focusNode.dispose();
    super.dispose();
  }
}
