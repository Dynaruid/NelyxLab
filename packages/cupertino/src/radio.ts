// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import type { RawRadioOptions } from '@nelyx/core/framework/widgets/radio-group';
import type { RadioGroupRegistry } from '@nelyx/core/framework/widgets/radio-group';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { Color } from '@nelyx/core/ui/color';
import { invariant } from '@nelyx/core/foundation/errors';
import { coreCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import { buildCupertinoRadio } from './internal/radio/radio-build.ts';
export interface CupertinoRadioOptions<T> extends Omit<
  RawRadioOptions<T>,
  'builder' | 'semantics' | 'onLongPress' | 'gestures' | 'enabled' | 'mouseCursor' | 'motion'
> {
  readonly semanticLabel?: string | null;
  readonly id?: string;
  readonly enabled?: boolean | null;
  readonly mouseCursor?: MouseCursor | null;
  readonly activeColor?: CupertinoColor | null;
  readonly inactiveColor?: CupertinoColor | null;
  readonly fillColor?: CupertinoColor | null;
  readonly focusColor?: CupertinoColor | null;
  readonly useCheckmarkStyle?: boolean;
}
export class CupertinoRadio<T> extends StatefulWidget {
  readonly options: Readonly<CupertinoRadioOptions<T>>;
  constructor(options: CupertinoRadioOptions<T>) {
    super(options.key ?? null);
    invariant(
      !('groupValue' in options) && !('onChanged' in options),
      'deprecated-cupertino-radio-option',
      'CupertinoRadio uses a typed RadioGroup or groupRegistry',
    );
    for (const color of [
      options.activeColor,
      options.inactiveColor,
      options.fillColor,
      options.focusColor,
    ])
      invariant(
        color == null || typeof color === 'number' || color instanceof Color,
        'invalid-cupertino-radio-color',
        'CupertinoRadio colors require Core Color or explicit ARGB ingress',
      );
    this.options = Object.freeze({ ...options });
  }
  get value(): T {
    return this.options.value;
  }
  get groupRegistry(): RadioGroupRegistry<T> | null {
    return this.options.groupRegistry ?? null;
  }
  get enabled(): boolean | null {
    return this.options.enabled ?? null;
  }
  get toggleable(): boolean {
    return this.options.toggleable ?? false;
  }
  get useCheckmarkStyle(): boolean {
    return this.options.useCheckmarkStyle ?? false;
  }
  get mouseCursor(): MouseCursor | null {
    return this.options.mouseCursor ?? null;
  }
  get activeColor(): Color | null {
    return this.options.activeColor == null ? null : coreCupertinoColor(this.options.activeColor);
  }
  get inactiveColor(): Color | null {
    return this.options.inactiveColor == null
      ? null
      : coreCupertinoColor(this.options.inactiveColor);
  }
  get fillColor(): Color | null {
    return this.options.fillColor == null ? null : coreCupertinoColor(this.options.fillColor);
  }
  get focusColor(): Color | null {
    return this.options.focusColor == null ? null : coreCupertinoColor(this.options.focusColor);
  }
  get focusNode(): FocusNode | null {
    return this.options.focusNode ?? null;
  }
  get autofocus(): boolean {
    return this.options.autofocus ?? false;
  }
  createState(): State<CupertinoRadio<T>> {
    return new CupertinoRadioState<T>();
  }
}
class CupertinoRadioState<T> extends State<CupertinoRadio<T>> {
  private internalFocusNode: FocusNode | null = null;
  build(context: BuildContext): Widget {
    const widget = this.widget,
      focusNode =
        widget.focusNode ??
        (this.internalFocusNode ??= new FocusNode({ debugLabel: 'CupertinoRadio' }));
    return buildCupertinoRadio(widget, context, focusNode);
  }
  override dispose(): void {
    try {
      this.internalFocusNode?.dispose();
    } finally {
      super.dispose();
    }
  }
}
