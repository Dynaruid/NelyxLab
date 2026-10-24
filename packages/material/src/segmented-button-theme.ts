// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from "@nelyx/core/framework/widgets/inherited-theme";
import type { BuildContext, Widget, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { Theme } from "./theme.ts";
import { SegmentedButtonThemeData } from "./segmented-button-theme-data.ts";
export { SegmentedButtonThemeData } from "./segmented-button-theme-data.ts";
export type { SegmentedButtonThemeDataOptions } from "./segmented-button-theme-data.ts";
export class SegmentedButtonTheme extends InheritedTheme {
  constructor(readonly data: SegmentedButtonThemeData, child: Widget, options: WidgetOptions = {}) { super(child, options.key ?? null);  }
  static maybeOf(context: BuildContext): SegmentedButtonThemeData | null { return context.maybeDependOn(SegmentedButtonTheme)?.data ?? null; }
  static of(context: BuildContext): SegmentedButtonThemeData { return context.maybeDependOn(SegmentedButtonTheme)?.data ?? Theme.of(context).segmentedButtonTheme; }
  wrap(_context: BuildContext, child: Widget): Widget { return new SegmentedButtonTheme(this.data, child); }
  updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
