// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { TextButtonThemeData } from './text-button-theme-data.ts';
export { TextButtonThemeData } from './text-button-theme-data.ts';
export class TextButtonTheme extends InheritedTheme {
    constructor(readonly data: TextButtonThemeData, child: Widget, options: WidgetOptions = {}) { super(child, options.key ?? null); }
    static of(context: BuildContext): TextButtonThemeData { return context.maybeDependOn(TextButtonTheme)?.data ?? Theme.of(context).textButtonTheme; }
    wrap(_context: BuildContext, child: Widget): Widget { return new TextButtonTheme(this.data, child); }
    updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
