// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { FilledButtonThemeData } from './filled-button-theme-data.ts';
export { FilledButtonThemeData } from './filled-button-theme-data.ts';
export class FilledButtonTheme extends InheritedTheme {
    constructor(readonly data: FilledButtonThemeData, child: Widget, options: WidgetOptions = {}) { super(child, options.key ?? null); }
    static of(context: BuildContext): FilledButtonThemeData { return context.maybeDependOn(FilledButtonTheme)?.data ?? Theme.of(context).filledButtonTheme; }
    wrap(_context: BuildContext, child: Widget): Widget { return new FilledButtonTheme(this.data, child); }
    updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
