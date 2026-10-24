// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from "@nelyx/core/framework/widgets/inherited-theme";
import type { BuildContext, Widget, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { Theme } from "./theme.ts";
import { FloatingActionButtonThemeData } from "./floating-action-button-theme-data.ts";
export { FloatingActionButtonThemeData } from "./floating-action-button-theme-data.ts";
export type { FloatingActionButtonThemeDataOptions } from "./floating-action-button-theme-data.ts";
export class FloatingActionButtonTheme extends InheritedTheme {
  constructor(readonly data: FloatingActionButtonThemeData, child: Widget, options: WidgetOptions = {}) { super(child, options.key ?? null);  }
  static of(context: BuildContext): FloatingActionButtonThemeData { return context.maybeDependOn(FloatingActionButtonTheme)?.data ?? Theme.of(context).floatingActionButtonTheme; }
  wrap(_context: BuildContext, child: Widget): Widget { return new FloatingActionButtonTheme(this.data, child); }
  updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
