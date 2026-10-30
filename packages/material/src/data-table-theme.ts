// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { DataTableThemeData } from './data-table-theme-data.ts';
export { DataTableThemeData } from './data-table-theme-data.ts';
export type { DataTableThemeDataOptions } from './data-table-theme-data.ts';
export class DataTableTheme extends InheritedWidget {
  readonly data: DataTableThemeData;
  constructor(data: DataTableThemeData, child: Widget, options: WidgetOptions = {}) {
    super(child, options.key ?? null);
    if (!(data instanceof DataTableThemeData))
      throw new TypeError('Expected canonical DataTableThemeData');
    this.data = data;
  }
  static of(context: BuildContext): DataTableThemeData {
    return context.maybeDependOn(DataTableTheme)?.data ?? Theme.of(context).dataTableTheme;
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
