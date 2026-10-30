// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { SearchViewThemeData } from './search-view-theme-data.ts';
export { SearchViewThemeData } from './search-view-theme-data.ts';
export type { SearchViewThemeDataOptions } from './search-view-theme-data.ts';
export class SearchViewTheme extends InheritedTheme {
  constructor(
    readonly data: SearchViewThemeData,
    child: Widget,
    options: WidgetOptions = {},
  ) {
    super(child, options.key ?? null);
  }
  static of(context: BuildContext): SearchViewThemeData {
    return context.maybeDependOn(SearchViewTheme)?.data ?? Theme.of(context).searchViewTheme;
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new SearchViewTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
