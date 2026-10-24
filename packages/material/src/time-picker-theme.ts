// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from "@nelyx/core/framework/widgets/inherited-theme";
import type { Widget, BuildContext, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { Theme } from "./theme.ts";
import { TimePickerThemeData } from "./time-picker-theme-data.ts";
export { TimePickerThemeData } from "./time-picker-theme-data.ts";
export type { TimePickerThemeDataOptions } from "./time-picker-theme-data.ts";
export class TimePickerTheme extends InheritedTheme {
    readonly data: TimePickerThemeData;
    constructor(data: TimePickerThemeData, child: Widget, options: WidgetOptions = {}) {
        super(child, options.key ?? null);
        if (!(data instanceof TimePickerThemeData)) throw new TypeError("Expected canonical TimePickerThemeData");
        this.data = data;
    }
    static of(context: BuildContext): TimePickerThemeData { return context.maybeDependOn(TimePickerTheme)?.data ?? Theme.of(context).timePickerTheme; }
    wrap(_context: BuildContext, child: Widget): Widget { return new TimePickerTheme(this.data, child); }
    updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
