// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { ChipThemeData } from './chip-theme-data.ts';
export { ChipThemeData } from './chip-theme-data.ts';
export type { ChipThemeDataOptions } from './chip-theme-data.ts';

export class ChipTheme extends InheritedTheme {
  constructor(
    readonly data: ChipThemeData,
    child: Widget,
    options: WidgetOptions = {},
  ) {
    super(child, options.key ?? null);
  }
  static of(context: BuildContext): ChipThemeData {
    return context.maybeDependOn(ChipTheme)?.data ?? Theme.of(context).chipTheme;
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new ChipTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
