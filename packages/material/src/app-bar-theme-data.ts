// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Color } from "@nelyx/core/ui/color";
import { EdgeInsetsGeometry } from "@nelyx/core/framework/painting/edge-insets";
import { IconThemeData } from "@nelyx/core/framework/widgets/icon-theme-data";
import { ShapeBorder } from "@nelyx/core/framework/painting/borders";
import type { SystemUiOverlayStyle } from "@nelyx/core/services/system-ui-overlay-style";
import { TextStyle } from "@nelyx/core/framework/painting/text-style";
import { describeSystemUiOverlayStyle } from "./internal/theme/value-interpolation.ts";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty, EnumProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface AppBarThemeDataOptions {
  readonly backgroundColor?: Color | null;
  readonly foregroundColor?: Color | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  /** @dartType double? */
  readonly scrolledUnderElevation?: number | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly shape?: ShapeBorder | null;
  readonly iconTheme?: IconThemeData | null;
  readonly actionsIconTheme?: IconThemeData | null;
  readonly centerTitle?: boolean | null;
  /** @dartType double? */
  readonly titleSpacing?: number | null;
  /** @dartType double? */
  readonly leadingWidth?: number | null;
  /** @dartType double? */
  readonly toolbarHeight?: number | null;
  readonly toolbarTextStyle?: TextStyle | null;
  readonly titleTextStyle?: TextStyle | null;
  readonly systemOverlayStyle?: SystemUiOverlayStyle | null;
  readonly actionsPadding?: EdgeInsetsGeometry | null;
}
type Values = {readonly [K in keyof Required<AppBarThemeDataOptions>]: Exclude<AppBarThemeDataOptions[K], undefined>};
export class AppBarThemeData extends Diagnosticable(class {}) {
  private readonly values: Values;
  get backgroundColor(): Color | null { return this.values.backgroundColor; }
  get foregroundColor(): Color | null { return this.values.foregroundColor; }
  /** @dartType double? */
  get elevation(): number | null { return this.values.elevation; }
  /** @dartType double? */
  get scrolledUnderElevation(): number | null { return this.values.scrolledUnderElevation; }
  get shadowColor(): Color | null { return this.values.shadowColor; }
  get surfaceTintColor(): Color | null { return this.values.surfaceTintColor; }
  get shape(): ShapeBorder | null { return this.values.shape; }
  get iconTheme(): IconThemeData | null { return this.values.iconTheme; }
  get actionsIconTheme(): IconThemeData | null { return this.values.actionsIconTheme; }
  get centerTitle(): boolean | null { return this.values.centerTitle; }
  /** @dartType double? */
  get titleSpacing(): number | null { return this.values.titleSpacing; }
  /** @dartType double? */
  get leadingWidth(): number | null { return this.values.leadingWidth; }
  /** @dartType double? */
  get toolbarHeight(): number | null { return this.values.toolbarHeight; }
  get toolbarTextStyle(): TextStyle | null { return this.values.toolbarTextStyle; }
  get titleTextStyle(): TextStyle | null { return this.values.titleTextStyle; }
  get systemOverlayStyle(): SystemUiOverlayStyle | null { return this.values.systemOverlayStyle; }
  get actionsPadding(): EdgeInsetsGeometry | null { return this.values.actionsPadding; }
  /** @dartParam elevation double?
   * @dartParam scrolledUnderElevation double?
   * @dartParam titleSpacing double?
   * @dartParam leadingWidth double?
   * @dartParam toolbarHeight double? */
  constructor(options: AppBarThemeDataOptions = {}) {
    super();
    if (Object.hasOwn(options, "color")) throw new TypeError("AppBarThemeData.color has been removed; use backgroundColor");
    this.values = Object.freeze({
      backgroundColor: options.backgroundColor ?? null,
      foregroundColor: options.foregroundColor ?? null,
      elevation: options.elevation ?? null,
      scrolledUnderElevation: options.scrolledUnderElevation ?? null,
      shadowColor: options.shadowColor ?? null,
      surfaceTintColor: options.surfaceTintColor ?? null,
      shape: options.shape ?? null,
      iconTheme: options.iconTheme ?? null,
      actionsIconTheme: options.actionsIconTheme ?? null,
      centerTitle: options.centerTitle ?? null,
      titleSpacing: options.titleSpacing ?? null,
      leadingWidth: options.leadingWidth ?? null,
      toolbarHeight: options.toolbarHeight ?? null,
      toolbarTextStyle: options.toolbarTextStyle ?? null,
      titleTextStyle: options.titleTextStyle ?? null,
      systemOverlayStyle: options.systemOverlayStyle ?? null,
      actionsPadding: options.actionsPadding ?? null,
    });
    if (new.target === AppBarThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double?
   * @dartParam scrolledUnderElevation double?
   * @dartParam titleSpacing double?
   * @dartParam leadingWidth double?
   * @dartParam toolbarHeight double? */
  copyWith(options: AppBarThemeDataOptions = {}): AppBarThemeData {
    return new AppBarThemeData({
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      foregroundColor: options.foregroundColor ?? this.foregroundColor,
      elevation: options.elevation ?? this.elevation,
      scrolledUnderElevation: options.scrolledUnderElevation ?? this.scrolledUnderElevation,
      shadowColor: options.shadowColor ?? this.shadowColor,
      surfaceTintColor: options.surfaceTintColor ?? this.surfaceTintColor,
      shape: options.shape ?? this.shape,
      iconTheme: options.iconTheme ?? this.iconTheme,
      actionsIconTheme: options.actionsIconTheme ?? this.actionsIconTheme,
      centerTitle: options.centerTitle ?? this.centerTitle,
      titleSpacing: options.titleSpacing ?? this.titleSpacing,
      leadingWidth: options.leadingWidth ?? this.leadingWidth,
      toolbarHeight: options.toolbarHeight ?? this.toolbarHeight,
      toolbarTextStyle: options.toolbarTextStyle ?? this.toolbarTextStyle,
      titleTextStyle: options.titleTextStyle ?? this.titleTextStyle,
      systemOverlayStyle: options.systemOverlayStyle ?? this.systemOverlayStyle,
      actionsPadding: options.actionsPadding ?? this.actionsPadding,
    });
  }
  /** @dartParam t double */
  static lerp(a: AppBarThemeData, b: AppBarThemeData, t: number): AppBarThemeData {
    if ((a === b)) {
    return a;
  }
    return new AppBarThemeData({
      backgroundColor: Color.lerp(a.backgroundColor, b.backgroundColor, t),
      foregroundColor: Color.lerp(a.foregroundColor, b.foregroundColor, t),
      elevation: lerpDouble(a.elevation, b.elevation, t),
      scrolledUnderElevation: lerpDouble(a.scrolledUnderElevation, b.scrolledUnderElevation, t),
      shadowColor: Color.lerp(a.shadowColor, b.shadowColor, t),
      surfaceTintColor: Color.lerp(a.surfaceTintColor, b.surfaceTintColor, t),
      shape: ShapeBorder.lerp(a.shape, b.shape, t),
      iconTheme: IconThemeData.lerp(a.iconTheme, b.iconTheme, t),
      actionsIconTheme: IconThemeData.lerp(a.actionsIconTheme, b.actionsIconTheme, t),
      centerTitle: ((t < 0.5) ? a.centerTitle : b.centerTitle),
      titleSpacing: lerpDouble(a.titleSpacing, b.titleSpacing, t),
      leadingWidth: lerpDouble(a.leadingWidth, b.leadingWidth, t),
      toolbarHeight: lerpDouble(a.toolbarHeight, b.toolbarHeight, t),
      toolbarTextStyle: TextStyle.lerp(a.toolbarTextStyle, b.toolbarTextStyle, t),
      titleTextStyle: TextStyle.lerp(a.titleTextStyle, b.titleTextStyle, t),
      systemOverlayStyle: ((t < 0.5) ? a.systemOverlayStyle : b.systemOverlayStyle),
      actionsPadding: EdgeInsetsGeometry.lerp(a.actionsPadding, b.actionsPadding, t),
    });
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof AppBarThemeData) || other.constructor !== this.constructor) return false;
    return valueEquals(this.backgroundColor, other.backgroundColor) &&
      valueEquals(this.foregroundColor, other.foregroundColor) &&
      valueEquals(this.elevation, other.elevation) &&
      valueEquals(this.scrolledUnderElevation, other.scrolledUnderElevation) &&
      valueEquals(this.shadowColor, other.shadowColor) &&
      valueEquals(this.surfaceTintColor, other.surfaceTintColor) &&
      valueEquals(this.shape, other.shape) &&
      valueEquals(this.iconTheme, other.iconTheme) &&
      valueEquals(this.actionsIconTheme, other.actionsIconTheme) &&
      valueEquals(this.centerTitle, other.centerTitle) &&
      valueEquals(this.titleSpacing, other.titleSpacing) &&
      valueEquals(this.leadingWidth, other.leadingWidth) &&
      valueEquals(this.toolbarHeight, other.toolbarHeight) &&
      valueEquals(this.toolbarTextStyle, other.toolbarTextStyle) &&
      valueEquals(this.titleTextStyle, other.titleTextStyle) &&
      valueEquals(this.systemOverlayStyle, other.systemOverlayStyle) &&
      valueEquals(this.actionsPadding, other.actionsPadding);
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.backgroundColor,
      this.foregroundColor,
      this.elevation,
      this.scrolledUnderElevation,
      this.shadowColor,
      this.surfaceTintColor,
      this.shape,
      this.iconTheme,
      this.actionsIconTheme,
      this.centerTitle,
      this.titleSpacing,
      this.leadingWidth,
      this.toolbarHeight,
      this.toolbarTextStyle,
      this.titleTextStyle,
      this.systemOverlayStyle,
      this.actionsPadding,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new ColorProperty("backgroundColor", this.backgroundColor, {defaultValue: null}));
    properties.add(new ColorProperty("foregroundColor", this.foregroundColor, {defaultValue: null}));
    properties.add(new DoubleProperty("elevation", this.elevation, {defaultValue: null}));
    properties.add(new DoubleProperty("scrolledUnderElevation", this.scrolledUnderElevation, {defaultValue: null}));
    properties.add(new ColorProperty("shadowColor", this.shadowColor, {defaultValue: null}));
    properties.add(new ColorProperty("surfaceTintColor", this.surfaceTintColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("shape", this.shape, {defaultValue: null, typeName: "ShapeBorder"}));
    properties.add(new DiagnosticsProperty("iconTheme", this.iconTheme, {defaultValue: null, typeName: "IconThemeData"}));
    properties.add(new DiagnosticsProperty("actionsIconTheme", this.actionsIconTheme, {defaultValue: null, typeName: "IconThemeData"}));
    properties.add(new DiagnosticsProperty("centerTitle", this.centerTitle, {defaultValue: null, typeName: "bool"}));
    properties.add(new DoubleProperty("titleSpacing", this.titleSpacing, {defaultValue: null}));
    properties.add(new DoubleProperty("leadingWidth", this.leadingWidth, {defaultValue: null}));
    properties.add(new DoubleProperty("toolbarHeight", this.toolbarHeight, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("toolbarTextStyle", this.toolbarTextStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new DiagnosticsProperty("titleTextStyle", this.titleTextStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new DiagnosticsProperty("systemOverlayStyle", this.systemOverlayStyle, {defaultValue: null, typeName: "SystemUiOverlayStyle?", description: describeSystemUiOverlayStyle(this.systemOverlayStyle)}));
    properties.add(new DiagnosticsProperty("actionsPadding", this.actionsPadding, {defaultValue: null, typeName: "EdgeInsetsGeometry?"}));
  }
}
