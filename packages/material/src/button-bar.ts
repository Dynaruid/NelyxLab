// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter packages/flutter/lib/src/material/button_bar.dart
// at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { invariant } from '@nelyx/core/foundation/errors';
import { VerticalDirection } from '@nelyx/core/framework/painting/basic-types';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { Center, ConstrainedBox, Padding } from '@nelyx/core/framework/widgets/basic';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { OverflowBar, OverflowBarAlignment } from '@nelyx/core/framework/widgets/overflow-bar';
import { ButtonBarTheme, ButtonBarThemeData } from './button-bar-theme.ts';
import type { ButtonBarThemeDataOptions } from './button-bar-theme.ts';
import { ButtonBarLayoutBehavior, ButtonTextTheme, ButtonTheme } from './button-theme.ts';

export interface ButtonBarOptions extends ButtonBarThemeDataOptions, WidgetOptions {
  readonly children?: readonly Widget[];
  readonly overflowButtonSpacing?: number | null;
}

/** @deprecated Use OverflowBar. */
export class ButtonBar extends StatelessWidget {
  private readonly barStyle: ButtonBarThemeData;
  readonly overflowButtonSpacing: number | null;
  readonly children: readonly Widget[];

  constructor({
    children = [],
    overflowButtonSpacing = null,
    key = null,
    ...style
  }: ButtonBarOptions = {}) {
    super(key);
    invariant(
      overflowButtonSpacing === null || overflowButtonSpacing >= 0,
      'invalid-button-bar-spacing',
      'ButtonBar overflow spacing must be nonnegative',
    );
    this.barStyle = new ButtonBarThemeData(style);
    this.children = children;
    this.overflowButtonSpacing = overflowButtonSpacing;
  }

  get alignment() {
    return this.barStyle.alignment;
  }
  get mainAxisSize() {
    return this.barStyle.mainAxisSize;
  }
  get buttonTextTheme() {
    return this.barStyle.buttonTextTheme;
  }
  get buttonMinWidth() {
    return this.barStyle.buttonMinWidth;
  }
  get buttonHeight() {
    return this.barStyle.buttonHeight;
  }
  get buttonPadding() {
    return this.barStyle.buttonPadding;
  }
  get buttonAlignedDropdown() {
    return this.barStyle.buttonAlignedDropdown;
  }
  get layoutBehavior() {
    return this.barStyle.layoutBehavior;
  }
  get overflowDirection() {
    return this.barStyle.overflowDirection;
  }

  override build(context: BuildContext): Widget {
    const inherited = ButtonBarTheme.of(context);
    const buttonTheme = ButtonTheme.of(context).copyWith({
      textTheme: this.buttonTextTheme ?? inherited.buttonTextTheme ?? ButtonTextTheme.primary,
      minWidth: this.buttonMinWidth ?? inherited.buttonMinWidth ?? 64,
      height: this.buttonHeight ?? inherited.buttonHeight ?? 36,
      padding:
        this.buttonPadding ?? inherited.buttonPadding ?? EdgeInsets.symmetric({ horizontal: 8 }),
      alignedDropdown: this.buttonAlignedDropdown ?? inherited.buttonAlignedDropdown ?? false,
      layoutBehavior:
        this.layoutBehavior ?? inherited.layoutBehavior ?? ButtonBarLayoutBehavior.padded,
    });
    const paddingUnit = buttonTheme.padding.horizontal / 4;
    const buttonPadding = EdgeInsets.symmetric({ horizontal: paddingUnit });
    const alignment = this.alignment ?? inherited.alignment ?? 'end';
    const overflowAlignment =
      alignment === 'center'
        ? OverflowBarAlignment.center
        : alignment === 'end'
          ? OverflowBarAlignment.end
          : OverflowBarAlignment.start;
    const child = ButtonTheme.fromButtonThemeData(
      buttonTheme,
      new OverflowBar({
        alignment,
        mainAxisSize: this.mainAxisSize ?? inherited.mainAxisSize ?? 'max',
        measureUnconstrainedWidth: true,
        overflowAlignment,
        overflowDirection:
          this.overflowDirection ?? inherited.overflowDirection ?? VerticalDirection.down,
        overflowSpacing: this.overflowButtonSpacing ?? 0,
        children: this.children.map((button) => new Padding(buttonPadding, button)),
      }),
    );
    if (buttonTheme.layoutBehavior === ButtonBarLayoutBehavior.constrained) {
      return new ConstrainedBox(
        new Padding(buttonPadding, new Center(child)),
        new BoxConstraints(0, Infinity, 52, Infinity),
      );
    }
    return new Padding(
      EdgeInsets.symmetric({ vertical: 2 * paddingUnit, horizontal: paddingUnit }),
      child,
    );
  }
}
