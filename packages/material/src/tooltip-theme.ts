// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter material/tooltip_theme.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import {InheritedTheme} from '@nelyx/core/framework/widgets/inherited-theme';
import type {Widget, BuildContext, WidgetOptions} from '@nelyx/core/framework/widgets/framework';
import {Theme} from './theme.ts';
import {TooltipThemeData} from './tooltip-theme-data.ts';
export {TooltipThemeData} from './tooltip-theme-data.ts';
export type {TooltipThemeDataOptions} from './tooltip-theme-data.ts';

export class TooltipTheme extends InheritedTheme {
    constructor(readonly data: TooltipThemeData, child: Widget, options: WidgetOptions = {}) {
        super(child, options.key ?? null);
    }
    static of(context: BuildContext): TooltipThemeData {
        return context.maybeDependOn(TooltipTheme)?.data ?? Theme.of(context).tooltipTheme;
    }
    wrap(_context: BuildContext, child: Widget): Widget {
        return new TooltipTheme(this.data, child);
    }
    updateShouldNotify(old: this): boolean {
        return !this.data.equals(old.data);
    }
}