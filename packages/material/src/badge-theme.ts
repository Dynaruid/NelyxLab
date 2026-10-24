// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from "@nelyx/core/framework/widgets/inherited-theme";
import type { BuildContext, Widget, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { Theme } from "./theme.ts";
import { BadgeThemeData } from "./badge-theme-data.ts";
export { BadgeThemeData } from "./badge-theme-data.ts";
export type { BadgeThemeDataOptions } from "./badge-theme-data.ts";
export class BadgeTheme extends InheritedTheme {
  constructor(readonly data: BadgeThemeData, child: Widget, options: WidgetOptions = {}) { super(child, options.key ?? null);  }
  static of(context: BuildContext): BadgeThemeData { return context.maybeDependOn(BadgeTheme)?.data ?? Theme.of(context).badgeTheme; }
  wrap(_context: BuildContext, child: Widget): Widget { return new BadgeTheme(this.data, child); }
  updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
