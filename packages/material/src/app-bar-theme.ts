import {registerAppBarTheme} from './internal/theme/theme-value-wrappers.ts';
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from "@nelyx/core/framework/widgets/inherited-theme";
import type { Widget, BuildContext, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { SizedBox } from "@nelyx/core/framework/widgets/basic";
import { Theme } from "./theme.ts";
import { AppBarThemeData } from "./app-bar-theme-data.ts";
export { AppBarThemeData } from "./app-bar-theme-data.ts";
export type { AppBarThemeDataOptions } from "./app-bar-theme-data.ts";
export class AppBarTheme extends InheritedTheme {
    readonly data: AppBarThemeData;
    constructor(data: AppBarThemeData | null = null, child: Widget | null = null, options: WidgetOptions = {}) {
        super(child ?? new SizedBox(), options.key ?? null);
        if (data !== null && !(data instanceof AppBarThemeData)) throw new TypeError("Expected canonical AppBarThemeData");
        this.data = data ?? new AppBarThemeData();
        registerAppBarTheme(this);
    }
    static of(context: BuildContext): AppBarThemeData { return context.maybeDependOn(AppBarTheme)?.data ?? Theme.of(context).appBarTheme; }
    wrap(_context: BuildContext, child: Widget): Widget { return new AppBarTheme(this.data, child); }
    updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
