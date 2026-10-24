// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from "@nelyx/core/framework/widgets/inherited-theme";
import type { Widget, BuildContext, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { Theme } from "./theme.ts";
import { DatePickerThemeData } from "./date-picker-theme-data.ts";
export { DatePickerThemeData } from "./date-picker-theme-data.ts";
export type { DatePickerThemeDataOptions } from "./date-picker-theme-data.ts";
import { DatePickerDefaultsM3 } from "./internal/theme/date-picker-defaults.ts";
export class DatePickerTheme extends InheritedTheme {
    readonly data: DatePickerThemeData;
    constructor(data: DatePickerThemeData, child: Widget, options: WidgetOptions = {}) {
        super(child, options.key ?? null);
        if (!(data instanceof DatePickerThemeData)) throw new TypeError("Expected canonical DatePickerThemeData");
        this.data = data;
    }
    static maybeOf(context: BuildContext): DatePickerThemeData | null { return context.maybeDependOn(DatePickerTheme)?.data ?? null; }
    static of(context: BuildContext): DatePickerThemeData { return DatePickerTheme.maybeOf(context) ?? Theme.of(context).datePickerTheme; }
    static defaults(context: BuildContext): DatePickerThemeData { return new DatePickerDefaultsM3(context); }
    wrap(_context: BuildContext, child: Widget): Widget { return new DatePickerTheme(this.data, child); }
    updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
