// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {InheritedTheme} from "@nelyx/core/framework/widgets/inherited-theme";
import {DefaultSelectionStyle} from "@nelyx/core/framework/widgets/default-selection-style";
import type {BuildContext, Widget} from "@nelyx/core/framework/widgets/framework";
import {Theme} from './theme.ts';
import {TextSelectionThemeData} from './text-selection-theme-data.ts';
export {TextSelectionThemeData} from './text-selection-theme-data.ts';
export type {TextSelectionThemeDataOptions} from './text-selection-theme-data.ts';

export class TextSelectionTheme extends InheritedTheme {
    constructor(readonly data: TextSelectionThemeData, child: Widget) {
        super(new DefaultSelectionStyle({
            cursorColor: data.cursorColor, selectionColor: data.selectionColor, child
        }));
    }
    static of(context: BuildContext): TextSelectionThemeData {
        return context.maybeDependOn(TextSelectionTheme)?.data ?? Theme.of(context).textSelectionTheme;
    }
    wrap(_context: BuildContext, child: Widget): Widget {
        return new TextSelectionTheme(this.data, child);
    }
    updateShouldNotify(old: this): boolean {
        return !old.data.equals(this.data);
    }
}