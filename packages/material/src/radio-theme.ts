// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { RadioThemeData } from "./generated/theme/toggle-theme-data.generated.ts";
export class RadioTheme extends InheritedTheme {
    constructor(readonly data: RadioThemeData, child: Widget, options: WidgetOptions = {}) {
        super(child, options.key ?? null);
    }
    static of(context: BuildContext): RadioThemeData {
        return context.maybeDependOn(RadioTheme)?.data ?? Theme.of(context).radioTheme;
    }
    wrap(_context: BuildContext, child: Widget): Widget {
        return new RadioTheme(this.data, child);
    }
    updateShouldNotify(old: this): boolean {
        return !this.data.equals(old.data);
    }
}
export { RadioThemeData } from "./generated/theme/toggle-theme-data.generated.ts";
export type { RadioThemeOptions } from "./generated/theme/toggle-theme-data.generated.ts";
