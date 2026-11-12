// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { DatePickerThemeData } from './date-picker-theme-data.ts';
export { DatePickerThemeData } from './date-picker-theme-data.ts';
export type { DatePickerThemeDataOptions } from './date-picker-theme-data.ts';
import { DatePickerDefaultsM3 } from './internal/theme/date-picker-defaults.ts';
import type { ThemeData } from './theme-data.ts';
const defaults = new WeakMap<ThemeData, DatePickerDefaultsM3>();
export class DatePickerTheme extends InheritedTheme {
  readonly data: DatePickerThemeData;
  constructor(data: DatePickerThemeData, child: Widget, options: WidgetOptions = {}) {
    super(child, options.key ?? null);
    if (!(data instanceof DatePickerThemeData))
      throw new TypeError('Expected canonical DatePickerThemeData');
    this.data = data;
  }
  static maybeOf(context: BuildContext): DatePickerThemeData | null {
    return context.maybeDependOn(DatePickerTheme)?.data ?? null;
  }
  static of(context: BuildContext): DatePickerThemeData {
    return DatePickerTheme.maybeOf(context) ?? Theme.of(context).datePickerTheme;
  }
  static defaults(context: BuildContext): DatePickerThemeData {
    // Register each caller's inherited dependencies even when the immutable
    // defaults are shared. The value retains only ThemeData, never the first
    // calendar Element/context for the lifetime of an application theme.
    const theme = Theme.of(context);
    let result = defaults.get(theme);
    if (!result) defaults.set(theme, (result = new DatePickerDefaultsM3(null, theme)));
    return result;
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new DatePickerTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
