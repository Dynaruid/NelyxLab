// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from "@nelyx/core/framework/widgets/inherited-theme";
import type { BuildContext, Widget, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { Theme } from "./theme.ts";
import { NavigationDrawerThemeData } from "./navigation-drawer-theme-data.ts";
export { NavigationDrawerThemeData } from "./navigation-drawer-theme-data.ts";
export type { NavigationDrawerThemeDataOptions } from "./navigation-drawer-theme-data.ts";
export class NavigationDrawerTheme extends InheritedTheme {
  constructor(readonly data: NavigationDrawerThemeData, child: Widget, options: WidgetOptions = {}) { super(child, options.key ?? null);  }
  static of(context: BuildContext): NavigationDrawerThemeData { return context.maybeDependOn(NavigationDrawerTheme)?.data ?? Theme.of(context).navigationDrawerTheme; }
  wrap(_context: BuildContext, child: Widget): Widget { return new NavigationDrawerTheme(this.data, child); }
  updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
