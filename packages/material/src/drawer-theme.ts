// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from "@nelyx/core/framework/widgets/inherited-theme";
import type { BuildContext, Widget, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { Theme } from "./theme.ts";
import { DrawerThemeData } from "./drawer-theme-data.ts";
export { DrawerThemeData } from "./drawer-theme-data.ts";
export type { DrawerThemeDataOptions } from "./drawer-theme-data.ts";
export class DrawerTheme extends InheritedTheme {
  constructor(readonly data: DrawerThemeData, child: Widget, options: WidgetOptions = {}) { super(child, options.key ?? null);  }
  static of(context: BuildContext): DrawerThemeData { return context.maybeDependOn(DrawerTheme)?.data ?? Theme.of(context).drawerTheme; }
  wrap(_context: BuildContext, child: Widget): Widget { return new DrawerTheme(this.data, child); }
  updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
