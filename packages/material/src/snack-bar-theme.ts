// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { SnackBarThemeData } from './snack-bar-theme-data.ts';
export { SnackBarThemeData } from './snack-bar-theme-data.ts';
export type { SnackBarThemeDataOptions } from './snack-bar-theme-data.ts';
export class SnackBarTheme extends InheritedTheme {
  readonly data: SnackBarThemeData;
  constructor(data: SnackBarThemeData, child: Widget, options: WidgetOptions = {}) {
    super(child, options.key ?? null);
    if (!(data instanceof SnackBarThemeData))
      throw new TypeError('Expected canonical SnackBarThemeData');
    this.data = data;
  }
  static of(context: BuildContext): SnackBarThemeData {
    return context.maybeDependOn(SnackBarTheme)?.data ?? Theme.of(context).snackBarTheme;
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new SnackBarTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
