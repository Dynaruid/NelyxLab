// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// theme_data.dart Adaptation<T>; the explicit key reifies T in TypeScript.
import type {ThemeData} from './theme-data.ts';
import {validateThemeType, requireThemeValue, bindThemeValueType, themeTypeKey} from './internal/theme/theme-types.ts';
import type {ThemeType} from './internal/theme/theme-types.ts';
export type {ThemeType} from './internal/theme/theme-types.ts';

/** Heterogeneous storage view. The never parameter prevents calls before typed lookup. */
export interface ThemeAdaptation {
    readonly type: object;
    adapt(theme: ThemeData, defaultValue: never): {};
}

export class Adaptation<T> {
    constructor(private readonly valueType: ThemeType<T>) {
        validateThemeType(valueType); bindThemeValueType(this, valueType);
        const operation = this.adapt;
        // Preserve source covariant argument/return checks and bound method tear-offs,
        // including subclasses that override adapt rather than calling the base method.
        Object.defineProperty(this, 'adapt', {value: (theme: ThemeData, defaultValue: T): T => {
            const input = requireThemeValue(defaultValue, valueType);
            return requireThemeValue(operation.call(this, theme, input), valueType);
        }, writable: false, configurable: false});
    }
    get type(): object {return themeTypeKey(this.valueType);}
    adapt(_theme: ThemeData, defaultValue: T): T {return requireThemeValue(defaultValue, this.valueType);}
}
