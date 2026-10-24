// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from "@nelyx/core/framework/widgets/inherited-theme";
import type { BuildContext, Widget, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { Theme } from "./theme.ts";
import { ExpansionTileThemeData } from "./expansion-tile-theme-data.ts";
export { ExpansionTileThemeData } from "./expansion-tile-theme-data.ts";
export type { ExpansionTileThemeDataOptions } from "./expansion-tile-theme-data.ts";
export class ExpansionTileTheme extends InheritedTheme {
  constructor(readonly data: ExpansionTileThemeData, child: Widget, options: WidgetOptions = {}) { super(child, options.key ?? null);  }
  static of(context: BuildContext): ExpansionTileThemeData { return context.maybeDependOn(ExpansionTileTheme)?.data ?? Theme.of(context).expansionTileTheme; }
  wrap(_context: BuildContext, child: Widget): Widget { return new ExpansionTileTheme(this.data, child); }
  updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
