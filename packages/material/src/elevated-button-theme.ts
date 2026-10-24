// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { ElevatedButtonThemeData } from './elevated-button-theme-data.ts';
export { ElevatedButtonThemeData } from './elevated-button-theme-data.ts';
export class ElevatedButtonTheme extends InheritedTheme {
    constructor(readonly data: ElevatedButtonThemeData, child: Widget, options: WidgetOptions = {}) { super(child, options.key ?? null); }
    static of(context: BuildContext): ElevatedButtonThemeData { return context.maybeDependOn(ElevatedButtonTheme)?.data ?? Theme.of(context).elevatedButtonTheme; }
    wrap(_context: BuildContext, child: Widget): Widget { return new ElevatedButtonTheme(this.data, child); }
    updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
