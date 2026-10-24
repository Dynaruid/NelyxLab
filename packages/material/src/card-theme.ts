// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedWidget } from "@nelyx/core/framework/widgets/framework";
import type { BuildContext, Widget, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { SizedBox } from "@nelyx/core/framework/widgets/basic";
import { Theme } from "./theme.ts";
import { CardThemeData } from "./card-theme-data.ts";
export { CardThemeData } from "./card-theme-data.ts";
export type { CardThemeDataOptions } from "./card-theme-data.ts";
// Modern data mode; obsolete standalone field aliases are excluded.
export class CardTheme extends InheritedWidget {
  readonly data: CardThemeData;
  constructor(data: CardThemeData | null = null, child: Widget | null = null, options: WidgetOptions = {}) { super(child ?? new SizedBox(), options.key ?? null); this.data = data ?? new CardThemeData(); }
  static of(context: BuildContext): CardThemeData { return context.maybeDependOn(CardTheme)?.data ?? Theme.of(context).cardTheme; }
  updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
