// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from widgets/keyboard_listener.dart at the recorded Flutter pin.
import { StatelessWidget } from './framework.ts';
import type { Widget, BuildContext, WidgetOptions } from './framework.ts';
import { Focus } from './focus-scope.ts';
import type { FocusNode } from './focus.ts';
import type { KeyEvent } from '../../services/hardware-keyboard.ts';
import type { ValueChanged } from '../../foundation/basic-types.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
export interface KeyboardListenerOptions extends WidgetOptions {
  readonly focusNode: FocusNode;
  readonly autofocus?: boolean;
  readonly includeSemantics?: boolean;
  readonly onKeyEvent?: ValueChanged<KeyEvent> | null;
}
/** Observes modern focus-path events and always leaves them unhandled. */
export class KeyboardListener extends StatelessWidget {
  readonly focusNode: FocusNode;
  readonly autofocus: boolean;
  readonly includeSemantics: boolean;
  readonly onKeyEvent: ValueChanged<KeyEvent> | null;
  constructor(
    readonly child: Widget,
    {
      focusNode,
      autofocus = false,
      includeSemantics = true,
      onKeyEvent = null,
      key = null,
    }: KeyboardListenerOptions,
  ) {
    super(key);
    this.focusNode = focusNode;
    this.autofocus = autofocus;
    this.includeSemantics = includeSemantics;
    this.onKeyEvent = onKeyEvent;
  }
  build(_context: BuildContext): Widget {
    return new Focus(this.child, {
      focusNode: this.focusNode,
      autofocus: this.autofocus,
      includeSemantics: this.includeSemantics,
      onKeyEvent: (_node, event) => {
        this.onKeyEvent?.(event);
        return 'ignored';
      },
    });
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('focusNode', this.focusNode));
  }
}
