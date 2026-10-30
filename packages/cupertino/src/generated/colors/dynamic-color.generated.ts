// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/colors.dart; SHA256 2fc790aaae0252327e59ed52d4e167cb85933d1959ffcb91da33496e2d4f98e7
import { applyDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { captureDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { isDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { boxSourceDartInt } from "@nelyx/core/internal/foundation/dart-numeric";
import { protect } from "@nelyx/core/internal/ui/value-math";
import { checkedInteger } from "@nelyx/core/internal/ui/value-math";
import { dartValueEquals } from "@nelyx/core/internal/foundation/dart-value";
import { dartValueIdentical } from "@nelyx/core/internal/foundation/dart-identity";
import { dartRecord } from "@nelyx/core/internal/foundation/dart-record";
import { dartRecordRead } from "@nelyx/core/internal/foundation/dart-record";
import { Color } from "@nelyx/core/ui/color";
import { ColorSpace } from "@nelyx/core/ui/color";
import { SourceBrightness } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import { Element } from "@nelyx/core/framework/widgets/framework";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { MessageProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { kNoDefaultValue } from "@nelyx/core/foundation/diagnostics";
import { FoundationBuildMode } from "@nelyx/core/foundation/constants";
import { invariant } from "@nelyx/core/foundation/errors";
import { CupertinoUserInterfaceLevelData } from "../theme/interface-level.generated.ts";
import { CupertinoUserInterfaceLevel } from "../theme/interface-level.generated.ts";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { sourceStyleRuntimeType } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import { sourceStyleHash } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import { sourceStyleObjectRuntimeType } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import { sourceStyleJoin } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import { sourceStyleBrightness } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import { sourceStyleHighContrast } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import { sourceStyleString } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import { sourceStyleCastElement } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import { canonicalDartObject } from "@nelyx/core/internal/foundation/dart-const";
import { registerSourceStyleColors } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import { SourceColorDiagnosticBase } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import { widgetStateDiagnosticableType } from "@nelyx/core/internal/framework/widgets/widget-state-diagnostic-source-adapter";
import { sourceColorType } from "@nelyx/core/internal/ui/color-source-adapter";
import { sourceStyleElementProperty } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import { sourceStyleDynamicColorProperty } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import type { SourceStyleList } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import type { BuildContext } from "@nelyx/core/framework/widgets/framework";
import type { DiagnosticLevel } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticsTreeStyle } from "@nelyx/core/foundation/diagnostics";
export class CupertinoDynamicColor extends SourceColorDiagnosticBase implements Color {
    readonly _dart_0a3bada12cddc054_effectiveColor: Color;
    readonly _dart_0a3bada12cddc054_debugLabel: string | null;
    readonly _dart_0a3bada12cddc054_debugResolveContext: Element | null;
    readonly color: Color;
    readonly darkColor: Color;
    readonly highContrastColor: Color;
    readonly darkHighContrastColor: Color;
    readonly elevatedColor: Color;
    readonly darkElevatedColor: Color;
    readonly highContrastElevatedColor: Color;
    readonly darkHighContrastElevatedColor: Color;
    constructor({ debugLabel = null, color, darkColor, highContrastColor, darkHighContrastColor, elevatedColor, darkElevatedColor, highContrastElevatedColor, darkHighContrastElevatedColor }: {
        readonly debugLabel?: string | null;
        readonly color: Color;
        readonly darkColor: Color;
        readonly highContrastColor: Color;
        readonly darkHighContrastColor: Color;
        readonly elevatedColor: Color;
        readonly darkElevatedColor: Color;
        readonly highContrastElevatedColor: Color;
        readonly darkHighContrastElevatedColor: Color;
    }) {
        let _redirectParameter0: Color = color;
        let _redirectParameter1: Color = color;
        let _redirectParameter2: Color = darkColor;
        let _redirectParameter3: Color = highContrastColor;
        let _redirectParameter4: Color = darkHighContrastColor;
        let _redirectParameter5: Color = elevatedColor;
        let _redirectParameter6: Color = darkElevatedColor;
        let _redirectParameter7: Color = highContrastElevatedColor;
        let _redirectParameter8: Color = darkHighContrastElevatedColor;
        let _redirectParameter9: Element | null = null;
        let _redirectParameter10: string | null = debugLabel;
        let _redirectParameter11: Color = _redirectParameter0;
        let _redirectParameter12: Color = _redirectParameter1;
        let _redirectParameter13: Color = _redirectParameter2;
        let _redirectParameter14: Color = _redirectParameter3;
        let _redirectParameter15: Color = _redirectParameter4;
        let _redirectParameter16: Color = _redirectParameter5;
        let _redirectParameter17: Color = _redirectParameter6;
        let _redirectParameter18: Color = _redirectParameter7;
        let _redirectParameter19: Color = _redirectParameter8;
        let _redirectParameter20: Element | null = _redirectParameter9;
        let _redirectParameter21: string | null = _redirectParameter10;
        const _initialField0 = _redirectParameter11;
        const _initialField1 = _redirectParameter12;
        const _initialField2 = _redirectParameter13;
        const _initialField3 = _redirectParameter14;
        const _initialField4 = _redirectParameter15;
        const _initialField5 = _redirectParameter16;
        const _initialField6 = _redirectParameter17;
        const _initialField7 = _redirectParameter18;
        const _initialField8 = _redirectParameter19;
        const _initialField9 = _redirectParameter20;
        const _initialField10 = _redirectParameter21;
        super();
        captureDartType(this, applyDartType<CupertinoDynamicColor>(CupertinoDynamicColor, "CupertinoDynamicColor", [], [sourceColorType, widgetStateDiagnosticableType]));
        this._dart_0a3bada12cddc054_effectiveColor = _initialField0;
        this._dart_0a3bada12cddc054_debugLabel = _initialField10;
        this._dart_0a3bada12cddc054_debugResolveContext = _initialField9;
        this.color = _initialField1;
        this.darkColor = _initialField2;
        this.highContrastColor = _initialField3;
        this.darkHighContrastColor = _initialField4;
        this.elevatedColor = _initialField5;
        this.darkElevatedColor = _initialField6;
        this.highContrastElevatedColor = _initialField7;
        this.darkHighContrastElevatedColor = _initialField8;
        protect(this, ["_dart_0a3bada12cddc054_effectiveColor", "_dart_0a3bada12cddc054_debugLabel", "_dart_0a3bada12cddc054_debugResolveContext", "color", "darkColor", "highContrastColor", "darkHighContrastColor", "elevatedColor", "darkElevatedColor", "highContrastElevatedColor", "darkHighContrastElevatedColor"]);
    }
    static resolve(resolvable: Color, context: BuildContext): Color {
        return (isDartType<CupertinoDynamicColor>(resolvable, applyDartType<CupertinoDynamicColor>(CupertinoDynamicColor, "CupertinoDynamicColor", [], [sourceColorType, widgetStateDiagnosticableType]))) ? (resolvable as CupertinoDynamicColor).resolveFrom(context) : resolvable;
    }
    static maybeResolve(resolvable: Color | null, context: BuildContext): Color | null {
        return (isDartType<CupertinoDynamicColor>(resolvable, applyDartType<CupertinoDynamicColor>(CupertinoDynamicColor, "CupertinoDynamicColor", [], [sourceColorType, widgetStateDiagnosticableType]))) ? (resolvable as CupertinoDynamicColor).resolveFrom(context) : resolvable;
    }
    get _dart_0a3bada12cddc054_isPlatformBrightnessDependent(): boolean {
        return !dartValueEquals(this.color, this.darkColor) || !dartValueEquals(this.elevatedColor, this.darkElevatedColor) || !dartValueEquals(this.highContrastColor, this.darkHighContrastColor) || !dartValueEquals(this.highContrastElevatedColor, this.darkHighContrastElevatedColor);
    }
    get _dart_0a3bada12cddc054_isHighContrastDependent(): boolean {
        return !dartValueEquals(this.color, this.highContrastColor) || !dartValueEquals(this.darkColor, this.darkHighContrastColor) || !dartValueEquals(this.elevatedColor, this.highContrastElevatedColor) || !dartValueEquals(this.darkElevatedColor, this.darkHighContrastElevatedColor);
    }
    get _dart_0a3bada12cddc054_isInterfaceElevationDependent(): boolean {
        return !dartValueEquals(this.color, this.elevatedColor) || !dartValueEquals(this.darkColor, this.darkElevatedColor) || !dartValueEquals(this.highContrastColor, this.highContrastElevatedColor) || !dartValueEquals(this.darkHighContrastColor, this.darkHighContrastElevatedColor);
    }
    resolveFrom(context: BuildContext): CupertinoDynamicColor {
        const brightness: SourceBrightness = this._dart_0a3bada12cddc054_isPlatformBrightnessDependent ? sourceStyleBrightness(context) ?? SourceBrightness.light : SourceBrightness.light;
        const level: CupertinoUserInterfaceLevelData = this._dart_0a3bada12cddc054_isInterfaceElevationDependent ? CupertinoUserInterfaceLevel.maybeOf(context) ?? CupertinoUserInterfaceLevelData.base : CupertinoUserInterfaceLevelData.base;
        const highContrast: boolean = this._dart_0a3bada12cddc054_isHighContrastDependent && (sourceStyleHighContrast(context) ?? false);
        const resolved: Color = (() => {
            const _dartTemporary0 = dartRecord([brightness, level, highContrast] as const);
            switch (true) {
                case dartRecordRead(_dartTemporary0, 0, 3) === SourceBrightness.light && dartRecordRead(_dartTemporary0, 1, 3) === CupertinoUserInterfaceLevelData.base && dartRecordRead(_dartTemporary0, 2, 3) === false: return this.color;
                case dartRecordRead(_dartTemporary0, 0, 3) === SourceBrightness.light && dartRecordRead(_dartTemporary0, 1, 3) === CupertinoUserInterfaceLevelData.base && dartRecordRead(_dartTemporary0, 2, 3) === true: return this.highContrastColor;
                case dartRecordRead(_dartTemporary0, 0, 3) === SourceBrightness.light && dartRecordRead(_dartTemporary0, 1, 3) === CupertinoUserInterfaceLevelData.elevated && dartRecordRead(_dartTemporary0, 2, 3) === false: return this.elevatedColor;
                case dartRecordRead(_dartTemporary0, 0, 3) === SourceBrightness.light && dartRecordRead(_dartTemporary0, 1, 3) === CupertinoUserInterfaceLevelData.elevated && dartRecordRead(_dartTemporary0, 2, 3) === true: return this.highContrastElevatedColor;
                case dartRecordRead(_dartTemporary0, 0, 3) === SourceBrightness.dark && dartRecordRead(_dartTemporary0, 1, 3) === CupertinoUserInterfaceLevelData.base && dartRecordRead(_dartTemporary0, 2, 3) === false: return this.darkColor;
                case dartRecordRead(_dartTemporary0, 0, 3) === SourceBrightness.dark && dartRecordRead(_dartTemporary0, 1, 3) === CupertinoUserInterfaceLevelData.base && dartRecordRead(_dartTemporary0, 2, 3) === true: return this.darkHighContrastColor;
                case dartRecordRead(_dartTemporary0, 0, 3) === SourceBrightness.dark && dartRecordRead(_dartTemporary0, 1, 3) === CupertinoUserInterfaceLevelData.elevated && dartRecordRead(_dartTemporary0, 2, 3) === false: return this.darkElevatedColor;
                case dartRecordRead(_dartTemporary0, 0, 3) === SourceBrightness.dark && dartRecordRead(_dartTemporary0, 1, 3) === CupertinoUserInterfaceLevelData.elevated && dartRecordRead(_dartTemporary0, 2, 3) === true: return this.darkHighContrastElevatedColor;
                default: throw new TypeError("Non-exhaustive Dart record switch expression");
            }
        })();
        let debugContext: Element | null = null;
        if (FoundationBuildMode.debug)
            invariant(((): boolean => {
                debugContext = sourceStyleCastElement(context);
                return true;
            })(), "generated-source-assert", "Pinned Dart assertion failed");
        return CupertinoDynamicColor._dart_0a3bada12cddc054_(resolved, this.color, this.darkColor, this.highContrastColor, this.darkHighContrastColor, this.elevatedColor, this.darkElevatedColor, this.highContrastElevatedColor, this.darkHighContrastElevatedColor, debugContext, this._dart_0a3bada12cddc054_debugLabel);
    }
    override equals(other: {}): boolean {
        if (dartValueIdentical(this, other)) {
            return true;
        }
        if (!(sourceStyleRuntimeType(other) === sourceStyleRuntimeType(this))) {
            return false;
        }
        return isDartType<CupertinoDynamicColor>(other, applyDartType<CupertinoDynamicColor>(CupertinoDynamicColor, "CupertinoDynamicColor", [], [sourceColorType, widgetStateDiagnosticableType])) && checkedInteger((other as CupertinoDynamicColor).value) === checkedInteger(this.value) && dartValueEquals((other as CupertinoDynamicColor).color, this.color) && dartValueEquals((other as CupertinoDynamicColor).darkColor, this.darkColor) && dartValueEquals((other as CupertinoDynamicColor).highContrastColor, this.highContrastColor) && dartValueEquals((other as CupertinoDynamicColor).darkHighContrastColor, this.darkHighContrastColor) && dartValueEquals((other as CupertinoDynamicColor).elevatedColor, this.elevatedColor) && dartValueEquals((other as CupertinoDynamicColor).darkElevatedColor, this.darkElevatedColor) && dartValueEquals((other as CupertinoDynamicColor).highContrastElevatedColor, this.highContrastElevatedColor) && dartValueEquals((other as CupertinoDynamicColor).darkHighContrastElevatedColor, this.darkHighContrastElevatedColor);
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    override get hashCode(): number {
        return checkedInteger(sourceStyleHash(boxSourceDartInt(checkedInteger(this.value)), this.color, this.darkColor, this.highContrastColor, this.elevatedColor, this.darkElevatedColor, this.darkHighContrastColor, this.darkHighContrastElevatedColor, this.highContrastElevatedColor));
    }
    override toString({ minLevel = "info" }: {
        readonly minLevel?: DiagnosticLevel;
    } = {}): string {
        const toString: (argument0: string, argument1: Color) => string = (name: string, color: Color): string => {
            const marker: string = dartValueEquals(color, this._dart_0a3bada12cddc054_effectiveColor) ? "*" : "";
            return `${marker}${name} = ${sourceStyleString(color)}${marker}`;
        };
        const xs: SourceStyleList<string> = (() => {
            const _dartTemporary1: string[] = [];
            _dartTemporary1.push(toString("color", this.color));
            if (this._dart_0a3bada12cddc054_isPlatformBrightnessDependent)
                _dartTemporary1.push(toString("darkColor", this.darkColor));
            if (this._dart_0a3bada12cddc054_isHighContrastDependent)
                _dartTemporary1.push(toString("highContrastColor", this.highContrastColor));
            if (this._dart_0a3bada12cddc054_isPlatformBrightnessDependent && this._dart_0a3bada12cddc054_isHighContrastDependent)
                _dartTemporary1.push(toString("darkHighContrastColor", this.darkHighContrastColor));
            if (this._dart_0a3bada12cddc054_isInterfaceElevationDependent)
                _dartTemporary1.push(toString("elevatedColor", this.elevatedColor));
            if (this._dart_0a3bada12cddc054_isPlatformBrightnessDependent && this._dart_0a3bada12cddc054_isInterfaceElevationDependent)
                _dartTemporary1.push(toString("darkElevatedColor", this.darkElevatedColor));
            if (this._dart_0a3bada12cddc054_isHighContrastDependent && this._dart_0a3bada12cddc054_isInterfaceElevationDependent)
                _dartTemporary1.push(toString("highContrastElevatedColor", this.highContrastElevatedColor));
            if (this._dart_0a3bada12cddc054_isPlatformBrightnessDependent && this._dart_0a3bada12cddc054_isHighContrastDependent && this._dart_0a3bada12cddc054_isInterfaceElevationDependent)
                _dartTemporary1.push(toString("darkHighContrastElevatedColor", this.darkHighContrastElevatedColor));
            return _dartTemporary1;
        })();
        return `${this._dart_0a3bada12cddc054_debugLabel ?? sourceStyleObjectRuntimeType(this, "CupertinoDynamicColor")}(${sourceStyleJoin(xs, ", ")}, resolved by: ${sourceStyleString((() => {
            const _dartTemporary2 = this._dart_0a3bada12cddc054_debugResolveContext;
            return _dartTemporary2 === null ? null : _dartTemporary2.widget;
        })() ?? "UNRESOLVED")})`;
    }
    override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        super.debugFillProperties(properties);
        if (this._dart_0a3bada12cddc054_debugLabel !== null) {
            properties.add(new MessageProperty("debugLabel", this._dart_0a3bada12cddc054_debugLabel));
        }
        properties.add(createCupertinoColorProperty("color", this.color));
        if (this._dart_0a3bada12cddc054_isPlatformBrightnessDependent) {
            properties.add(createCupertinoColorProperty("darkColor", this.darkColor));
        }
        if (this._dart_0a3bada12cddc054_isHighContrastDependent) {
            properties.add(createCupertinoColorProperty("highContrastColor", this.highContrastColor));
        }
        if (this._dart_0a3bada12cddc054_isPlatformBrightnessDependent && this._dart_0a3bada12cddc054_isHighContrastDependent) {
            properties.add(createCupertinoColorProperty("darkHighContrastColor", this.darkHighContrastColor));
        }
        if (this._dart_0a3bada12cddc054_isInterfaceElevationDependent) {
            properties.add(createCupertinoColorProperty("elevatedColor", this.elevatedColor));
        }
        if (this._dart_0a3bada12cddc054_isPlatformBrightnessDependent && this._dart_0a3bada12cddc054_isInterfaceElevationDependent) {
            properties.add(createCupertinoColorProperty("darkElevatedColor", this.darkElevatedColor));
        }
        if (this._dart_0a3bada12cddc054_isHighContrastDependent && this._dart_0a3bada12cddc054_isInterfaceElevationDependent) {
            properties.add(createCupertinoColorProperty("highContrastElevatedColor", this.highContrastElevatedColor));
        }
        if (this._dart_0a3bada12cddc054_isPlatformBrightnessDependent && this._dart_0a3bada12cddc054_isHighContrastDependent && this._dart_0a3bada12cddc054_isInterfaceElevationDependent) {
            properties.add(createCupertinoColorProperty("darkHighContrastElevatedColor", this.darkHighContrastElevatedColor));
        }
        if (this._dart_0a3bada12cddc054_debugResolveContext !== null) {
            properties.add(sourceStyleElementProperty("last resolved", this._dart_0a3bada12cddc054_debugResolveContext));
        }
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    get value(): number {
        return checkedInteger(this._dart_0a3bada12cddc054_effectiveColor.value);
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    toARGB32(): number {
        return checkedInteger(this._dart_0a3bada12cddc054_effectiveColor.toARGB32());
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    get alpha(): number {
        return checkedInteger(this._dart_0a3bada12cddc054_effectiveColor.alpha);
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    get blue(): number {
        return checkedInteger(this._dart_0a3bada12cddc054_effectiveColor.blue);
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    computeLuminance(): number {
        return this._dart_0a3bada12cddc054_effectiveColor.computeLuminance();
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    get green(): number {
        return checkedInteger(this._dart_0a3bada12cddc054_effectiveColor.green);
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    get opacity(): number {
        return this._dart_0a3bada12cddc054_effectiveColor.opacity;
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    get red(): number {
        return checkedInteger(this._dart_0a3bada12cddc054_effectiveColor.red);
    }
    /**
     * @dartParam a int
     * @dartParamOrigin a explicit
     */
    withAlpha(a: number): Color {
        checkedInteger(a);
        return this._dart_0a3bada12cddc054_effectiveColor.withAlpha(checkedInteger(a));
    }
    /**
     * @dartParam b int
     * @dartParamOrigin b explicit
     */
    withBlue(b: number): Color {
        checkedInteger(b);
        return this._dart_0a3bada12cddc054_effectiveColor.withBlue(checkedInteger(b));
    }
    /**
     * @dartParam g int
     * @dartParamOrigin g explicit
     */
    withGreen(g: number): Color {
        checkedInteger(g);
        return this._dart_0a3bada12cddc054_effectiveColor.withGreen(checkedInteger(g));
    }
    /**
     * @dartParam opacity double
     * @dartParamOrigin opacity explicit
     */
    withOpacity(opacity: number): Color {
        return this._dart_0a3bada12cddc054_effectiveColor.withOpacity(opacity);
    }
    /**
     * @dartParam r int
     * @dartParamOrigin r explicit
     */
    withRed(r: number): Color {
        checkedInteger(r);
        return this._dart_0a3bada12cddc054_effectiveColor.withRed(checkedInteger(r));
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    get a(): number {
        return this._dart_0a3bada12cddc054_effectiveColor.a;
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    get r(): number {
        return this._dart_0a3bada12cddc054_effectiveColor.r;
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    get g(): number {
        return this._dart_0a3bada12cddc054_effectiveColor.g;
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    get b(): number {
        return this._dart_0a3bada12cddc054_effectiveColor.b;
    }
    get colorSpace(): ColorSpace {
        return this._dart_0a3bada12cddc054_effectiveColor.colorSpace;
    }
    /**
     * @dartParam alpha double?
     * @dartParamOrigin alpha explicit
     * @dartParam red double?
     * @dartParamOrigin red explicit
     * @dartParam green double?
     * @dartParamOrigin green explicit
     * @dartParam blue double?
     * @dartParamOrigin blue explicit
     */
    withValues({ alpha = null, red = null, green = null, blue = null, colorSpace = null }: {
        readonly alpha?: number | null;
        readonly red?: number | null;
        readonly green?: number | null;
        readonly blue?: number | null;
        readonly colorSpace?: ColorSpace | null;
    } = {}): Color {
        return this._dart_0a3bada12cddc054_effectiveColor.withValues({ alpha: alpha, red: red, green: green, blue: blue, colorSpace: colorSpace });
    }
    static withBrightnessAndContrast({ debugLabel = null, color, darkColor, highContrastColor, darkHighContrastColor }: {
        readonly debugLabel?: string | null;
        readonly color: Color;
        readonly darkColor: Color;
        readonly highContrastColor: Color;
        readonly darkHighContrastColor: Color;
    }): CupertinoDynamicColor {
        return _dartTemporary3(CupertinoDynamicColor, { debugLabel, color, darkColor, highContrastColor, darkHighContrastColor });
    }
    static withBrightness({ debugLabel = null, color, darkColor }: {
        readonly debugLabel?: string | null;
        readonly color: Color;
        readonly darkColor: Color;
    }): CupertinoDynamicColor {
        return _dartTemporary6(CupertinoDynamicColor, { debugLabel, color, darkColor });
    }
    static _dart_0a3bada12cddc054_(_effectiveColor: Color, color: Color, darkColor: Color, highContrastColor: Color, darkHighContrastColor: Color, elevatedColor: Color, darkElevatedColor: Color, highContrastElevatedColor: Color, darkHighContrastElevatedColor: Color, _debugResolveContext: Element | null, _debugLabel: string | null): CupertinoDynamicColor {
        return _dartTemporary9(CupertinoDynamicColor, _effectiveColor, color, darkColor, highContrastColor, darkHighContrastColor, elevatedColor, darkElevatedColor, highContrastElevatedColor, darkHighContrastElevatedColor, _debugResolveContext, _debugLabel);
    }
}
export function constCupertinoDynamicColor({ debugLabel = null, color, darkColor, highContrastColor, darkHighContrastColor, elevatedColor, darkElevatedColor, highContrastElevatedColor, darkHighContrastElevatedColor }: {
    readonly debugLabel?: string | null;
    readonly color: Color;
    readonly darkColor: Color;
    readonly highContrastColor: Color;
    readonly darkHighContrastColor: Color;
    readonly elevatedColor: Color;
    readonly darkElevatedColor: Color;
    readonly highContrastElevatedColor: Color;
    readonly darkHighContrastElevatedColor: Color;
}): CupertinoDynamicColor {
    return canonicalDartObject<CupertinoDynamicColor>(CupertinoDynamicColor, applyDartType<CupertinoDynamicColor>(CupertinoDynamicColor, "CupertinoDynamicColor", [], [sourceColorType, widgetStateDiagnosticableType]), [["_dart_0a3bada12cddc054_effectiveColor", "value"], ["_dart_0a3bada12cddc054_debugLabel", "value"], ["_dart_0a3bada12cddc054_debugResolveContext", "value"], ["color", "value"], ["darkColor", "value"], ["highContrastColor", "value"], ["darkHighContrastColor", "value"], ["elevatedColor", "value"], ["darkElevatedColor", "value"], ["highContrastElevatedColor", "value"], ["darkHighContrastElevatedColor", "value"]], () => new CupertinoDynamicColor({ debugLabel: debugLabel, color: color, darkColor: darkColor, highContrastColor: highContrastColor, darkHighContrastColor: darkHighContrastColor, elevatedColor: elevatedColor, darkElevatedColor: darkElevatedColor, highContrastElevatedColor: highContrastElevatedColor, darkHighContrastElevatedColor: darkHighContrastElevatedColor }), false);
}
export function constCupertinoDynamicColorWithBrightnessAndContrast({ debugLabel = null, color, darkColor, highContrastColor, darkHighContrastColor }: {
    readonly debugLabel?: string | null;
    readonly color: Color;
    readonly darkColor: Color;
    readonly highContrastColor: Color;
    readonly darkHighContrastColor: Color;
}): CupertinoDynamicColor {
    return canonicalDartObject<CupertinoDynamicColor>(CupertinoDynamicColor, applyDartType<CupertinoDynamicColor>(CupertinoDynamicColor, "CupertinoDynamicColor", [], [sourceColorType, widgetStateDiagnosticableType]), [["_dart_0a3bada12cddc054_effectiveColor", "value"], ["_dart_0a3bada12cddc054_debugLabel", "value"], ["_dart_0a3bada12cddc054_debugResolveContext", "value"], ["color", "value"], ["darkColor", "value"], ["highContrastColor", "value"], ["darkHighContrastColor", "value"], ["elevatedColor", "value"], ["darkElevatedColor", "value"], ["highContrastElevatedColor", "value"], ["darkHighContrastElevatedColor", "value"]], () => CupertinoDynamicColor.withBrightnessAndContrast({ debugLabel: debugLabel, color: color, darkColor: darkColor, highContrastColor: highContrastColor, darkHighContrastColor: darkHighContrastColor }), false);
}
export function constCupertinoDynamicColorWithBrightness({ debugLabel = null, color, darkColor }: {
    readonly debugLabel?: string | null;
    readonly color: Color;
    readonly darkColor: Color;
}): CupertinoDynamicColor {
    return canonicalDartObject<CupertinoDynamicColor>(CupertinoDynamicColor, applyDartType<CupertinoDynamicColor>(CupertinoDynamicColor, "CupertinoDynamicColor", [], [sourceColorType, widgetStateDiagnosticableType]), [["_dart_0a3bada12cddc054_effectiveColor", "value"], ["_dart_0a3bada12cddc054_debugLabel", "value"], ["_dart_0a3bada12cddc054_debugResolveContext", "value"], ["color", "value"], ["darkColor", "value"], ["highContrastColor", "value"], ["darkHighContrastColor", "value"], ["elevatedColor", "value"], ["darkElevatedColor", "value"], ["highContrastElevatedColor", "value"], ["darkHighContrastElevatedColor", "value"]], () => CupertinoDynamicColor.withBrightness({ debugLabel: debugLabel, color: color, darkColor: darkColor }), false);
}
export function constCupertinoDynamicColorPrivate(_effectiveColor: Color, color: Color, darkColor: Color, highContrastColor: Color, darkHighContrastColor: Color, elevatedColor: Color, darkElevatedColor: Color, highContrastElevatedColor: Color, darkHighContrastElevatedColor: Color, _debugResolveContext: Element | null, _debugLabel: string | null): CupertinoDynamicColor {
    return canonicalDartObject<CupertinoDynamicColor>(CupertinoDynamicColor, applyDartType<CupertinoDynamicColor>(CupertinoDynamicColor, "CupertinoDynamicColor", [], [sourceColorType, widgetStateDiagnosticableType]), [["_dart_0a3bada12cddc054_effectiveColor", "value"], ["_dart_0a3bada12cddc054_debugLabel", "value"], ["_dart_0a3bada12cddc054_debugResolveContext", "value"], ["color", "value"], ["darkColor", "value"], ["highContrastColor", "value"], ["darkHighContrastColor", "value"], ["elevatedColor", "value"], ["darkElevatedColor", "value"], ["highContrastElevatedColor", "value"], ["darkHighContrastElevatedColor", "value"]], () => CupertinoDynamicColor._dart_0a3bada12cddc054_(_effectiveColor, color, darkColor, highContrastColor, darkHighContrastColor, elevatedColor, darkElevatedColor, highContrastElevatedColor, darkHighContrastElevatedColor, _debugResolveContext, _debugLabel), false);
}
function _dartTemporary3(_dartTemporary4: typeof CupertinoDynamicColor, { debugLabel = null, color, darkColor, highContrastColor, darkHighContrastColor }: {
    readonly debugLabel?: string | null;
    readonly color: Color;
    readonly darkColor: Color;
    readonly highContrastColor: Color;
    readonly darkHighContrastColor: Color;
}): CupertinoDynamicColor {
    let _redirectParameter22: string | null = debugLabel;
    let _redirectParameter23: Color = color;
    let _redirectParameter24: Color = darkColor;
    let _redirectParameter25: Color = highContrastColor;
    let _redirectParameter26: Color = darkHighContrastColor;
    let _redirectParameter27: Color = color;
    let _redirectParameter28: Color = darkColor;
    let _redirectParameter29: Color = highContrastColor;
    let _redirectParameter30: Color = darkHighContrastColor;
    let _redirectParameter31: string | null = _redirectParameter22;
    let _redirectParameter32: Color = _redirectParameter23;
    let _redirectParameter33: Color = _redirectParameter24;
    let _redirectParameter34: Color = _redirectParameter25;
    let _redirectParameter35: Color = _redirectParameter26;
    let _redirectParameter36: Color = _redirectParameter27;
    let _redirectParameter37: Color = _redirectParameter28;
    let _redirectParameter38: Color = _redirectParameter29;
    let _redirectParameter39: Color = _redirectParameter30;
    let _redirectParameter40: Color = _redirectParameter32;
    let _redirectParameter41: Color = _redirectParameter32;
    let _redirectParameter42: Color = _redirectParameter33;
    let _redirectParameter43: Color = _redirectParameter34;
    let _redirectParameter44: Color = _redirectParameter35;
    let _redirectParameter45: Color = _redirectParameter36;
    let _redirectParameter46: Color = _redirectParameter37;
    let _redirectParameter47: Color = _redirectParameter38;
    let _redirectParameter48: Color = _redirectParameter39;
    let _redirectParameter49: Element | null = null;
    let _redirectParameter50: string | null = _redirectParameter31;
    let _redirectParameter51: Color = _redirectParameter40;
    let _redirectParameter52: Color = _redirectParameter41;
    let _redirectParameter53: Color = _redirectParameter42;
    let _redirectParameter54: Color = _redirectParameter43;
    let _redirectParameter55: Color = _redirectParameter44;
    let _redirectParameter56: Color = _redirectParameter45;
    let _redirectParameter57: Color = _redirectParameter46;
    let _redirectParameter58: Color = _redirectParameter47;
    let _redirectParameter59: Color = _redirectParameter48;
    let _redirectParameter60: Element | null = _redirectParameter49;
    let _redirectParameter61: string | null = _redirectParameter50;
    const _initialField0 = _redirectParameter51;
    const _initialField1 = _redirectParameter52;
    const _initialField2 = _redirectParameter53;
    const _initialField3 = _redirectParameter54;
    const _initialField4 = _redirectParameter55;
    const _initialField5 = _redirectParameter56;
    const _initialField6 = _redirectParameter57;
    const _initialField7 = _redirectParameter58;
    const _initialField8 = _redirectParameter59;
    const _initialField9 = _redirectParameter60;
    const _initialField10 = _redirectParameter61;
    const _dartTemporary5: InstanceType<typeof SourceColorDiagnosticBase> & {
        _dart_0a3bada12cddc054_effectiveColor: Color;
        _dart_0a3bada12cddc054_debugLabel: string | null;
        _dart_0a3bada12cddc054_debugResolveContext: Element | null;
        color: Color;
        darkColor: Color;
        highContrastColor: Color;
        darkHighContrastColor: Color;
        elevatedColor: Color;
        darkElevatedColor: Color;
        highContrastElevatedColor: Color;
        darkHighContrastElevatedColor: Color;
    } = Reflect.construct(SourceColorDiagnosticBase, [] satisfies ConstructorParameters<typeof SourceColorDiagnosticBase>, _dartTemporary4) as InstanceType<typeof SourceColorDiagnosticBase> & {
        _dart_0a3bada12cddc054_effectiveColor: Color;
        _dart_0a3bada12cddc054_debugLabel: string | null;
        _dart_0a3bada12cddc054_debugResolveContext: Element | null;
        color: Color;
        darkColor: Color;
        highContrastColor: Color;
        darkHighContrastColor: Color;
        elevatedColor: Color;
        darkElevatedColor: Color;
        highContrastElevatedColor: Color;
        darkHighContrastElevatedColor: Color;
    };
    captureDartType(_dartTemporary5, applyDartType<CupertinoDynamicColor>(_dartTemporary4, "CupertinoDynamicColor", [], [sourceColorType, widgetStateDiagnosticableType]));
    _dartTemporary5._dart_0a3bada12cddc054_effectiveColor = _initialField0;
    _dartTemporary5._dart_0a3bada12cddc054_debugLabel = _initialField10;
    _dartTemporary5._dart_0a3bada12cddc054_debugResolveContext = _initialField9;
    _dartTemporary5.color = _initialField1;
    _dartTemporary5.darkColor = _initialField2;
    _dartTemporary5.highContrastColor = _initialField3;
    _dartTemporary5.darkHighContrastColor = _initialField4;
    _dartTemporary5.elevatedColor = _initialField5;
    _dartTemporary5.darkElevatedColor = _initialField6;
    _dartTemporary5.highContrastElevatedColor = _initialField7;
    _dartTemporary5.darkHighContrastElevatedColor = _initialField8;
    protect(_dartTemporary5, ["_dart_0a3bada12cddc054_effectiveColor", "_dart_0a3bada12cddc054_debugLabel", "_dart_0a3bada12cddc054_debugResolveContext", "color", "darkColor", "highContrastColor", "darkHighContrastColor", "elevatedColor", "darkElevatedColor", "highContrastElevatedColor", "darkHighContrastElevatedColor"]);
    return _dartTemporary5 as CupertinoDynamicColor;
}
function _dartTemporary6(_dartTemporary7: typeof CupertinoDynamicColor, { debugLabel = null, color, darkColor }: {
    readonly debugLabel?: string | null;
    readonly color: Color;
    readonly darkColor: Color;
}): CupertinoDynamicColor {
    let _redirectParameter62: string | null = debugLabel;
    let _redirectParameter63: Color = color;
    let _redirectParameter64: Color = darkColor;
    let _redirectParameter65: Color = color;
    let _redirectParameter66: Color = darkColor;
    let _redirectParameter67: Color = color;
    let _redirectParameter68: Color = darkColor;
    let _redirectParameter69: Color = color;
    let _redirectParameter70: Color = darkColor;
    let _redirectParameter71: string | null = _redirectParameter62;
    let _redirectParameter72: Color = _redirectParameter63;
    let _redirectParameter73: Color = _redirectParameter64;
    let _redirectParameter74: Color = _redirectParameter65;
    let _redirectParameter75: Color = _redirectParameter66;
    let _redirectParameter76: Color = _redirectParameter67;
    let _redirectParameter77: Color = _redirectParameter68;
    let _redirectParameter78: Color = _redirectParameter69;
    let _redirectParameter79: Color = _redirectParameter70;
    let _redirectParameter80: Color = _redirectParameter72;
    let _redirectParameter81: Color = _redirectParameter72;
    let _redirectParameter82: Color = _redirectParameter73;
    let _redirectParameter83: Color = _redirectParameter74;
    let _redirectParameter84: Color = _redirectParameter75;
    let _redirectParameter85: Color = _redirectParameter76;
    let _redirectParameter86: Color = _redirectParameter77;
    let _redirectParameter87: Color = _redirectParameter78;
    let _redirectParameter88: Color = _redirectParameter79;
    let _redirectParameter89: Element | null = null;
    let _redirectParameter90: string | null = _redirectParameter71;
    let _redirectParameter91: Color = _redirectParameter80;
    let _redirectParameter92: Color = _redirectParameter81;
    let _redirectParameter93: Color = _redirectParameter82;
    let _redirectParameter94: Color = _redirectParameter83;
    let _redirectParameter95: Color = _redirectParameter84;
    let _redirectParameter96: Color = _redirectParameter85;
    let _redirectParameter97: Color = _redirectParameter86;
    let _redirectParameter98: Color = _redirectParameter87;
    let _redirectParameter99: Color = _redirectParameter88;
    let _redirectParameter100: Element | null = _redirectParameter89;
    let _redirectParameter101: string | null = _redirectParameter90;
    const _initialField0 = _redirectParameter91;
    const _initialField1 = _redirectParameter92;
    const _initialField2 = _redirectParameter93;
    const _initialField3 = _redirectParameter94;
    const _initialField4 = _redirectParameter95;
    const _initialField5 = _redirectParameter96;
    const _initialField6 = _redirectParameter97;
    const _initialField7 = _redirectParameter98;
    const _initialField8 = _redirectParameter99;
    const _initialField9 = _redirectParameter100;
    const _initialField10 = _redirectParameter101;
    const _dartTemporary8: InstanceType<typeof SourceColorDiagnosticBase> & {
        _dart_0a3bada12cddc054_effectiveColor: Color;
        _dart_0a3bada12cddc054_debugLabel: string | null;
        _dart_0a3bada12cddc054_debugResolveContext: Element | null;
        color: Color;
        darkColor: Color;
        highContrastColor: Color;
        darkHighContrastColor: Color;
        elevatedColor: Color;
        darkElevatedColor: Color;
        highContrastElevatedColor: Color;
        darkHighContrastElevatedColor: Color;
    } = Reflect.construct(SourceColorDiagnosticBase, [] satisfies ConstructorParameters<typeof SourceColorDiagnosticBase>, _dartTemporary7) as InstanceType<typeof SourceColorDiagnosticBase> & {
        _dart_0a3bada12cddc054_effectiveColor: Color;
        _dart_0a3bada12cddc054_debugLabel: string | null;
        _dart_0a3bada12cddc054_debugResolveContext: Element | null;
        color: Color;
        darkColor: Color;
        highContrastColor: Color;
        darkHighContrastColor: Color;
        elevatedColor: Color;
        darkElevatedColor: Color;
        highContrastElevatedColor: Color;
        darkHighContrastElevatedColor: Color;
    };
    captureDartType(_dartTemporary8, applyDartType<CupertinoDynamicColor>(_dartTemporary7, "CupertinoDynamicColor", [], [sourceColorType, widgetStateDiagnosticableType]));
    _dartTemporary8._dart_0a3bada12cddc054_effectiveColor = _initialField0;
    _dartTemporary8._dart_0a3bada12cddc054_debugLabel = _initialField10;
    _dartTemporary8._dart_0a3bada12cddc054_debugResolveContext = _initialField9;
    _dartTemporary8.color = _initialField1;
    _dartTemporary8.darkColor = _initialField2;
    _dartTemporary8.highContrastColor = _initialField3;
    _dartTemporary8.darkHighContrastColor = _initialField4;
    _dartTemporary8.elevatedColor = _initialField5;
    _dartTemporary8.darkElevatedColor = _initialField6;
    _dartTemporary8.highContrastElevatedColor = _initialField7;
    _dartTemporary8.darkHighContrastElevatedColor = _initialField8;
    protect(_dartTemporary8, ["_dart_0a3bada12cddc054_effectiveColor", "_dart_0a3bada12cddc054_debugLabel", "_dart_0a3bada12cddc054_debugResolveContext", "color", "darkColor", "highContrastColor", "darkHighContrastColor", "elevatedColor", "darkElevatedColor", "highContrastElevatedColor", "darkHighContrastElevatedColor"]);
    return _dartTemporary8 as CupertinoDynamicColor;
}
function _dartTemporary9(_dartTemporary10: typeof CupertinoDynamicColor, _effectiveColor: Color, color: Color, darkColor: Color, highContrastColor: Color, darkHighContrastColor: Color, elevatedColor: Color, darkElevatedColor: Color, highContrastElevatedColor: Color, darkHighContrastElevatedColor: Color, _debugResolveContext: Element | null, _debugLabel: string | null): CupertinoDynamicColor {
    const _initialField0 = _effectiveColor;
    const _initialField1 = color;
    const _initialField2 = darkColor;
    const _initialField3 = highContrastColor;
    const _initialField4 = darkHighContrastColor;
    const _initialField5 = elevatedColor;
    const _initialField6 = darkElevatedColor;
    const _initialField7 = highContrastElevatedColor;
    const _initialField8 = darkHighContrastElevatedColor;
    const _initialField9 = _debugResolveContext;
    const _initialField10 = _debugLabel;
    const _dartTemporary11: InstanceType<typeof SourceColorDiagnosticBase> & {
        _dart_0a3bada12cddc054_effectiveColor: Color;
        _dart_0a3bada12cddc054_debugLabel: string | null;
        _dart_0a3bada12cddc054_debugResolveContext: Element | null;
        color: Color;
        darkColor: Color;
        highContrastColor: Color;
        darkHighContrastColor: Color;
        elevatedColor: Color;
        darkElevatedColor: Color;
        highContrastElevatedColor: Color;
        darkHighContrastElevatedColor: Color;
    } = Reflect.construct(SourceColorDiagnosticBase, [] satisfies ConstructorParameters<typeof SourceColorDiagnosticBase>, _dartTemporary10) as InstanceType<typeof SourceColorDiagnosticBase> & {
        _dart_0a3bada12cddc054_effectiveColor: Color;
        _dart_0a3bada12cddc054_debugLabel: string | null;
        _dart_0a3bada12cddc054_debugResolveContext: Element | null;
        color: Color;
        darkColor: Color;
        highContrastColor: Color;
        darkHighContrastColor: Color;
        elevatedColor: Color;
        darkElevatedColor: Color;
        highContrastElevatedColor: Color;
        darkHighContrastElevatedColor: Color;
    };
    captureDartType(_dartTemporary11, applyDartType<CupertinoDynamicColor>(_dartTemporary10, "CupertinoDynamicColor", [], [sourceColorType, widgetStateDiagnosticableType]));
    _dartTemporary11._dart_0a3bada12cddc054_effectiveColor = _initialField0;
    _dartTemporary11._dart_0a3bada12cddc054_debugLabel = _initialField10;
    _dartTemporary11._dart_0a3bada12cddc054_debugResolveContext = _initialField9;
    _dartTemporary11.color = _initialField1;
    _dartTemporary11.darkColor = _initialField2;
    _dartTemporary11.highContrastColor = _initialField3;
    _dartTemporary11.darkHighContrastColor = _initialField4;
    _dartTemporary11.elevatedColor = _initialField5;
    _dartTemporary11.darkElevatedColor = _initialField6;
    _dartTemporary11.highContrastElevatedColor = _initialField7;
    _dartTemporary11.darkHighContrastElevatedColor = _initialField8;
    protect(_dartTemporary11, ["_dart_0a3bada12cddc054_effectiveColor", "_dart_0a3bada12cddc054_debugLabel", "_dart_0a3bada12cddc054_debugResolveContext", "color", "darkColor", "highContrastColor", "darkHighContrastColor", "elevatedColor", "darkElevatedColor", "highContrastElevatedColor", "darkHighContrastElevatedColor"]);
    return _dartTemporary11 as CupertinoDynamicColor;
}
export function createCupertinoColorProperty(name: string, value: Color | null, { showName = true, defaultValue = kNoDefaultValue, style = "singleLine", level = "info" }: {
    readonly showName?: boolean;
    readonly defaultValue?: {} | null;
    readonly style?: DiagnosticsTreeStyle;
    readonly level?: DiagnosticLevel;
} = {}): DiagnosticsProperty<Color> {
    if (isDartType<CupertinoDynamicColor>(value, applyDartType<CupertinoDynamicColor>(CupertinoDynamicColor, "CupertinoDynamicColor", [], [sourceColorType, widgetStateDiagnosticableType]))) {
        return sourceStyleDynamicColorProperty(name, value as CupertinoDynamicColor, { description: (value as CupertinoDynamicColor)._dart_0a3bada12cddc054_debugLabel, showName: showName, defaultValue: defaultValue, style: style, level: level });
    }
    else {
        return new ColorProperty(name, value, { showName: showName, defaultValue: defaultValue, style: style, level: level });
    }
}

// Composed manual declarations: tools/Nelyx.FrameworkToTypeScript/data/work8/inputs/style-color-registration.ts
const _sourceStyleColorRegistration: void = registerSourceStyleColors(CupertinoDynamicColor);
