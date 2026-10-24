// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from "@nelyx/core/framework/widgets/inherited-theme";
import type { BuildContext, Widget, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { Theme } from "./theme.ts";
import { NavigationBarThemeData } from "./navigation-bar-theme-data.ts";
export { NavigationBarThemeData } from "./navigation-bar-theme-data.ts";
export type { NavigationBarThemeDataOptions } from "./navigation-bar-theme-data.ts";
export class NavigationBarTheme extends InheritedTheme {
  constructor(readonly data: NavigationBarThemeData, child: Widget, options: WidgetOptions = {}) { super(child, options.key ?? null);  }
  static of(context: BuildContext): NavigationBarThemeData { return context.maybeDependOn(NavigationBarTheme)?.data ?? Theme.of(context).navigationBarTheme; }
  wrap(_context: BuildContext, child: Widget): Widget { return new NavigationBarTheme(this.data, child); }
  updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
