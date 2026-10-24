// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from "@nelyx/core/framework/widgets/inherited-theme";
import type { BuildContext, Widget, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { Theme } from "./theme.ts";
import { MenuBarThemeData } from "./menu-bar-theme-data.ts";
export { MenuBarThemeData } from "./menu-bar-theme-data.ts";
export type { MenuBarThemeDataOptions } from "./menu-bar-theme-data.ts";
export class MenuBarTheme extends InheritedTheme {
  constructor(readonly data: MenuBarThemeData, child: Widget, options: WidgetOptions = {}) { super(child, options.key ?? null);  }
  static of(context: BuildContext): MenuBarThemeData { return context.maybeDependOn(MenuBarTheme)?.data ?? Theme.of(context).menuBarTheme; }
  wrap(_context: BuildContext, child: Widget): Widget { return new MenuBarTheme(this.data, child); }
  updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
