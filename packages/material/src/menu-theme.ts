// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from "@nelyx/core/framework/widgets/inherited-theme";
import type { BuildContext, Widget, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { Theme } from "./theme.ts";
import { MenuThemeData } from "./menu-theme-data.ts";
export { MenuThemeData } from "./menu-theme-data.ts";
export type { MenuThemeDataOptions } from "./menu-theme-data.ts";
export class MenuTheme extends InheritedTheme {
  constructor(readonly data: MenuThemeData, child: Widget, options: WidgetOptions = {}) { super(child, options.key ?? null);  }
  static of(context: BuildContext): MenuThemeData { return context.maybeDependOn(MenuTheme)?.data ?? Theme.of(context).menuTheme; }
  wrap(_context: BuildContext, child: Widget): Widget { return new MenuTheme(this.data, child); }
  updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
