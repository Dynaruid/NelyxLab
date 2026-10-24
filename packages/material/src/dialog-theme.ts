// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from "@nelyx/core/framework/widgets/inherited-theme";
import type { BuildContext, Widget, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { SizedBox } from "@nelyx/core/framework/widgets/basic";
import { Theme } from "./theme.ts";
import { DialogThemeData } from "./dialog-theme-data.ts";
export { DialogThemeData } from "./dialog-theme-data.ts";
export type { DialogThemeDataOptions } from "./dialog-theme-data.ts";
// Modern data mode; obsolete standalone field aliases are excluded.
export class DialogTheme extends InheritedTheme {
  readonly data: DialogThemeData;
  constructor(data: DialogThemeData | null = null, child: Widget | null = null, options: WidgetOptions = {}) { super(child ?? new SizedBox(), options.key ?? null); this.data = data ?? new DialogThemeData(); }
  static of(context: BuildContext): DialogThemeData { return context.maybeDependOn(DialogTheme)?.data ?? Theme.of(context).dialogTheme; }
  wrap(_context: BuildContext, child: Widget): Widget { return new DialogTheme(this.data, child); }
  updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
