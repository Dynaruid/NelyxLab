// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional TypeScript port of Flutter text_theme.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a. Uses the existing Core TextStyle ABI.
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { TextStyleApplyOptions } from '@nelyx/core/framework/painting/text-style';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import {maybeMaterialThemeDataOf} from './internal/theme/theme-scope.ts';
import {materialTextThemeDefault} from './internal/theme/text-theme-defaults.ts';
import {MaterialLocalizations} from './material-localizations.ts';
const fields = ['displayLarge', 'displayMedium', 'displaySmall', 'headlineLarge', 'headlineMedium', 'headlineSmall',
    'titleLarge', 'titleMedium', 'titleSmall', 'bodyLarge', 'bodyMedium', 'bodySmall', 'labelLarge', 'labelMedium', 'labelSmall'] as const;
type TextThemeField = typeof fields[number];
export type TextThemeOptions = {
    readonly [K in TextThemeField]?: TextStyle | null;
};
export interface TextThemeApplyOptions extends Omit<TextStyleApplyOptions, 'color' | 'backgroundColor'> {
    readonly displayColor?: number | null;
    readonly bodyColor?: number | null;
}
const displayFields: ReadonlySet<TextThemeField> = new Set(['displayLarge', 'displayMedium', 'displaySmall', 'headlineLarge', 'headlineMedium', 'bodySmall']);
/** All fifteen roles are nullable; composition preserves TextStyle.inherit. */
export class TextTheme {
    private readonly values: Readonly<Record<TextThemeField, TextStyle | null>>;
    constructor(options: TextThemeOptions = {}) {
        this.values = Object.freeze(Object.fromEntries(fields.map(field => [field, options[field] ?? null])) as Record<TextThemeField, TextStyle | null>);
        Object.freeze(this);
    }
    get displayLarge(): TextStyle | null {
        return this.values.displayLarge;
    }
    get displayMedium(): TextStyle | null {
        return this.values.displayMedium;
    }
    get displaySmall(): TextStyle | null {
        return this.values.displaySmall;
    }
    get headlineLarge(): TextStyle | null {
        return this.values.headlineLarge;
    }
    get headlineMedium(): TextStyle | null {
        return this.values.headlineMedium;
    }
    get headlineSmall(): TextStyle | null {
        return this.values.headlineSmall;
    }
    get titleLarge(): TextStyle | null {
        return this.values.titleLarge;
    }
    get titleMedium(): TextStyle | null {
        return this.values.titleMedium;
    }
    get titleSmall(): TextStyle | null {
        return this.values.titleSmall;
    }
    get bodyLarge(): TextStyle | null {
        return this.values.bodyLarge;
    }
    get bodyMedium(): TextStyle | null {
        return this.values.bodyMedium;
    }
    get bodySmall(): TextStyle | null {
        return this.values.bodySmall;
    }
    get labelLarge(): TextStyle | null {
        return this.values.labelLarge;
    }
    get labelMedium(): TextStyle | null {
        return this.values.labelMedium;
    }
    get labelSmall(): TextStyle | null {
        return this.values.labelSmall;
    }
    private map(convert: (style: TextStyle | null, field: TextThemeField) => TextStyle | null): TextTheme {
        return new TextTheme(Object.fromEntries(fields.map(field => [field, convert(this[field], field)])));
    }
    copyWith(options: TextThemeOptions = {}): TextTheme {
        return this.map((style, field) => options[field] ?? style);
    }
    merge(other: TextTheme | null | undefined): TextTheme {
        return other == null ? this : this.map((style, field) => style?.merge(other[field]) ?? other[field]);
    }
    apply({ displayColor = null, bodyColor = null, ...options }: TextThemeApplyOptions = {}): TextTheme {
        return this.map((style, field) => style?.apply({ ...options, color: displayFields.has(field) ? displayColor : bodyColor }) ?? null);
    }
    static lerp(a: TextTheme | null, b: TextTheme | null, t: number): TextTheme {
        if (a === b && a !== null)
            return a;
        return new TextTheme(Object.fromEntries(fields.map(field => [field, TextStyle.lerp(a?.[field] ?? null, b?.[field] ?? null, t)])));
    }
    static of(context: BuildContext): TextTheme {
        return maybeMaterialThemeDataOf(context)?.textTheme ?? materialTextThemeDefault(options => new TextTheme(options), undefined, false, MaterialLocalizations.of(context).scriptCategory.name);
    }
    static primaryOf(context: BuildContext): TextTheme {
        return maybeMaterialThemeDataOf(context)?.primaryTextTheme ?? materialTextThemeDefault(options => new TextTheme(options), undefined, true, MaterialLocalizations.of(context).scriptCategory.name);
    }
    equals(other: unknown): boolean {
        return this === other || other instanceof TextTheme && other.constructor === this.constructor && fields.every(field => this[field] === other[field] || this[field]?.equals(other[field]) === true);
    }
    get hashCode(): number {
        return fields.reduce((hash, field) => Math.imul(hash, 31) + (this[field]?.hashCode ?? 0) | 0, 0);
    }
    debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        for (const field of fields)
            properties.add(new DiagnosticsProperty(field, this[field], { defaultValue: null }));
    }
}
