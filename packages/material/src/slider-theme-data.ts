// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { Size } from '@nelyx/core/ui/size';
import { Color } from '@nelyx/core/ui/color';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { nullableDartType } from '@nelyx/core/foundation/dart-type-witness';
import { sourceSizeType, sourceSizeLerp } from '@nelyx/core/ui/size-source';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
import { sliderDefaultShapes } from "./internal/slider/slider-shape-defaults.ts";
import { Colors } from "./colors.ts";
import { ShowValueIndicator } from "./generated/slider/slider-theme-values.generated.ts";
import { SliderThemeFieldsBase, sliderThemeFieldNames, sliderThemeColorFields, sliderThemeNumberFields } from "./generated/slider/slider-theme-fields.generated.ts";
import type { SliderThemeOptions } from "./generated/slider/slider-theme-fields.generated.ts";
export type { SliderThemeOptions } from "./generated/slider/slider-theme-fields.generated.ts";
export { ShowValueIndicator, Thumb } from "./generated/slider/slider-theme-values.generated.ts";
export { SliderInteraction } from "./generated/slider/slider-values.generated.ts";
const sizeType = nullableDartType(sourceSizeType), emptyFields = () => Object.fromEntries(sliderThemeFieldNames.map(name => [name, null]));
export class SliderThemeData extends SliderThemeFieldsBase {
    constructor(options: SliderThemeOptions = {}) {
        super(options);
        if (new.target === SliderThemeData)
            Object.freeze(this);
    }
    copyWith(options: SliderThemeOptions = {}): SliderThemeData {
        return new SliderThemeData({ ...Object.fromEntries(sliderThemeFieldNames.map(name => [name, this[name]])), ...Object.fromEntries(Object.entries(options).filter(([, value]) => value != null)) });
    }
    equals(other: unknown): boolean {
        return this === other || other instanceof SliderThemeData && other.constructor === this.constructor && sliderThemeFieldNames.every(name => valueEquals(this[name], other[name]));
    }
    // The source hash omits valueIndicatorStrokeColor; preserve that observable collision.
    get hashCode(): number {
        return hashValues(...sliderThemeFieldNames.filter(name => name !== 'valueIndicatorStrokeColor').map(name => this[name]));
    }
    /** @dartParam t double */
    static lerp(a: SliderThemeData, b: SliderThemeData, t: number): SliderThemeData {
        if (a === b)
            return a;
        const colors = Object.fromEntries(sliderThemeColorFields.map(name => [name, Color.lerp(a[name], b[name], t)])), numbers = Object.fromEntries(sliderThemeNumberFields.map(name => {
            const x = a[name], y = b[name];
            return [name, x === null && y === null ? null : (x ?? 0) * (1 - t) + (y ?? 0) * t];
        }));
        return new SliderThemeData({
            ...emptyFields(), ...Object.fromEntries(sliderThemeFieldNames.map(name => [name, t < .5 ? a[name] : b[name]])), ...colors, ...numbers, valueIndicatorTextStyle: TextStyle.lerp(a.valueIndicatorTextStyle, b.valueIndicatorTextStyle, t), padding: EdgeInsetsGeometry.lerp(a.padding, b.padding, t), thumbSize: WidgetStateProperty.lerp<Size | null>(sizeType, a.thumbSize, b.thumbSize, t, sourceSizeLerp)
        });
    }
}

