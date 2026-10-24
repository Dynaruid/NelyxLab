// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from "@nelyx/core/framework/widgets/inherited-theme";
import type { Widget, BuildContext, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { SizedBox } from "@nelyx/core/framework/widgets/basic";
import { Theme } from "./theme.ts";
import { BottomAppBarThemeData } from "./bottom-app-bar-theme-data.ts";
export { BottomAppBarThemeData } from "./bottom-app-bar-theme-data.ts";
export type { BottomAppBarThemeDataOptions } from "./bottom-app-bar-theme-data.ts";
export class BottomAppBarTheme extends InheritedTheme {
    readonly data: BottomAppBarThemeData;
    constructor(data: BottomAppBarThemeData | null = null, child: Widget | null = null, options: WidgetOptions = {}) {
        super(child ?? new SizedBox(), options.key ?? null);
        if (data !== null && !(data instanceof BottomAppBarThemeData)) throw new TypeError("Expected canonical BottomAppBarThemeData");
        this.data = data ?? new BottomAppBarThemeData();
    }
    static of(context: BuildContext): BottomAppBarThemeData { return context.maybeDependOn(BottomAppBarTheme)?.data ?? Theme.of(context).bottomAppBarTheme; }
    wrap(_context: BuildContext, child: Widget): Widget { return new BottomAppBarTheme(this.data, child); }
    updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
