// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional port of pinned Flutter divider_theme.dart on canonical Core values.
import {InheritedTheme} from '@nelyx/core/framework/widgets/inherited-theme';
import type {BuildContext, Widget, WidgetOptions} from '@nelyx/core/framework/widgets/framework';
import {Theme} from './theme.ts';
import {DividerThemeData} from './divider-theme-data.ts';
export {DividerThemeData} from './divider-theme-data.ts';
export type {DividerThemeDataOptions} from './divider-theme-data.ts';

export class DividerTheme extends InheritedTheme {
    constructor(readonly data: DividerThemeData, child: Widget, options: WidgetOptions = {}) {
        super(child, options.key ?? null);
    }
    static of(context: BuildContext): DividerThemeData {
        return context.maybeDependOn(DividerTheme)?.data ?? Theme.of(context).dividerTheme;
    }
    wrap(_context: BuildContext, child: Widget): Widget {
        return new DividerTheme(this.data, child);
    }
    updateShouldNotify(old: this): boolean {
        return !this.data.equals(old.data);
    }
}