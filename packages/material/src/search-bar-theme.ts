// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { SearchBarThemeData } from './search-bar-theme-data.ts';
export { SearchBarThemeData } from './search-bar-theme-data.ts';
export type { SearchBarThemeDataOptions } from './search-bar-theme-data.ts';
export class SearchBarTheme extends InheritedWidget {
  constructor(
    readonly data: SearchBarThemeData,
    child: Widget,
    options: WidgetOptions = {},
  ) {
    super(child, options.key ?? null);
  }
  static of(context: BuildContext): SearchBarThemeData {
    return context.maybeDependOn(SearchBarTheme)?.data ?? Theme.of(context).searchBarTheme;
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
