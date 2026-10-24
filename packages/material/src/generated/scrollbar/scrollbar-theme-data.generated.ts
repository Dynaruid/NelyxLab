// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/scrollbar_theme.dart; SHA256 3da34fe5ede449faf1e28cc7587a8b7f1379935702c8ff8f273e1e47f3f7733d
import {protect} from "@nelyx/core/internal/ui/value-math";
import {checkedInteger} from "@nelyx/core/internal/ui/value-math";
import {Color} from "@nelyx/core/ui/color";
import {Radius} from "@nelyx/core/ui/radius";
import {scrollbarValueEquals} from "@nelyx/core/internal/framework/widgets/scrollbar-painter-source-adapter";
import {SourceWidgetStateProperty} from "@nelyx/core/internal/framework/widgets/widget-state.generated";
import {applyDartType} from "@nelyx/core/internal/foundation/dart-type-witness";
import {captureDartType} from "@nelyx/core/internal/foundation/dart-type-witness";
import {isDartType} from "@nelyx/core/internal/foundation/dart-type-witness";
import {nullableDartType} from "@nelyx/core/internal/foundation/dart-type-witness";
import {scrollbarRawObjectEquals} from "@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter";
import {boxSourceDartDouble} from "@nelyx/core/internal/foundation/dart-numeric";
import {dartBoolType} from "@nelyx/core/internal/foundation/dart-type-witness";
import {dartDoubleType} from "@nelyx/core/internal/foundation/dart-type-witness";
import {dartValueIdentical} from "@nelyx/core/internal/foundation/dart-identity";
import {bridgeDartFunction} from "@nelyx/core/internal/foundation/dart-function";
import {unwrapSourceDartNum} from "@nelyx/core/internal/foundation/dart-numeric";
import {DiagnosticPropertiesBuilder} from "@nelyx/core/foundation/diagnostics";
import {widgetStateDiagnosticableType} from "@nelyx/core/internal/framework/widgets/widget-state-diagnostic-source-adapter";
import {sourceColorType} from "@nelyx/core/internal/ui/color-source-adapter";
import {lerpDouble} from "@nelyx/core/internal/ui/lerp-double.generated";
import {sourceStyleRuntimeType} from "@nelyx/cupertino/internal/scrollbar-style-source-adapter";
import {sourceStyleHash} from "@nelyx/cupertino/internal/scrollbar-style-source-adapter";
import {scrollbarStateBoolProperty} from "../../internal/scrollbar/scrollbar-theme-diagnostic-source-adapter.ts";
import {scrollbarStateDoubleProperty} from "../../internal/scrollbar/scrollbar-theme-diagnostic-source-adapter.ts";
import {scrollbarBoolProperty} from "../../internal/scrollbar/scrollbar-theme-diagnostic-source-adapter.ts";
import {scrollbarRadiusProperty} from "../../internal/scrollbar/scrollbar-theme-diagnostic-source-adapter.ts";
import {scrollbarStateColorProperty} from "../../internal/scrollbar/scrollbar-theme-diagnostic-source-adapter.ts";
import {scrollbarDoubleProperty} from "../../internal/scrollbar/scrollbar-theme-diagnostic-source-adapter.ts";
import {ScrollbarThemeDiagnosticBase} from "../../internal/scrollbar/scrollbar-theme-diagnostic-source-adapter.ts";
import {canonicalDartObject} from "@nelyx/core/internal/foundation/dart-const";
import {sourceColorLerp} from "@nelyx/core/internal/ui/color-source-adapter";
import type {DartDouble} from "@nelyx/core/internal/foundation/dart-numeric";


export class SourceScrollbarThemeData extends ScrollbarThemeDiagnosticBase {
    readonly thumbVisibility: SourceWidgetStateProperty<boolean | null> | null;
    /**
     * @dartType WidgetStateProperty<double?>?
     * @dartTypeOrigin explicit
     */
    readonly thickness: SourceWidgetStateProperty<DartDouble | null> | null;
    readonly trackVisibility: SourceWidgetStateProperty<boolean | null> | null;
    readonly interactive: boolean | null;
    readonly radius: Radius | null;
    readonly thumbColor: SourceWidgetStateProperty<Color | null> | null;
    readonly trackColor: SourceWidgetStateProperty<Color | null> | null;
    readonly trackBorderColor: SourceWidgetStateProperty<Color | null> | null;
    /**
     * @dartType double?
     * @dartTypeOrigin explicit
     */
    readonly crossAxisMargin: number | null;
    /**
     * @dartType double?
     * @dartTypeOrigin explicit
     */
    readonly mainAxisMargin: number | null;
    /**
     * @dartType double?
     * @dartTypeOrigin explicit
     */
    readonly minThumbLength: number | null;
    /**
     * @dartParam thickness WidgetStateProperty<double?>?
     * @dartParamOrigin thickness inferred
     * @dartParam crossAxisMargin double?
     * @dartParamOrigin crossAxisMargin inferred
     * @dartParam mainAxisMargin double?
     * @dartParamOrigin mainAxisMargin inferred
     * @dartParam minThumbLength double?
     * @dartParamOrigin minThumbLength inferred
     */
    constructor({ thumbVisibility = null, thickness = null, trackVisibility = null, radius = null, thumbColor = null, trackColor = null, trackBorderColor = null, crossAxisMargin = null, mainAxisMargin = null, minThumbLength = null, interactive = null }: {
        readonly thumbVisibility?: SourceWidgetStateProperty<boolean | null> | null;
        readonly thickness?: SourceWidgetStateProperty<DartDouble | null> | null;
        readonly trackVisibility?: SourceWidgetStateProperty<boolean | null> | null;
        readonly radius?: Radius | null;
        readonly thumbColor?: SourceWidgetStateProperty<Color | null> | null;
        readonly trackColor?: SourceWidgetStateProperty<Color | null> | null;
        readonly trackBorderColor?: SourceWidgetStateProperty<Color | null> | null;
        readonly crossAxisMargin?: number | null;
        readonly mainAxisMargin?: number | null;
        readonly minThumbLength?: number | null;
        readonly interactive?: boolean | null;
    } = {}) {
        const _initialField0 = thumbVisibility;
        /**
         * @dartType WidgetStateProperty<double?>?
         * @dartTypeOrigin inferred
         */
        const _initialField1 = thickness;
        const _initialField2 = trackVisibility;
        const _initialField3 = radius;
        const _initialField4 = thumbColor;
        const _initialField5 = trackColor;
        const _initialField6 = trackBorderColor;
        /**
         * @dartType double?
         * @dartTypeOrigin inferred
         */
        const _initialField7 = crossAxisMargin;
        /**
         * @dartType double?
         * @dartTypeOrigin inferred
         */
        const _initialField8 = mainAxisMargin;
        /**
         * @dartType double?
         * @dartTypeOrigin inferred
         */
        const _initialField9 = minThumbLength;
        const _initialField10 = interactive;
        super();
        captureDartType(this, applyDartType<SourceScrollbarThemeData>(SourceScrollbarThemeData, "ScrollbarThemeData", [], [widgetStateDiagnosticableType]));
        this.thumbVisibility = _initialField0;
        this.thickness = _initialField1;
        this.trackVisibility = _initialField2;
        this.interactive = _initialField10;
        this.radius = _initialField3;
        this.thumbColor = _initialField4;
        this.trackColor = _initialField5;
        this.trackBorderColor = _initialField6;
        this.crossAxisMargin = _initialField7;
        this.mainAxisMargin = _initialField8;
        this.minThumbLength = _initialField9;
        protect(this, ["thumbVisibility", "thickness", "trackVisibility", "interactive", "radius", "thumbColor", "trackColor", "trackBorderColor", "crossAxisMargin", "mainAxisMargin", "minThumbLength"]);
    }
    /**
     * @dartParam thickness WidgetStateProperty<double?>?
     * @dartParamOrigin thickness explicit
     * @dartParam crossAxisMargin double?
     * @dartParamOrigin crossAxisMargin explicit
     * @dartParam mainAxisMargin double?
     * @dartParamOrigin mainAxisMargin explicit
     * @dartParam minThumbLength double?
     * @dartParamOrigin minThumbLength explicit
     */
    copyWith({ thumbVisibility = null, thickness = null, trackVisibility = null, interactive = null, radius = null, thumbColor = null, trackColor = null, trackBorderColor = null, crossAxisMargin = null, mainAxisMargin = null, minThumbLength = null }: {
        readonly thumbVisibility?: SourceWidgetStateProperty<boolean | null> | null;
        readonly thickness?: SourceWidgetStateProperty<DartDouble | null> | null;
        readonly trackVisibility?: SourceWidgetStateProperty<boolean | null> | null;
        readonly interactive?: boolean | null;
        readonly radius?: Radius | null;
        readonly thumbColor?: SourceWidgetStateProperty<Color | null> | null;
        readonly trackColor?: SourceWidgetStateProperty<Color | null> | null;
        readonly trackBorderColor?: SourceWidgetStateProperty<Color | null> | null;
        readonly crossAxisMargin?: number | null;
        readonly mainAxisMargin?: number | null;
        readonly minThumbLength?: number | null;
    } = {}): SourceScrollbarThemeData {
        return new SourceScrollbarThemeData({ thumbVisibility: thumbVisibility ?? this.thumbVisibility, thickness: thickness ?? this.thickness, trackVisibility: trackVisibility ?? this.trackVisibility, interactive: interactive ?? this.interactive, radius: radius ?? this.radius, thumbColor: thumbColor ?? this.thumbColor, trackColor: trackColor ?? this.trackColor, trackBorderColor: trackBorderColor ?? this.trackBorderColor, crossAxisMargin: crossAxisMargin ?? this.crossAxisMargin, mainAxisMargin: mainAxisMargin ?? this.mainAxisMargin, minThumbLength: minThumbLength ?? this.minThumbLength });
    }
    /**
     * @dartParam t double
     * @dartParamOrigin t explicit
     */
    static lerp(a: SourceScrollbarThemeData | null, b: SourceScrollbarThemeData | null, t: number): SourceScrollbarThemeData {
        if (dartValueIdentical(a, b) && a !== null) {
            return a as SourceScrollbarThemeData;
        }
        return new SourceScrollbarThemeData({ thumbVisibility: SourceWidgetStateProperty.lerp<boolean | null>(nullableDartType<boolean>(dartBoolType), (() => {
                const _dartTemporary0 = a;
                return _dartTemporary0 === null ? null : _dartTemporary0.thumbVisibility;
            })(), (() => {
                const _dartTemporary1 = b;
                return _dartTemporary1 === null ? null : _dartTemporary1.thumbVisibility;
            })(), t, _lerpBool), thickness: SourceWidgetStateProperty.lerp<DartDouble | null>(nullableDartType<DartDouble>(dartDoubleType), (() => {
                const _dartTemporary2 = a;
                return _dartTemporary2 === null ? null : _dartTemporary2.thickness;
            })(), (() => {
                const _dartTemporary3 = b;
                return _dartTemporary3 === null ? null : _dartTemporary3.thickness;
            })(), t, bridgeDartFunction<(argument0: number | null, argument1: number | null, argument2: number) => number | null, (argument0: DartDouble | null, argument1: DartDouble | null, argument2: number) => DartDouble | null>(lerpDouble, "[[[\"scalar-num\",true],[\"scalar-num\",true],[\"scalar-double\",false],[\"scalar-double\",true]],[[\"boxed-double\",true],[\"boxed-double\",true],[\"scalar-double\",false],[\"boxed-double\",true]]]", _dartTemporary4 => (_dartTemporary5: DartDouble | null, _dartTemporary6: DartDouble | null, _dartTemporary7: number): DartDouble | null => (() => {
                const _dartTemporary10 = _dartTemporary4((() => {
                    const _dartTemporary8 = _dartTemporary5;
                    return _dartTemporary8 === null ? null : unwrapSourceDartNum(_dartTemporary8);
                })(), (() => {
                    const _dartTemporary9 = _dartTemporary6;
                    return _dartTemporary9 === null ? null : unwrapSourceDartNum(_dartTemporary9);
                })(), _dartTemporary7);
                return _dartTemporary10 === null ? null : boxSourceDartDouble(_dartTemporary10);
            })())), trackVisibility: SourceWidgetStateProperty.lerp<boolean | null>(nullableDartType<boolean>(dartBoolType), (() => {
                const _dartTemporary11 = a;
                return _dartTemporary11 === null ? null : _dartTemporary11.trackVisibility;
            })(), (() => {
                const _dartTemporary12 = b;
                return _dartTemporary12 === null ? null : _dartTemporary12.trackVisibility;
            })(), t, _lerpBool), interactive: _lerpBool((() => {
                const _dartTemporary13 = a;
                return _dartTemporary13 === null ? null : _dartTemporary13.interactive;
            })(), (() => {
                const _dartTemporary14 = b;
                return _dartTemporary14 === null ? null : _dartTemporary14.interactive;
            })(), t), radius: Radius.lerp((() => {
                const _dartTemporary15 = a;
                return _dartTemporary15 === null ? null : _dartTemporary15.radius;
            })(), (() => {
                const _dartTemporary16 = b;
                return _dartTemporary16 === null ? null : _dartTemporary16.radius;
            })(), t), thumbColor: SourceWidgetStateProperty.lerp<Color | null>(nullableDartType<Color>(sourceColorType), (() => {
                const _dartTemporary17 = a;
                return _dartTemporary17 === null ? null : _dartTemporary17.thumbColor;
            })(), (() => {
                const _dartTemporary18 = b;
                return _dartTemporary18 === null ? null : _dartTemporary18.thumbColor;
            })(), t, sourceColorLerp), trackColor: SourceWidgetStateProperty.lerp<Color | null>(nullableDartType<Color>(sourceColorType), (() => {
                const _dartTemporary19 = a;
                return _dartTemporary19 === null ? null : _dartTemporary19.trackColor;
            })(), (() => {
                const _dartTemporary20 = b;
                return _dartTemporary20 === null ? null : _dartTemporary20.trackColor;
            })(), t, sourceColorLerp), trackBorderColor: SourceWidgetStateProperty.lerp<Color | null>(nullableDartType<Color>(sourceColorType), (() => {
                const _dartTemporary21 = a;
                return _dartTemporary21 === null ? null : _dartTemporary21.trackBorderColor;
            })(), (() => {
                const _dartTemporary22 = b;
                return _dartTemporary22 === null ? null : _dartTemporary22.trackBorderColor;
            })(), t, sourceColorLerp), crossAxisMargin: lerpDouble((() => {
                const _dartTemporary23 = a;
                return _dartTemporary23 === null ? null : _dartTemporary23.crossAxisMargin;
            })(), (() => {
                const _dartTemporary24 = b;
                return _dartTemporary24 === null ? null : _dartTemporary24.crossAxisMargin;
            })(), t), mainAxisMargin: lerpDouble((() => {
                const _dartTemporary25 = a;
                return _dartTemporary25 === null ? null : _dartTemporary25.mainAxisMargin;
            })(), (() => {
                const _dartTemporary26 = b;
                return _dartTemporary26 === null ? null : _dartTemporary26.mainAxisMargin;
            })(), t), minThumbLength: lerpDouble((() => {
                const _dartTemporary27 = a;
                return _dartTemporary27 === null ? null : _dartTemporary27.minThumbLength;
            })(), (() => {
                const _dartTemporary28 = b;
                return _dartTemporary28 === null ? null : _dartTemporary28.minThumbLength;
            })(), t) });
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    override get hashCode(): number {
        return checkedInteger(sourceStyleHash(this.thumbVisibility, this.thickness, this.trackVisibility, this.interactive, this.radius, this.thumbColor, this.trackColor, this.trackBorderColor, (() => {
            const _dartTemporary29 = this.crossAxisMargin;
            return _dartTemporary29 === null ? null : boxSourceDartDouble(_dartTemporary29);
        })(), (() => {
            const _dartTemporary30 = this.mainAxisMargin;
            return _dartTemporary30 === null ? null : boxSourceDartDouble(_dartTemporary30);
        })(), (() => {
            const _dartTemporary31 = this.minThumbLength;
            return _dartTemporary31 === null ? null : boxSourceDartDouble(_dartTemporary31);
        })()));
    }
    override equals(other: {}): boolean {
        if (dartValueIdentical(this, other)) {
            return true;
        }
        if (!(sourceStyleRuntimeType(other) === sourceStyleRuntimeType(this))) {
            return false;
        }
        return isDartType<SourceScrollbarThemeData>(other, applyDartType<SourceScrollbarThemeData>(SourceScrollbarThemeData, "ScrollbarThemeData", [], [widgetStateDiagnosticableType])) && (() => {
            const _dartTemporary32 = (other as SourceScrollbarThemeData).thumbVisibility;
            const _dartTemporary33 = this.thumbVisibility;
            return _dartTemporary32 === null || _dartTemporary33 === null ? _dartTemporary32 === _dartTemporary33 : scrollbarRawObjectEquals(_dartTemporary32, _dartTemporary33);
        })() && (() => {
            const _dartTemporary34 = (other as SourceScrollbarThemeData).thickness;
            const _dartTemporary35 = this.thickness;
            return _dartTemporary34 === null || _dartTemporary35 === null ? _dartTemporary34 === _dartTemporary35 : scrollbarRawObjectEquals(_dartTemporary34, _dartTemporary35);
        })() && (() => {
            const _dartTemporary36 = (other as SourceScrollbarThemeData).trackVisibility;
            const _dartTemporary37 = this.trackVisibility;
            return _dartTemporary36 === null || _dartTemporary37 === null ? _dartTemporary36 === _dartTemporary37 : scrollbarRawObjectEquals(_dartTemporary36, _dartTemporary37);
        })() && (other as SourceScrollbarThemeData).interactive === this.interactive && (() => {
            const _dartTemporary38 = (other as SourceScrollbarThemeData).radius;
            const _dartTemporary39 = this.radius;
            return _dartTemporary38 === null || _dartTemporary39 === null ? _dartTemporary38 === _dartTemporary39 : scrollbarValueEquals(_dartTemporary38, _dartTemporary39);
        })() && (() => {
            const _dartTemporary40 = (other as SourceScrollbarThemeData).thumbColor;
            const _dartTemporary41 = this.thumbColor;
            return _dartTemporary40 === null || _dartTemporary41 === null ? _dartTemporary40 === _dartTemporary41 : scrollbarRawObjectEquals(_dartTemporary40, _dartTemporary41);
        })() && (() => {
            const _dartTemporary42 = (other as SourceScrollbarThemeData).trackColor;
            const _dartTemporary43 = this.trackColor;
            return _dartTemporary42 === null || _dartTemporary43 === null ? _dartTemporary42 === _dartTemporary43 : scrollbarRawObjectEquals(_dartTemporary42, _dartTemporary43);
        })() && (() => {
            const _dartTemporary44 = (other as SourceScrollbarThemeData).trackBorderColor;
            const _dartTemporary45 = this.trackBorderColor;
            return _dartTemporary44 === null || _dartTemporary45 === null ? _dartTemporary44 === _dartTemporary45 : scrollbarRawObjectEquals(_dartTemporary44, _dartTemporary45);
        })() && (other as SourceScrollbarThemeData).crossAxisMargin === this.crossAxisMargin && (other as SourceScrollbarThemeData).mainAxisMargin === this.mainAxisMargin && (other as SourceScrollbarThemeData).minThumbLength === this.minThumbLength;
    }
    override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        super.debugFillProperties(properties);
        properties.add(scrollbarStateBoolProperty("thumbVisibility", this.thumbVisibility, { defaultValue: null }));
        properties.add(scrollbarStateDoubleProperty("thickness", this.thickness, { defaultValue: null }));
        properties.add(scrollbarStateBoolProperty("trackVisibility", this.trackVisibility, { defaultValue: null }));
        properties.add(scrollbarBoolProperty("interactive", this.interactive, { defaultValue: null }));
        properties.add(scrollbarRadiusProperty("radius", this.radius, { defaultValue: null }));
        properties.add(scrollbarStateColorProperty("thumbColor", this.thumbColor, { defaultValue: null }));
        properties.add(scrollbarStateColorProperty("trackColor", this.trackColor, { defaultValue: null }));
        properties.add(scrollbarStateColorProperty("trackBorderColor", this.trackBorderColor, { defaultValue: null }));
        properties.add(scrollbarDoubleProperty("crossAxisMargin", (() => {
            const _dartTemporary46 = this.crossAxisMargin;
            return _dartTemporary46 === null ? null : boxSourceDartDouble(_dartTemporary46);
        })(), { defaultValue: null }));
        properties.add(scrollbarDoubleProperty("mainAxisMargin", (() => {
            const _dartTemporary47 = this.mainAxisMargin;
            return _dartTemporary47 === null ? null : boxSourceDartDouble(_dartTemporary47);
        })(), { defaultValue: null }));
        properties.add(scrollbarDoubleProperty("minThumbLength", (() => {
            const _dartTemporary48 = this.minThumbLength;
            return _dartTemporary48 === null ? null : boxSourceDartDouble(_dartTemporary48);
        })(), { defaultValue: null }));
    }
}

/**
 * @dartParam thickness WidgetStateProperty<double?>?
 * @dartParamOrigin thickness inferred
 * @dartParam crossAxisMargin double?
 * @dartParamOrigin crossAxisMargin inferred
 * @dartParam mainAxisMargin double?
 * @dartParamOrigin mainAxisMargin inferred
 * @dartParam minThumbLength double?
 * @dartParamOrigin minThumbLength inferred
 */
export function constScrollbarThemeData({ thumbVisibility = null, thickness = null, trackVisibility = null, radius = null, thumbColor = null, trackColor = null, trackBorderColor = null, crossAxisMargin = null, mainAxisMargin = null, minThumbLength = null, interactive = null }: {
    readonly thumbVisibility?: SourceWidgetStateProperty<boolean | null> | null;
    readonly thickness?: SourceWidgetStateProperty<DartDouble | null> | null;
    readonly trackVisibility?: SourceWidgetStateProperty<boolean | null> | null;
    readonly radius?: Radius | null;
    readonly thumbColor?: SourceWidgetStateProperty<Color | null> | null;
    readonly trackColor?: SourceWidgetStateProperty<Color | null> | null;
    readonly trackBorderColor?: SourceWidgetStateProperty<Color | null> | null;
    readonly crossAxisMargin?: number | null;
    readonly mainAxisMargin?: number | null;
    readonly minThumbLength?: number | null;
    readonly interactive?: boolean | null;
} = {}): SourceScrollbarThemeData {
    return canonicalDartObject<SourceScrollbarThemeData>(SourceScrollbarThemeData, applyDartType<SourceScrollbarThemeData>(SourceScrollbarThemeData, "ScrollbarThemeData", [], [widgetStateDiagnosticableType]), [["thumbVisibility", "value"], ["thickness", "value"], ["trackVisibility", "value"], ["interactive", "value"], ["radius", "value"], ["thumbColor", "value"], ["trackColor", "value"], ["trackBorderColor", "value"], ["crossAxisMargin", "double?"], ["mainAxisMargin", "double?"], ["minThumbLength", "double?"]], () => new SourceScrollbarThemeData({ thumbVisibility: thumbVisibility, thickness: thickness, trackVisibility: trackVisibility, radius: radius, thumbColor: thumbColor, trackColor: trackColor, trackBorderColor: trackBorderColor, crossAxisMargin: crossAxisMargin, mainAxisMargin: mainAxisMargin, minThumbLength: minThumbLength, interactive: interactive }), false);
}

/**
 * @dartParam t double
 * @dartParamOrigin t explicit
 */
export function _lerpBool(a: boolean | null, b: boolean | null, t: number): boolean | null {
    return t < 0.5 ? a : b;
}