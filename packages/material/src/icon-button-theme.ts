// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { IconButtonThemeData } from './icon-button-theme-data.ts';
export { IconButtonThemeData } from './icon-button-theme-data.ts';

export class IconButtonTheme extends InheritedTheme {
  constructor(
    readonly data: IconButtonThemeData,
    child: Widget,
    options: WidgetOptions = {},
  ) {
    super(child, options.key ?? null);
  }
  static of(context: BuildContext): IconButtonThemeData {
    return context.maybeDependOn(IconButtonTheme)?.data ?? Theme.of(context).iconButtonTheme;
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new IconButtonTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
