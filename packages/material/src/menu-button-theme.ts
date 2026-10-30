// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { MenuButtonThemeData } from './menu-button-theme-data.ts';
export { MenuButtonThemeData } from './menu-button-theme-data.ts';
export type { MenuButtonThemeDataOptions } from './menu-button-theme-data.ts';
export class MenuButtonTheme extends InheritedTheme {
  constructor(
    readonly data: MenuButtonThemeData,
    child: Widget,
    options: WidgetOptions = {},
  ) {
    super(child, options.key ?? null);
  }
  static of(context: BuildContext): MenuButtonThemeData {
    return context.maybeDependOn(MenuButtonTheme)?.data ?? Theme.of(context).menuButtonTheme;
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new MenuButtonTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
