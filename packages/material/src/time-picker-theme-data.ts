// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { BorderSide } from "@nelyx/core/framework/painting/borders";
import { ButtonStyle } from "./button-style.ts";
import { Color } from "@nelyx/core/ui/color";
import { EdgeInsetsGeometry } from "@nelyx/core/framework/painting/edge-insets";
import { InputDecorationThemeData } from "./input-decoration-theme-data.ts";
import { OutlinedBorder } from "@nelyx/core/framework/painting/borders";
import { ShapeBorder } from "@nelyx/core/framework/painting/borders";
import { TextStyle } from "@nelyx/core/framework/painting/text-style";
import { WidgetStateProperty } from "@nelyx/core/framework/widgets/widget-state";
import { checkedOutlinedBorder, lerpColorProperty, lerpTextStyleProperty } from "./internal/theme/value-interpolation.ts";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, hashValues } from "@nelyx/core/framework/painting/value-equality";
import { WidgetStateColor, WidgetState } from "@nelyx/core/framework/widgets/widget-state";
import { Colors } from "./colors.ts";
export interface TimePickerThemeDataOptions {
  readonly backgroundColor?: Color | null;
  readonly cancelButtonStyle?: ButtonStyle | null;
  readonly confirmButtonStyle?: ButtonStyle | null;
  readonly dayPeriodBorderSide?: BorderSide | null;
  readonly dayPeriodColor?: Color | null;
  readonly dayPeriodShape?: OutlinedBorder | null;
  readonly dayPeriodTextColor?: Color | null;
  readonly dayPeriodTextStyle?: TextStyle | null;
  readonly dialBackgroundColor?: Color | null;
  readonly dialHandColor?: Color | null;
  readonly dialTextColor?: Color | null;
  readonly dialTextStyle?: TextStyle | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly entryModeIconColor?: Color | null;
  readonly helpTextStyle?: TextStyle | null;
  readonly hourMinuteColor?: Color | null;
  readonly hourMinuteShape?: ShapeBorder | null;
  readonly hourMinuteTextColor?: Color | null;
  readonly hourMinuteTextStyle?: TextStyle | null;
  readonly inputDecorationTheme?: InputDecorationThemeData | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly shape?: ShapeBorder | null;
  readonly timeSelectorSeparatorColor?: WidgetStateProperty<Color | null> | null;
  readonly timeSelectorSeparatorTextStyle?: WidgetStateProperty<TextStyle | null> | null;
}
type Values = {readonly [K in keyof Required<TimePickerThemeDataOptions>]: Exclude<TimePickerThemeDataOptions[K], undefined>};
export class TimePickerThemeData extends Diagnosticable(class {}) {
  private readonly values: Values;
  get backgroundColor(): Color | null { return this.values.backgroundColor; }
  get cancelButtonStyle(): ButtonStyle | null { return this.values.cancelButtonStyle; }
  get confirmButtonStyle(): ButtonStyle | null { return this.values.confirmButtonStyle; }
  get dayPeriodBorderSide(): BorderSide | null { return this.values.dayPeriodBorderSide; }
  get dayPeriodColor(): Color | null {
    const value = this.values.dayPeriodColor;
    if (value === null || value instanceof WidgetStateColor) return value;
    return WidgetStateColor.resolveWith(states => states.contains(WidgetState.selected) ? value : Colors.transparent);
  }
  get dayPeriodShape(): OutlinedBorder | null { return this.values.dayPeriodShape; }
  get dayPeriodTextColor(): Color | null { return this.values.dayPeriodTextColor; }
  get dayPeriodTextStyle(): TextStyle | null { return this.values.dayPeriodTextStyle; }
  get dialBackgroundColor(): Color | null { return this.values.dialBackgroundColor; }
  get dialHandColor(): Color | null { return this.values.dialHandColor; }
  get dialTextColor(): Color | null { return this.values.dialTextColor; }
  get dialTextStyle(): TextStyle | null { return this.values.dialTextStyle; }
  /** @dartType double? */
  get elevation(): number | null { return this.values.elevation; }
  get entryModeIconColor(): Color | null { return this.values.entryModeIconColor; }
  get helpTextStyle(): TextStyle | null { return this.values.helpTextStyle; }
  get hourMinuteColor(): Color | null { return this.values.hourMinuteColor; }
  get hourMinuteShape(): ShapeBorder | null { return this.values.hourMinuteShape; }
  get hourMinuteTextColor(): Color | null { return this.values.hourMinuteTextColor; }
  get hourMinuteTextStyle(): TextStyle | null { return this.values.hourMinuteTextStyle; }
  get inputDecorationTheme(): InputDecorationThemeData | null { return this.values.inputDecorationTheme; }
  get padding(): EdgeInsetsGeometry | null { return this.values.padding; }
  get shape(): ShapeBorder | null { return this.values.shape; }
  get timeSelectorSeparatorColor(): WidgetStateProperty<Color | null> | null { return this.values.timeSelectorSeparatorColor; }
  get timeSelectorSeparatorTextStyle(): WidgetStateProperty<TextStyle | null> | null { return this.values.timeSelectorSeparatorTextStyle; }
  /** @dartParam elevation double? */
  constructor(options: TimePickerThemeDataOptions = {}) {
    super();
    this.values = Object.freeze({
      backgroundColor: options.backgroundColor ?? null,
      cancelButtonStyle: options.cancelButtonStyle ?? null,
      confirmButtonStyle: options.confirmButtonStyle ?? null,
      dayPeriodBorderSide: options.dayPeriodBorderSide ?? null,
      dayPeriodColor: options.dayPeriodColor ?? null,
      dayPeriodShape: options.dayPeriodShape ?? null,
      dayPeriodTextColor: options.dayPeriodTextColor ?? null,
      dayPeriodTextStyle: options.dayPeriodTextStyle ?? null,
      dialBackgroundColor: options.dialBackgroundColor ?? null,
      dialHandColor: options.dialHandColor ?? null,
      dialTextColor: options.dialTextColor ?? null,
      dialTextStyle: options.dialTextStyle ?? null,
      elevation: options.elevation ?? null,
      entryModeIconColor: options.entryModeIconColor ?? null,
      helpTextStyle: options.helpTextStyle ?? null,
      hourMinuteColor: options.hourMinuteColor ?? null,
      hourMinuteShape: options.hourMinuteShape ?? null,
      hourMinuteTextColor: options.hourMinuteTextColor ?? null,
      hourMinuteTextStyle: options.hourMinuteTextStyle ?? null,
      inputDecorationTheme: options.inputDecorationTheme ?? null,
      padding: options.padding ?? null,
      shape: options.shape ?? null,
      timeSelectorSeparatorColor: options.timeSelectorSeparatorColor ?? null,
      timeSelectorSeparatorTextStyle: options.timeSelectorSeparatorTextStyle ?? null,
    });
    if (this.inputDecorationTheme !== null && !(this.inputDecorationTheme instanceof InputDecorationThemeData)) throw new TypeError("Use modern InputDecorationThemeData values");
    if (new.target === TimePickerThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double? */
  copyWith(options: TimePickerThemeDataOptions = {}): TimePickerThemeData {
    return new TimePickerThemeData({
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      cancelButtonStyle: options.cancelButtonStyle ?? this.cancelButtonStyle,
      confirmButtonStyle: options.confirmButtonStyle ?? this.confirmButtonStyle,
      dayPeriodBorderSide: options.dayPeriodBorderSide ?? this.dayPeriodBorderSide,
      dayPeriodColor: options.dayPeriodColor ?? this.dayPeriodColor,
      dayPeriodShape: options.dayPeriodShape ?? this.dayPeriodShape,
      dayPeriodTextColor: options.dayPeriodTextColor ?? this.dayPeriodTextColor,
      dayPeriodTextStyle: options.dayPeriodTextStyle ?? this.dayPeriodTextStyle,
      dialBackgroundColor: options.dialBackgroundColor ?? this.dialBackgroundColor,
      dialHandColor: options.dialHandColor ?? this.dialHandColor,
      dialTextColor: options.dialTextColor ?? this.dialTextColor,
      dialTextStyle: options.dialTextStyle ?? this.dialTextStyle,
      elevation: options.elevation ?? this.elevation,
      entryModeIconColor: options.entryModeIconColor ?? this.entryModeIconColor,
      helpTextStyle: options.helpTextStyle ?? this.helpTextStyle,
      hourMinuteColor: options.hourMinuteColor ?? this.hourMinuteColor,
      hourMinuteShape: options.hourMinuteShape ?? this.hourMinuteShape,
      hourMinuteTextColor: options.hourMinuteTextColor ?? this.hourMinuteTextColor,
      hourMinuteTextStyle: options.hourMinuteTextStyle ?? this.hourMinuteTextStyle,
      inputDecorationTheme: options.inputDecorationTheme ?? this.inputDecorationTheme,
      padding: options.padding ?? this.padding,
      shape: options.shape ?? this.shape,
      timeSelectorSeparatorColor: options.timeSelectorSeparatorColor ?? this.timeSelectorSeparatorColor,
      timeSelectorSeparatorTextStyle: options.timeSelectorSeparatorTextStyle ?? this.timeSelectorSeparatorTextStyle,
    });
  }
  /** @dartParam t double */
  static lerp(a: TimePickerThemeData | null, b: TimePickerThemeData | null, t: number): TimePickerThemeData {
    if (((a === b) && (a !== null))) {
    return a;
  }
    let lerpedBorderSide: BorderSide | null;
    if ((((a?.dayPeriodBorderSide ?? null) === null) && ((b?.dayPeriodBorderSide ?? null) === null))) {
    lerpedBorderSide = null;
  } else     if (((a?.dayPeriodBorderSide ?? null) === null)) {
    lerpedBorderSide = (b?.dayPeriodBorderSide ?? null);
  } else     if (((b?.dayPeriodBorderSide ?? null) === null)) {
    lerpedBorderSide = (a?.dayPeriodBorderSide ?? null);
  } else {
    lerpedBorderSide = BorderSide.lerp(((a)!.dayPeriodBorderSide)!, ((b)!.dayPeriodBorderSide)!, t);
  }
    return new TimePickerThemeData({
      backgroundColor: Color.lerp((a?.backgroundColor ?? null), (b?.backgroundColor ?? null), t),
      cancelButtonStyle: ButtonStyle.lerp((a?.cancelButtonStyle ?? null), (b?.cancelButtonStyle ?? null), t),
      confirmButtonStyle: ButtonStyle.lerp((a?.confirmButtonStyle ?? null), (b?.confirmButtonStyle ?? null), t),
      dayPeriodBorderSide: lerpedBorderSide,
      dayPeriodColor: Color.lerp((a?.dayPeriodColor ?? null), (b?.dayPeriodColor ?? null), t),
      dayPeriodShape: checkedOutlinedBorder(ShapeBorder.lerp((a?.dayPeriodShape ?? null), (b?.dayPeriodShape ?? null), t)),
      dayPeriodTextColor: Color.lerp((a?.dayPeriodTextColor ?? null), (b?.dayPeriodTextColor ?? null), t),
      dayPeriodTextStyle: TextStyle.lerp((a?.dayPeriodTextStyle ?? null), (b?.dayPeriodTextStyle ?? null), t),
      dialBackgroundColor: Color.lerp((a?.dialBackgroundColor ?? null), (b?.dialBackgroundColor ?? null), t),
      dialHandColor: Color.lerp((a?.dialHandColor ?? null), (b?.dialHandColor ?? null), t),
      dialTextColor: Color.lerp((a?.dialTextColor ?? null), (b?.dialTextColor ?? null), t),
      dialTextStyle: TextStyle.lerp((a?.dialTextStyle ?? null), (b?.dialTextStyle ?? null), t),
      elevation: lerpDouble((a?.elevation ?? null), (b?.elevation ?? null), t),
      entryModeIconColor: Color.lerp((a?.entryModeIconColor ?? null), (b?.entryModeIconColor ?? null), t),
      helpTextStyle: TextStyle.lerp((a?.helpTextStyle ?? null), (b?.helpTextStyle ?? null), t),
      hourMinuteColor: Color.lerp((a?.hourMinuteColor ?? null), (b?.hourMinuteColor ?? null), t),
      hourMinuteShape: ShapeBorder.lerp((a?.hourMinuteShape ?? null), (b?.hourMinuteShape ?? null), t),
      hourMinuteTextColor: Color.lerp((a?.hourMinuteTextColor ?? null), (b?.hourMinuteTextColor ?? null), t),
      hourMinuteTextStyle: TextStyle.lerp((a?.hourMinuteTextStyle ?? null), (b?.hourMinuteTextStyle ?? null), t),
      inputDecorationTheme: ((t < 0.5) ? (a?.inputDecorationTheme ?? null) : (b?.inputDecorationTheme ?? null)),
      padding: EdgeInsetsGeometry.lerp((a?.padding ?? null), (b?.padding ?? null), t),
      shape: ShapeBorder.lerp((a?.shape ?? null), (b?.shape ?? null), t),
      timeSelectorSeparatorColor: lerpColorProperty((a?.timeSelectorSeparatorColor ?? null), (b?.timeSelectorSeparatorColor ?? null), t),
      timeSelectorSeparatorTextStyle: lerpTextStyleProperty((a?.timeSelectorSeparatorTextStyle ?? null), (b?.timeSelectorSeparatorTextStyle ?? null), t),
    });
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof TimePickerThemeData) || other.constructor !== this.constructor) return false;
    return valueEquals(this.backgroundColor, other.backgroundColor) &&
      valueEquals(this.cancelButtonStyle, other.cancelButtonStyle) &&
      valueEquals(this.confirmButtonStyle, other.confirmButtonStyle) &&
      valueEquals(this.dayPeriodBorderSide, other.dayPeriodBorderSide) &&
      valueEquals(this.dayPeriodColor, other.dayPeriodColor) &&
      valueEquals(this.dayPeriodShape, other.dayPeriodShape) &&
      valueEquals(this.dayPeriodTextColor, other.dayPeriodTextColor) &&
      valueEquals(this.dayPeriodTextStyle, other.dayPeriodTextStyle) &&
      valueEquals(this.dialBackgroundColor, other.dialBackgroundColor) &&
      valueEquals(this.dialHandColor, other.dialHandColor) &&
      valueEquals(this.dialTextColor, other.dialTextColor) &&
      valueEquals(this.dialTextStyle, other.dialTextStyle) &&
      valueEquals(this.elevation, other.elevation) &&
      valueEquals(this.entryModeIconColor, other.entryModeIconColor) &&
      valueEquals(this.helpTextStyle, other.helpTextStyle) &&
      valueEquals(this.hourMinuteColor, other.hourMinuteColor) &&
      valueEquals(this.hourMinuteShape, other.hourMinuteShape) &&
      valueEquals(this.hourMinuteTextColor, other.hourMinuteTextColor) &&
      valueEquals(this.hourMinuteTextStyle, other.hourMinuteTextStyle) &&
      valueEquals(this.inputDecorationTheme, other.inputDecorationTheme) &&
      valueEquals(this.padding, other.padding) &&
      valueEquals(this.shape, other.shape) &&
      valueEquals(this.timeSelectorSeparatorColor, other.timeSelectorSeparatorColor) &&
      valueEquals(this.timeSelectorSeparatorTextStyle, other.timeSelectorSeparatorTextStyle);
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.backgroundColor,
      this.cancelButtonStyle,
      this.confirmButtonStyle,
      this.dayPeriodBorderSide,
      this.dayPeriodColor,
      this.dayPeriodShape,
      this.dayPeriodTextColor,
      this.dayPeriodTextStyle,
      this.dialBackgroundColor,
      this.dialHandColor,
      this.dialTextColor,
      this.dialTextStyle,
      this.elevation,
      this.entryModeIconColor,
      this.helpTextStyle,
      this.hourMinuteColor,
      this.hourMinuteShape,
      this.hourMinuteTextColor,
      this.hourMinuteTextStyle,
      this.inputDecorationTheme,
      this.padding,
      this.shape,
      this.timeSelectorSeparatorColor,
      this.timeSelectorSeparatorTextStyle,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new ColorProperty("backgroundColor", this.backgroundColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("cancelButtonStyle", this.cancelButtonStyle, {defaultValue: null, typeName: "ButtonStyle"}));
    properties.add(new DiagnosticsProperty("confirmButtonStyle", this.confirmButtonStyle, {defaultValue: null, typeName: "ButtonStyle"}));
    properties.add(new DiagnosticsProperty("dayPeriodBorderSide", this.dayPeriodBorderSide, {defaultValue: null, typeName: "BorderSide"}));
    properties.add(new ColorProperty("dayPeriodColor", this.dayPeriodColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("dayPeriodShape", this.dayPeriodShape, {defaultValue: null, typeName: "ShapeBorder"}));
    properties.add(new ColorProperty("dayPeriodTextColor", this.dayPeriodTextColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("dayPeriodTextStyle", this.dayPeriodTextStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new ColorProperty("dialBackgroundColor", this.dialBackgroundColor, {defaultValue: null}));
    properties.add(new ColorProperty("dialHandColor", this.dialHandColor, {defaultValue: null}));
    properties.add(new ColorProperty("dialTextColor", this.dialTextColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("dialTextStyle", this.dialTextStyle, {defaultValue: null, typeName: "TextStyle?"}));
    properties.add(new DoubleProperty("elevation", this.elevation, {defaultValue: null}));
    properties.add(new ColorProperty("entryModeIconColor", this.entryModeIconColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("helpTextStyle", this.helpTextStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new ColorProperty("hourMinuteColor", this.hourMinuteColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("hourMinuteShape", this.hourMinuteShape, {defaultValue: null, typeName: "ShapeBorder"}));
    properties.add(new ColorProperty("hourMinuteTextColor", this.hourMinuteTextColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("hourMinuteTextStyle", this.hourMinuteTextStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new DiagnosticsProperty("inputDecorationTheme", this.inputDecorationTheme, {defaultValue: null, typeName: "InputDecorationThemeData"}));
    properties.add(new DiagnosticsProperty("padding", this.padding, {defaultValue: null, typeName: "EdgeInsetsGeometry"}));
    properties.add(new DiagnosticsProperty("shape", this.shape, {defaultValue: null, typeName: "ShapeBorder"}));
    properties.add(new DiagnosticsProperty("timeSelectorSeparatorColor", this.timeSelectorSeparatorColor, {defaultValue: null, typeName: "WidgetStateProperty<Color?>"}));
    properties.add(new DiagnosticsProperty("timeSelectorSeparatorTextStyle", this.timeSelectorSeparatorTextStyle, {defaultValue: null, typeName: "WidgetStateProperty<TextStyle?>"}));
  }
}
