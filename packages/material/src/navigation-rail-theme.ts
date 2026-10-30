// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { NavigationRailThemeData } from './navigation-rail-theme-data.ts';
export { NavigationRailThemeData } from './navigation-rail-theme-data.ts';
export type { NavigationRailThemeDataOptions } from './navigation-rail-theme-data.ts';
export class NavigationRailTheme extends InheritedTheme {
  readonly data: NavigationRailThemeData;
  constructor(data: NavigationRailThemeData, child: Widget, options: WidgetOptions = {}) {
    super(child, options.key ?? null);
    if (!(data instanceof NavigationRailThemeData))
      throw new TypeError('Expected canonical NavigationRailThemeData');
    this.data = data;
  }
  static of(context: BuildContext): NavigationRailThemeData {
    return (
      context.maybeDependOn(NavigationRailTheme)?.data ?? Theme.of(context).navigationRailTheme
    );
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new NavigationRailTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
