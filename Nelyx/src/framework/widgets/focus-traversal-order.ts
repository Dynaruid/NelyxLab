// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from FocusTraversalOrder in widgets/focus_traversal.dart.
import { invariant } from '../../foundation/errors.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import { InheritedWidget } from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';
import { FocusOrder } from './focus-traversal-policy.ts';
import { markFocusOrder } from './focus-traversal-context.ts';
export class FocusTraversalOrder extends InheritedWidget {
  constructor(
    readonly order: FocusOrder,
    child: Widget,
    { key = null }: WidgetOptions = {},
  ) {
    super(child, key);
    invariant(
      order instanceof FocusOrder,
      'invalid-focus-order',
      'FocusTraversalOrder requires a FocusOrder',
    );
    markFocusOrder(this, order);
  }
  static maybeOf(context: BuildContext): FocusOrder | null {
    return context.maybeDependOn(FocusTraversalOrder)?.order ?? null;
  }
  static of(context: BuildContext): FocusOrder {
    const order = this.maybeOf(context);
    invariant(order, 'missing-focus-order', 'No FocusTraversalOrder ancestor found');
    return order;
  }
  updateShouldNotify(old: FocusTraversalOrder): boolean {
    return this.order !== old.order;
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('order', this.order));
  }
}
