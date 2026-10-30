// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Color } from "@nelyx/core/ui/color";
import { EdgeInsetsGeometry } from "@nelyx/core/framework/painting/edge-insets";
import { TextStyle } from "@nelyx/core/framework/painting/text-style";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface MaterialBannerThemeDataOptions {
  readonly backgroundColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly shadowColor?: Color | null;
  readonly dividerColor?: Color | null;
  readonly contentTextStyle?: TextStyle | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly leadingPadding?: EdgeInsetsGeometry | null;
}
type Values = {readonly [K in keyof Required<MaterialBannerThemeDataOptions>]: Exclude<MaterialBannerThemeDataOptions[K], undefined>};
export class MaterialBannerThemeData extends Diagnosticable(class {}) {
  private readonly values: Values;
  get backgroundColor(): Color | null { return this.values.backgroundColor; }
  get surfaceTintColor(): Color | null { return this.values.surfaceTintColor; }
  get shadowColor(): Color | null { return this.values.shadowColor; }
  get dividerColor(): Color | null { return this.values.dividerColor; }
  get contentTextStyle(): TextStyle | null { return this.values.contentTextStyle; }
  /** @dartType double? */
  get elevation(): number | null { return this.values.elevation; }
  get padding(): EdgeInsetsGeometry | null { return this.values.padding; }
  get leadingPadding(): EdgeInsetsGeometry | null { return this.values.leadingPadding; }
  /** @dartParam elevation double? */
  constructor(options: MaterialBannerThemeDataOptions = {}) {
    super();
    this.values = Object.freeze({
      backgroundColor: options.backgroundColor ?? null,
      surfaceTintColor: options.surfaceTintColor ?? null,
      shadowColor: options.shadowColor ?? null,
      dividerColor: options.dividerColor ?? null,
      contentTextStyle: options.contentTextStyle ?? null,
      elevation: options.elevation ?? null,
      padding: options.padding ?? null,
      leadingPadding: options.leadingPadding ?? null,
    });
    if (new.target === MaterialBannerThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double? */
  copyWith(options: MaterialBannerThemeDataOptions = {}): MaterialBannerThemeData {
    return new MaterialBannerThemeData({
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      surfaceTintColor: options.surfaceTintColor ?? this.surfaceTintColor,
      shadowColor: options.shadowColor ?? this.shadowColor,
      dividerColor: options.dividerColor ?? this.dividerColor,
      contentTextStyle: options.contentTextStyle ?? this.contentTextStyle,
      elevation: options.elevation ?? this.elevation,
      padding: options.padding ?? this.padding,
      leadingPadding: options.leadingPadding ?? this.leadingPadding,
    });
  }
  /** @dartParam t double */
  static lerp(a: MaterialBannerThemeData | null, b: MaterialBannerThemeData | null, t: number): MaterialBannerThemeData {
    return new MaterialBannerThemeData({
      backgroundColor: Color.lerp((a?.backgroundColor ?? null), (b?.backgroundColor ?? null), t),
      surfaceTintColor: Color.lerp((a?.surfaceTintColor ?? null), (b?.surfaceTintColor ?? null), t),
      shadowColor: Color.lerp((a?.shadowColor ?? null), (b?.shadowColor ?? null), t),
      dividerColor: Color.lerp((a?.dividerColor ?? null), (b?.dividerColor ?? null), t),
      contentTextStyle: TextStyle.lerp((a?.contentTextStyle ?? null), (b?.contentTextStyle ?? null), t),
      elevation: lerpDouble((a?.elevation ?? null), (b?.elevation ?? null), t),
      padding: EdgeInsetsGeometry.lerp((a?.padding ?? null), (b?.padding ?? null), t),
      leadingPadding: EdgeInsetsGeometry.lerp((a?.leadingPadding ?? null), (b?.leadingPadding ?? null), t),
    });
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof MaterialBannerThemeData) || other.constructor !== this.constructor) return false;
    return valueEquals(this.backgroundColor, other.backgroundColor) &&
      valueEquals(this.surfaceTintColor, other.surfaceTintColor) &&
      valueEquals(this.shadowColor, other.shadowColor) &&
      valueEquals(this.dividerColor, other.dividerColor) &&
      valueEquals(this.contentTextStyle, other.contentTextStyle) &&
      valueEquals(this.elevation, other.elevation) &&
      valueEquals(this.padding, other.padding) &&
      valueEquals(this.leadingPadding, other.leadingPadding);
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.backgroundColor,
      this.surfaceTintColor,
      this.shadowColor,
      this.dividerColor,
      this.contentTextStyle,
      this.elevation,
      this.padding,
      this.leadingPadding,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new ColorProperty("backgroundColor", this.backgroundColor, {defaultValue: null}));
    properties.add(new ColorProperty("surfaceTintColor", this.surfaceTintColor, {defaultValue: null}));
    properties.add(new ColorProperty("shadowColor", this.shadowColor, {defaultValue: null}));
    properties.add(new ColorProperty("dividerColor", this.dividerColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("contentTextStyle", this.contentTextStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new DoubleProperty("elevation", this.elevation, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("padding", this.padding, {defaultValue: null, typeName: "EdgeInsetsGeometry"}));
    properties.add(new DiagnosticsProperty("leadingPadding", this.leadingPadding, {defaultValue: null, typeName: "EdgeInsetsGeometry"}));
  }
}
