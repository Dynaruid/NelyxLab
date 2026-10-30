// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { Theme } from './theme.ts';
import { TabBarThemeData } from './tab-bar-theme-data.ts';
export { TabBarThemeData } from './tab-bar-theme-data.ts';
export type { TabBarThemeDataOptions } from './tab-bar-theme-data.ts';
export class TabBarTheme extends InheritedTheme {
  readonly data: TabBarThemeData;
  constructor(
    data: TabBarThemeData | null = null,
    child: Widget | null = null,
    options: WidgetOptions = {},
  ) {
    super(child ?? new SizedBox(), options.key ?? null);
    if (data !== null && !(data instanceof TabBarThemeData))
      throw new TypeError('Expected canonical TabBarThemeData');
    this.data = data ?? new TabBarThemeData();
  }
  static of(context: BuildContext): TabBarThemeData {
    return context.maybeDependOn(TabBarTheme)?.data ?? Theme.of(context).tabBarTheme;
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new TabBarTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
