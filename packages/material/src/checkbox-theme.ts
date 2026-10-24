// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { CheckboxThemeData } from "./generated/theme/toggle-theme-data.generated.ts";
export class CheckboxTheme extends InheritedTheme {
    constructor(readonly data: CheckboxThemeData, child: Widget, options: WidgetOptions = {}) {
        super(child, options.key ?? null);
    }
    static of(context: BuildContext): CheckboxThemeData {
        return context.maybeDependOn(CheckboxTheme)?.data ?? Theme.of(context).checkboxTheme;
    }
    wrap(_context: BuildContext, child: Widget): Widget {
        return new CheckboxTheme(this.data, child);
    }
    updateShouldNotify(old: this): boolean {
        return !this.data.equals(old.data);
    }
}
export { CheckboxThemeData } from "./generated/theme/toggle-theme-data.generated.ts";
export type { CheckboxThemeOptions } from "./generated/theme/toggle-theme-data.generated.ts";
