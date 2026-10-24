// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { valueEquals, valueHash } from '@nelyx/core/framework/painting/value-equality';
import { ButtonStyle } from './button-style.ts';
export class TextButtonThemeData extends Diagnosticable(class {}) {
    readonly style: ButtonStyle | null;
    constructor({ style = null }: {
        readonly style?: ButtonStyle | null;
    } = {}) { super(); this.style = style; if (new.target === TextButtonThemeData)
        Object.freeze(this); }
    /** @dartParam t double */
    static lerp(a: TextButtonThemeData | null, b: TextButtonThemeData | null, t: number): TextButtonThemeData | null { if (a === b)
        return a; return new TextButtonThemeData({ style: ButtonStyle.lerp(a?.style ?? null, b?.style ?? null, t) }); }
    /** @dartReturn int */
    get hashCode(): number { return valueHash(this.style); }
    equals(other: unknown): boolean { return this === other || other instanceof TextButtonThemeData && other.constructor === this.constructor && valueEquals(this.style, other.style); }
    override debugFillProperties(properties: DiagnosticPropertiesBuilder): void { super.debugFillProperties(properties); properties.add(new DiagnosticsProperty('style', this.style, { defaultValue: null })); }
}
