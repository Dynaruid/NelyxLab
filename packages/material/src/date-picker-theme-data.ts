// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { BorderSide } from "@nelyx/core/framework/painting/borders";
import { ButtonStyle } from "./button-style.ts";
import { Color } from "@nelyx/core/ui/color";
import { InputDecorationThemeData } from "./input-decoration-theme-data.ts";
import type { Locale } from "@nelyx/core/ui/locale";
import { OutlinedBorder } from "@nelyx/core/framework/painting/borders";
import { ShapeBorder } from "@nelyx/core/framework/painting/borders";
import { TextStyle } from "@nelyx/core/framework/painting/text-style";
import { WidgetStateProperty } from "@nelyx/core/framework/widgets/widget-state";
import { lerpColorProperty, lerpOutlinedBorderProperty, lerpDatePickerSide } from "./internal/theme/value-interpolation.ts";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface DatePickerThemeDataOptions {
  readonly backgroundColor?: Color | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly shape?: ShapeBorder | null;
  readonly headerBackgroundColor?: Color | null;
  readonly headerForegroundColor?: Color | null;
  readonly headerHeadlineStyle?: TextStyle | null;
  readonly headerHelpStyle?: TextStyle | null;
  readonly weekdayStyle?: TextStyle | null;
  readonly dayStyle?: TextStyle | null;
  readonly dayForegroundColor?: WidgetStateProperty<Color | null> | null;
  readonly dayBackgroundColor?: WidgetStateProperty<Color | null> | null;
  readonly dayOverlayColor?: WidgetStateProperty<Color | null> | null;
  readonly dayShape?: WidgetStateProperty<OutlinedBorder | null> | null;
  readonly todayForegroundColor?: WidgetStateProperty<Color | null> | null;
  readonly todayBackgroundColor?: WidgetStateProperty<Color | null> | null;
  readonly todayBorder?: BorderSide | null;
  readonly yearStyle?: TextStyle | null;
  readonly yearForegroundColor?: WidgetStateProperty<Color | null> | null;
  readonly yearBackgroundColor?: WidgetStateProperty<Color | null> | null;
  readonly yearOverlayColor?: WidgetStateProperty<Color | null> | null;
  readonly yearShape?: WidgetStateProperty<OutlinedBorder | null> | null;
  readonly rangePickerBackgroundColor?: Color | null;
  /** @dartType double? */
  readonly rangePickerElevation?: number | null;
  readonly rangePickerShadowColor?: Color | null;
  readonly rangePickerSurfaceTintColor?: Color | null;
  readonly rangePickerShape?: ShapeBorder | null;
  readonly rangePickerHeaderBackgroundColor?: Color | null;
  readonly rangePickerHeaderForegroundColor?: Color | null;
  readonly rangePickerHeaderHeadlineStyle?: TextStyle | null;
  readonly rangePickerHeaderHelpStyle?: TextStyle | null;
  readonly rangeSelectionBackgroundColor?: Color | null;
  readonly rangeSelectionOverlayColor?: WidgetStateProperty<Color | null> | null;
  readonly dividerColor?: Color | null;
  readonly inputDecorationTheme?: InputDecorationThemeData | null;
  readonly cancelButtonStyle?: ButtonStyle | null;
  readonly confirmButtonStyle?: ButtonStyle | null;
  readonly locale?: Locale | null;
  readonly toggleButtonTextStyle?: TextStyle | null;
  readonly subHeaderForegroundColor?: Color | null;
}
type Values = {readonly [K in keyof Required<DatePickerThemeDataOptions>]: Exclude<DatePickerThemeDataOptions[K], undefined>};
export class DatePickerThemeData extends Diagnosticable(class {}) {
  private readonly values: Values;
  get backgroundColor(): Color | null { return this.values.backgroundColor; }
  /** @dartType double? */
  get elevation(): number | null { return this.values.elevation; }
  get shadowColor(): Color | null { return this.values.shadowColor; }
  get surfaceTintColor(): Color | null { return this.values.surfaceTintColor; }
  get shape(): ShapeBorder | null { return this.values.shape; }
  get headerBackgroundColor(): Color | null { return this.values.headerBackgroundColor; }
  get headerForegroundColor(): Color | null { return this.values.headerForegroundColor; }
  get headerHeadlineStyle(): TextStyle | null { return this.values.headerHeadlineStyle; }
  get headerHelpStyle(): TextStyle | null { return this.values.headerHelpStyle; }
  get weekdayStyle(): TextStyle | null { return this.values.weekdayStyle; }
  get dayStyle(): TextStyle | null { return this.values.dayStyle; }
  get dayForegroundColor(): WidgetStateProperty<Color | null> | null { return this.values.dayForegroundColor; }
  get dayBackgroundColor(): WidgetStateProperty<Color | null> | null { return this.values.dayBackgroundColor; }
  get dayOverlayColor(): WidgetStateProperty<Color | null> | null { return this.values.dayOverlayColor; }
  get dayShape(): WidgetStateProperty<OutlinedBorder | null> | null { return this.values.dayShape; }
  get todayForegroundColor(): WidgetStateProperty<Color | null> | null { return this.values.todayForegroundColor; }
  get todayBackgroundColor(): WidgetStateProperty<Color | null> | null { return this.values.todayBackgroundColor; }
  get todayBorder(): BorderSide | null { return this.values.todayBorder; }
  get yearStyle(): TextStyle | null { return this.values.yearStyle; }
  get yearForegroundColor(): WidgetStateProperty<Color | null> | null { return this.values.yearForegroundColor; }
  get yearBackgroundColor(): WidgetStateProperty<Color | null> | null { return this.values.yearBackgroundColor; }
  get yearOverlayColor(): WidgetStateProperty<Color | null> | null { return this.values.yearOverlayColor; }
  get yearShape(): WidgetStateProperty<OutlinedBorder | null> | null { return this.values.yearShape; }
  get rangePickerBackgroundColor(): Color | null { return this.values.rangePickerBackgroundColor; }
  /** @dartType double? */
  get rangePickerElevation(): number | null { return this.values.rangePickerElevation; }
  get rangePickerShadowColor(): Color | null { return this.values.rangePickerShadowColor; }
  get rangePickerSurfaceTintColor(): Color | null { return this.values.rangePickerSurfaceTintColor; }
  get rangePickerShape(): ShapeBorder | null { return this.values.rangePickerShape; }
  get rangePickerHeaderBackgroundColor(): Color | null { return this.values.rangePickerHeaderBackgroundColor; }
  get rangePickerHeaderForegroundColor(): Color | null { return this.values.rangePickerHeaderForegroundColor; }
  get rangePickerHeaderHeadlineStyle(): TextStyle | null { return this.values.rangePickerHeaderHeadlineStyle; }
  get rangePickerHeaderHelpStyle(): TextStyle | null { return this.values.rangePickerHeaderHelpStyle; }
  get rangeSelectionBackgroundColor(): Color | null { return this.values.rangeSelectionBackgroundColor; }
  get rangeSelectionOverlayColor(): WidgetStateProperty<Color | null> | null { return this.values.rangeSelectionOverlayColor; }
  get dividerColor(): Color | null { return this.values.dividerColor; }
  get inputDecorationTheme(): InputDecorationThemeData | null { return this.values.inputDecorationTheme; }
  get cancelButtonStyle(): ButtonStyle | null { return this.values.cancelButtonStyle; }
  get confirmButtonStyle(): ButtonStyle | null { return this.values.confirmButtonStyle; }
  get locale(): Locale | null { return this.values.locale; }
  get toggleButtonTextStyle(): TextStyle | null { return this.values.toggleButtonTextStyle; }
  get subHeaderForegroundColor(): Color | null { return this.values.subHeaderForegroundColor; }
  /** @dartParam elevation double?
   * @dartParam rangePickerElevation double? */
  constructor(options: DatePickerThemeDataOptions = {}) {
    super();
    this.values = Object.freeze({
      backgroundColor: options.backgroundColor ?? null,
      elevation: options.elevation ?? null,
      shadowColor: options.shadowColor ?? null,
      surfaceTintColor: options.surfaceTintColor ?? null,
      shape: options.shape ?? null,
      headerBackgroundColor: options.headerBackgroundColor ?? null,
      headerForegroundColor: options.headerForegroundColor ?? null,
      headerHeadlineStyle: options.headerHeadlineStyle ?? null,
      headerHelpStyle: options.headerHelpStyle ?? null,
      weekdayStyle: options.weekdayStyle ?? null,
      dayStyle: options.dayStyle ?? null,
      dayForegroundColor: options.dayForegroundColor ?? null,
      dayBackgroundColor: options.dayBackgroundColor ?? null,
      dayOverlayColor: options.dayOverlayColor ?? null,
      dayShape: options.dayShape ?? null,
      todayForegroundColor: options.todayForegroundColor ?? null,
      todayBackgroundColor: options.todayBackgroundColor ?? null,
      todayBorder: options.todayBorder ?? null,
      yearStyle: options.yearStyle ?? null,
      yearForegroundColor: options.yearForegroundColor ?? null,
      yearBackgroundColor: options.yearBackgroundColor ?? null,
      yearOverlayColor: options.yearOverlayColor ?? null,
      yearShape: options.yearShape ?? null,
      rangePickerBackgroundColor: options.rangePickerBackgroundColor ?? null,
      rangePickerElevation: options.rangePickerElevation ?? null,
      rangePickerShadowColor: options.rangePickerShadowColor ?? null,
      rangePickerSurfaceTintColor: options.rangePickerSurfaceTintColor ?? null,
      rangePickerShape: options.rangePickerShape ?? null,
      rangePickerHeaderBackgroundColor: options.rangePickerHeaderBackgroundColor ?? null,
      rangePickerHeaderForegroundColor: options.rangePickerHeaderForegroundColor ?? null,
      rangePickerHeaderHeadlineStyle: options.rangePickerHeaderHeadlineStyle ?? null,
      rangePickerHeaderHelpStyle: options.rangePickerHeaderHelpStyle ?? null,
      rangeSelectionBackgroundColor: options.rangeSelectionBackgroundColor ?? null,
      rangeSelectionOverlayColor: options.rangeSelectionOverlayColor ?? null,
      dividerColor: options.dividerColor ?? null,
      inputDecorationTheme: options.inputDecorationTheme ?? null,
      cancelButtonStyle: options.cancelButtonStyle ?? null,
      confirmButtonStyle: options.confirmButtonStyle ?? null,
      locale: options.locale ?? null,
      toggleButtonTextStyle: options.toggleButtonTextStyle ?? null,
      subHeaderForegroundColor: options.subHeaderForegroundColor ?? null,
    });
    if (this.inputDecorationTheme !== null && !(this.inputDecorationTheme instanceof InputDecorationThemeData)) throw new TypeError("Use modern InputDecorationThemeData values");
    if (new.target === DatePickerThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double?
   * @dartParam rangePickerElevation double? */
  copyWith(options: DatePickerThemeDataOptions = {}): DatePickerThemeData {
    return new DatePickerThemeData({
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      elevation: options.elevation ?? this.elevation,
      shadowColor: options.shadowColor ?? this.shadowColor,
      surfaceTintColor: options.surfaceTintColor ?? this.surfaceTintColor,
      shape: options.shape ?? this.shape,
      headerBackgroundColor: options.headerBackgroundColor ?? this.headerBackgroundColor,
      headerForegroundColor: options.headerForegroundColor ?? this.headerForegroundColor,
      headerHeadlineStyle: options.headerHeadlineStyle ?? this.headerHeadlineStyle,
      headerHelpStyle: options.headerHelpStyle ?? this.headerHelpStyle,
      weekdayStyle: options.weekdayStyle ?? this.weekdayStyle,
      dayStyle: options.dayStyle ?? this.dayStyle,
      dayForegroundColor: options.dayForegroundColor ?? this.dayForegroundColor,
      dayBackgroundColor: options.dayBackgroundColor ?? this.dayBackgroundColor,
      dayOverlayColor: options.dayOverlayColor ?? this.dayOverlayColor,
      dayShape: options.dayShape ?? this.dayShape,
      todayForegroundColor: options.todayForegroundColor ?? this.todayForegroundColor,
      todayBackgroundColor: options.todayBackgroundColor ?? this.todayBackgroundColor,
      todayBorder: options.todayBorder ?? this.todayBorder,
      yearStyle: options.yearStyle ?? this.yearStyle,
      yearForegroundColor: options.yearForegroundColor ?? this.yearForegroundColor,
      yearBackgroundColor: options.yearBackgroundColor ?? this.yearBackgroundColor,
      yearOverlayColor: options.yearOverlayColor ?? this.yearOverlayColor,
      yearShape: options.yearShape ?? this.yearShape,
      rangePickerBackgroundColor: options.rangePickerBackgroundColor ?? this.rangePickerBackgroundColor,
      rangePickerElevation: options.rangePickerElevation ?? this.rangePickerElevation,
      rangePickerShadowColor: options.rangePickerShadowColor ?? this.rangePickerShadowColor,
      rangePickerSurfaceTintColor: options.rangePickerSurfaceTintColor ?? this.rangePickerSurfaceTintColor,
      rangePickerShape: options.rangePickerShape ?? this.rangePickerShape,
      rangePickerHeaderBackgroundColor: options.rangePickerHeaderBackgroundColor ?? this.rangePickerHeaderBackgroundColor,
      rangePickerHeaderForegroundColor: options.rangePickerHeaderForegroundColor ?? this.rangePickerHeaderForegroundColor,
      rangePickerHeaderHeadlineStyle: options.rangePickerHeaderHeadlineStyle ?? this.rangePickerHeaderHeadlineStyle,
      rangePickerHeaderHelpStyle: options.rangePickerHeaderHelpStyle ?? this.rangePickerHeaderHelpStyle,
      rangeSelectionBackgroundColor: options.rangeSelectionBackgroundColor ?? this.rangeSelectionBackgroundColor,
      rangeSelectionOverlayColor: options.rangeSelectionOverlayColor ?? this.rangeSelectionOverlayColor,
      dividerColor: options.dividerColor ?? this.dividerColor,
      inputDecorationTheme: options.inputDecorationTheme ?? this.inputDecorationTheme,
      cancelButtonStyle: options.cancelButtonStyle ?? this.cancelButtonStyle,
      confirmButtonStyle: options.confirmButtonStyle ?? this.confirmButtonStyle,
      locale: options.locale ?? this.locale,
      toggleButtonTextStyle: options.toggleButtonTextStyle ?? this.toggleButtonTextStyle,
      subHeaderForegroundColor: options.subHeaderForegroundColor ?? this.subHeaderForegroundColor,
    });
  }
  /** @dartParam t double */
  static lerp(a: DatePickerThemeData | null, b: DatePickerThemeData | null, t: number): DatePickerThemeData {
    if (((a === b) && (a !== null))) {
    return a;
  }
    return new DatePickerThemeData({
      backgroundColor: Color.lerp((a?.backgroundColor ?? null), (b?.backgroundColor ?? null), t),
      elevation: lerpDouble((a?.elevation ?? null), (b?.elevation ?? null), t),
      shadowColor: Color.lerp((a?.shadowColor ?? null), (b?.shadowColor ?? null), t),
      surfaceTintColor: Color.lerp((a?.surfaceTintColor ?? null), (b?.surfaceTintColor ?? null), t),
      shape: ShapeBorder.lerp((a?.shape ?? null), (b?.shape ?? null), t),
      headerBackgroundColor: Color.lerp((a?.headerBackgroundColor ?? null), (b?.headerBackgroundColor ?? null), t),
      headerForegroundColor: Color.lerp((a?.headerForegroundColor ?? null), (b?.headerForegroundColor ?? null), t),
      headerHeadlineStyle: TextStyle.lerp((a?.headerHeadlineStyle ?? null), (b?.headerHeadlineStyle ?? null), t),
      headerHelpStyle: TextStyle.lerp((a?.headerHelpStyle ?? null), (b?.headerHelpStyle ?? null), t),
      weekdayStyle: TextStyle.lerp((a?.weekdayStyle ?? null), (b?.weekdayStyle ?? null), t),
      dayStyle: TextStyle.lerp((a?.dayStyle ?? null), (b?.dayStyle ?? null), t),
      dayForegroundColor: lerpColorProperty((a?.dayForegroundColor ?? null), (b?.dayForegroundColor ?? null), t),
      dayBackgroundColor: lerpColorProperty((a?.dayBackgroundColor ?? null), (b?.dayBackgroundColor ?? null), t),
      dayOverlayColor: lerpColorProperty((a?.dayOverlayColor ?? null), (b?.dayOverlayColor ?? null), t),
      dayShape: lerpOutlinedBorderProperty((a?.dayShape ?? null), (b?.dayShape ?? null), t),
      todayForegroundColor: lerpColorProperty((a?.todayForegroundColor ?? null), (b?.todayForegroundColor ?? null), t),
      todayBackgroundColor: lerpColorProperty((a?.todayBackgroundColor ?? null), (b?.todayBackgroundColor ?? null), t),
      todayBorder: lerpDatePickerSide((a?.todayBorder ?? null), (b?.todayBorder ?? null), t),
      yearStyle: TextStyle.lerp((a?.yearStyle ?? null), (b?.yearStyle ?? null), t),
      yearForegroundColor: lerpColorProperty((a?.yearForegroundColor ?? null), (b?.yearForegroundColor ?? null), t),
      yearBackgroundColor: lerpColorProperty((a?.yearBackgroundColor ?? null), (b?.yearBackgroundColor ?? null), t),
      yearOverlayColor: lerpColorProperty((a?.yearOverlayColor ?? null), (b?.yearOverlayColor ?? null), t),
      yearShape: lerpOutlinedBorderProperty((a?.yearShape ?? null), (b?.yearShape ?? null), t),
      rangePickerBackgroundColor: Color.lerp((a?.rangePickerBackgroundColor ?? null), (b?.rangePickerBackgroundColor ?? null), t),
      rangePickerElevation: lerpDouble((a?.rangePickerElevation ?? null), (b?.rangePickerElevation ?? null), t),
      rangePickerShadowColor: Color.lerp((a?.rangePickerShadowColor ?? null), (b?.rangePickerShadowColor ?? null), t),
      rangePickerSurfaceTintColor: Color.lerp((a?.rangePickerSurfaceTintColor ?? null), (b?.rangePickerSurfaceTintColor ?? null), t),
      rangePickerShape: ShapeBorder.lerp((a?.rangePickerShape ?? null), (b?.rangePickerShape ?? null), t),
      rangePickerHeaderBackgroundColor: Color.lerp((a?.rangePickerHeaderBackgroundColor ?? null), (b?.rangePickerHeaderBackgroundColor ?? null), t),
      rangePickerHeaderForegroundColor: Color.lerp((a?.rangePickerHeaderForegroundColor ?? null), (b?.rangePickerHeaderForegroundColor ?? null), t),
      rangePickerHeaderHeadlineStyle: TextStyle.lerp((a?.rangePickerHeaderHeadlineStyle ?? null), (b?.rangePickerHeaderHeadlineStyle ?? null), t),
      rangePickerHeaderHelpStyle: TextStyle.lerp((a?.rangePickerHeaderHelpStyle ?? null), (b?.rangePickerHeaderHelpStyle ?? null), t),
      rangeSelectionBackgroundColor: Color.lerp((a?.rangeSelectionBackgroundColor ?? null), (b?.rangeSelectionBackgroundColor ?? null), t),
      rangeSelectionOverlayColor: lerpColorProperty((a?.rangeSelectionOverlayColor ?? null), (b?.rangeSelectionOverlayColor ?? null), t),
      dividerColor: Color.lerp((a?.dividerColor ?? null), (b?.dividerColor ?? null), t),
      inputDecorationTheme: ((t < 0.5) ? (a?.inputDecorationTheme ?? null) : (b?.inputDecorationTheme ?? null)),
      cancelButtonStyle: ButtonStyle.lerp((a?.cancelButtonStyle ?? null), (b?.cancelButtonStyle ?? null), t),
      confirmButtonStyle: ButtonStyle.lerp((a?.confirmButtonStyle ?? null), (b?.confirmButtonStyle ?? null), t),
      locale: ((t < 0.5) ? (a?.locale ?? null) : (b?.locale ?? null)),
      toggleButtonTextStyle: TextStyle.lerp((a?.toggleButtonTextStyle ?? null), (b?.toggleButtonTextStyle ?? null), t),
      subHeaderForegroundColor: Color.lerp((a?.subHeaderForegroundColor ?? null), (b?.subHeaderForegroundColor ?? null), t),
    });
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof DatePickerThemeData)) return false;
    return valueEquals(this.backgroundColor, other.backgroundColor) &&
      valueEquals(this.elevation, other.elevation) &&
      valueEquals(this.shadowColor, other.shadowColor) &&
      valueEquals(this.surfaceTintColor, other.surfaceTintColor) &&
      valueEquals(this.shape, other.shape) &&
      valueEquals(this.headerBackgroundColor, other.headerBackgroundColor) &&
      valueEquals(this.headerForegroundColor, other.headerForegroundColor) &&
      valueEquals(this.headerHeadlineStyle, other.headerHeadlineStyle) &&
      valueEquals(this.headerHelpStyle, other.headerHelpStyle) &&
      valueEquals(this.weekdayStyle, other.weekdayStyle) &&
      valueEquals(this.dayStyle, other.dayStyle) &&
      valueEquals(this.dayForegroundColor, other.dayForegroundColor) &&
      valueEquals(this.dayBackgroundColor, other.dayBackgroundColor) &&
      valueEquals(this.dayOverlayColor, other.dayOverlayColor) &&
      valueEquals(this.dayShape, other.dayShape) &&
      valueEquals(this.todayForegroundColor, other.todayForegroundColor) &&
      valueEquals(this.todayBackgroundColor, other.todayBackgroundColor) &&
      valueEquals(this.todayBorder, other.todayBorder) &&
      valueEquals(this.yearStyle, other.yearStyle) &&
      valueEquals(this.yearForegroundColor, other.yearForegroundColor) &&
      valueEquals(this.yearBackgroundColor, other.yearBackgroundColor) &&
      valueEquals(this.yearOverlayColor, other.yearOverlayColor) &&
      valueEquals(this.yearShape, other.yearShape) &&
      valueEquals(this.rangePickerBackgroundColor, other.rangePickerBackgroundColor) &&
      valueEquals(this.rangePickerElevation, other.rangePickerElevation) &&
      valueEquals(this.rangePickerShadowColor, other.rangePickerShadowColor) &&
      valueEquals(this.rangePickerSurfaceTintColor, other.rangePickerSurfaceTintColor) &&
      valueEquals(this.rangePickerShape, other.rangePickerShape) &&
      valueEquals(this.rangePickerHeaderBackgroundColor, other.rangePickerHeaderBackgroundColor) &&
      valueEquals(this.rangePickerHeaderForegroundColor, other.rangePickerHeaderForegroundColor) &&
      valueEquals(this.rangePickerHeaderHeadlineStyle, other.rangePickerHeaderHeadlineStyle) &&
      valueEquals(this.rangePickerHeaderHelpStyle, other.rangePickerHeaderHelpStyle) &&
      valueEquals(this.rangeSelectionBackgroundColor, other.rangeSelectionBackgroundColor) &&
      valueEquals(this.rangeSelectionOverlayColor, other.rangeSelectionOverlayColor) &&
      valueEquals(this.dividerColor, other.dividerColor) &&
      valueEquals(this.inputDecorationTheme, other.inputDecorationTheme) &&
      valueEquals(this.cancelButtonStyle, other.cancelButtonStyle) &&
      valueEquals(this.confirmButtonStyle, other.confirmButtonStyle) &&
      valueEquals(this.locale, other.locale) &&
      valueEquals(this.toggleButtonTextStyle, other.toggleButtonTextStyle) &&
      valueEquals(this.subHeaderForegroundColor, other.subHeaderForegroundColor);
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.backgroundColor,
      this.elevation,
      this.shadowColor,
      this.surfaceTintColor,
      this.shape,
      this.headerBackgroundColor,
      this.headerForegroundColor,
      this.headerHeadlineStyle,
      this.headerHelpStyle,
      this.weekdayStyle,
      this.dayStyle,
      this.dayForegroundColor,
      this.dayBackgroundColor,
      this.dayOverlayColor,
      this.dayShape,
      this.todayForegroundColor,
      this.todayBackgroundColor,
      this.todayBorder,
      this.yearStyle,
      this.yearForegroundColor,
      this.yearBackgroundColor,
      this.yearOverlayColor,
      this.yearShape,
      this.rangePickerBackgroundColor,
      this.rangePickerElevation,
      this.rangePickerShadowColor,
      this.rangePickerSurfaceTintColor,
      this.rangePickerShape,
      this.rangePickerHeaderBackgroundColor,
      this.rangePickerHeaderForegroundColor,
      this.rangePickerHeaderHeadlineStyle,
      this.rangePickerHeaderHelpStyle,
      this.rangeSelectionBackgroundColor,
      this.rangeSelectionOverlayColor,
      this.dividerColor,
      this.inputDecorationTheme,
      this.cancelButtonStyle,
      this.confirmButtonStyle,
      this.locale,
      this.toggleButtonTextStyle,
      this.subHeaderForegroundColor,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new ColorProperty("backgroundColor", this.backgroundColor, {defaultValue: null}));
    properties.add(new DoubleProperty("elevation", this.elevation, {defaultValue: null}));
    properties.add(new ColorProperty("shadowColor", this.shadowColor, {defaultValue: null}));
    properties.add(new ColorProperty("surfaceTintColor", this.surfaceTintColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("shape", this.shape, {defaultValue: null, typeName: "ShapeBorder"}));
    properties.add(new ColorProperty("headerBackgroundColor", this.headerBackgroundColor, {defaultValue: null}));
    properties.add(new ColorProperty("headerForegroundColor", this.headerForegroundColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("headerHeadlineStyle", this.headerHeadlineStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new DiagnosticsProperty("headerHelpStyle", this.headerHelpStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new DiagnosticsProperty("weekDayStyle", this.weekdayStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new DiagnosticsProperty("dayStyle", this.dayStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new DiagnosticsProperty("dayForegroundColor", this.dayForegroundColor, {defaultValue: null, typeName: "WidgetStateProperty<Color?>"}));
    properties.add(new DiagnosticsProperty("dayBackgroundColor", this.dayBackgroundColor, {defaultValue: null, typeName: "WidgetStateProperty<Color?>"}));
    properties.add(new DiagnosticsProperty("dayOverlayColor", this.dayOverlayColor, {defaultValue: null, typeName: "WidgetStateProperty<Color?>"}));
    properties.add(new DiagnosticsProperty("dayShape", this.dayShape, {defaultValue: null, typeName: "WidgetStateProperty<OutlinedBorder?>"}));
    properties.add(new DiagnosticsProperty("todayForegroundColor", this.todayForegroundColor, {defaultValue: null, typeName: "WidgetStateProperty<Color?>"}));
    properties.add(new DiagnosticsProperty("todayBackgroundColor", this.todayBackgroundColor, {defaultValue: null, typeName: "WidgetStateProperty<Color?>"}));
    properties.add(new DiagnosticsProperty("todayBorder", this.todayBorder, {defaultValue: null, typeName: "BorderSide?"}));
    properties.add(new DiagnosticsProperty("yearStyle", this.yearStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new DiagnosticsProperty("yearForegroundColor", this.yearForegroundColor, {defaultValue: null, typeName: "WidgetStateProperty<Color?>"}));
    properties.add(new DiagnosticsProperty("yearBackgroundColor", this.yearBackgroundColor, {defaultValue: null, typeName: "WidgetStateProperty<Color?>"}));
    properties.add(new DiagnosticsProperty("yearOverlayColor", this.yearOverlayColor, {defaultValue: null, typeName: "WidgetStateProperty<Color?>"}));
    properties.add(new DiagnosticsProperty("yearShape", this.yearShape, {defaultValue: null, typeName: "WidgetStateProperty<OutlinedBorder?>"}));
    properties.add(new ColorProperty("rangePickerBackgroundColor", this.rangePickerBackgroundColor, {defaultValue: null}));
    properties.add(new DoubleProperty("rangePickerElevation", this.rangePickerElevation, {defaultValue: null}));
    properties.add(new ColorProperty("rangePickerShadowColor", this.rangePickerShadowColor, {defaultValue: null}));
    properties.add(new ColorProperty("rangePickerSurfaceTintColor", this.rangePickerSurfaceTintColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("rangePickerShape", this.rangePickerShape, {defaultValue: null, typeName: "ShapeBorder"}));
    properties.add(new ColorProperty("rangePickerHeaderBackgroundColor", this.rangePickerHeaderBackgroundColor, {defaultValue: null}));
    properties.add(new ColorProperty("rangePickerHeaderForegroundColor", this.rangePickerHeaderForegroundColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("rangePickerHeaderHeadlineStyle", this.rangePickerHeaderHeadlineStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new DiagnosticsProperty("rangePickerHeaderHelpStyle", this.rangePickerHeaderHelpStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new ColorProperty("rangeSelectionBackgroundColor", this.rangeSelectionBackgroundColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("rangeSelectionOverlayColor", this.rangeSelectionOverlayColor, {defaultValue: null, typeName: "WidgetStateProperty<Color?>"}));
    properties.add(new ColorProperty("dividerColor", this.dividerColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("inputDecorationTheme", this.inputDecorationTheme, {defaultValue: null, typeName: "InputDecorationThemeData"}));
    properties.add(new DiagnosticsProperty("cancelButtonStyle", this.cancelButtonStyle, {defaultValue: null, typeName: "ButtonStyle"}));
    properties.add(new DiagnosticsProperty("confirmButtonStyle", this.confirmButtonStyle, {defaultValue: null, typeName: "ButtonStyle"}));
    properties.add(new DiagnosticsProperty("locale", this.locale, {defaultValue: null, typeName: "Locale"}));
    properties.add(new DiagnosticsProperty("toggleButtonTextStyle", this.toggleButtonTextStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new ColorProperty("subHeaderForegroundColor", this.subHeaderForegroundColor, {defaultValue: null}));
  }
}
