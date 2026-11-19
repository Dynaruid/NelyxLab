// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter packages/flutter/lib/src/material/button_bar_theme.dart
// at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { InheritedWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import type { ButtonBarThemeData } from './button-bar-theme-data.ts';
import { Theme } from './theme.ts';

export { ButtonBarThemeData } from './button-bar-theme-data.ts';
export type { ButtonBarThemeDataOptions } from './button-bar-theme-data.ts';

/** @deprecated Use OverflowBar and its child button themes. */
export class ButtonBarTheme extends InheritedWidget {
  constructor(
    readonly data: ButtonBarThemeData,
    child: Widget,
    options: WidgetOptions = {},
  ) {
    super(child, options.key ?? null);
  }

  static of(context: BuildContext): ButtonBarThemeData {
    return context.maybeDependOn(ButtonBarTheme)?.data ?? Theme.of(context).buttonBarTheme;
  }

  override updateShouldNotify(old: ButtonBarTheme): boolean {
    return !this.data.equals(old.data);
  }
}
