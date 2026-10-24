// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { BoxConstraints } from "@nelyx/core/framework/rendering/constraints";
import { Color } from "@nelyx/core/ui/color";
import { EdgeInsetsGeometry } from "@nelyx/core/framework/painting/edge-insets";
import type { MouseCursor } from "@nelyx/core/services/mouse-cursor";
import { ShapeBorder } from "@nelyx/core/framework/painting/borders";
import { TextStyle } from "@nelyx/core/framework/painting/text-style";
import { WidgetStateProperty } from "@nelyx/core/framework/widgets/widget-state";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty, EnumProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, valueHash, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface FloatingActionButtonThemeDataOptions {
  readonly foregroundColor?: Color | null;
  readonly backgroundColor?: Color | null;
  readonly focusColor?: Color | null;
  readonly hoverColor?: Color | null;
  readonly splashColor?: Color | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  /** @dartType double? */
  readonly focusElevation?: number | null;
  /** @dartType double? */
  readonly hoverElevation?: number | null;
  /** @dartType double? */
  readonly disabledElevation?: number | null;
  /** @dartType double? */
  readonly highlightElevation?: number | null;
  readonly shape?: ShapeBorder | null;
  readonly enableFeedback?: boolean | null;
  /** @dartType double? */
  readonly iconSize?: number | null;
  readonly sizeConstraints?: BoxConstraints | null;
  readonly smallSizeConstraints?: BoxConstraints | null;
  readonly largeSizeConstraints?: BoxConstraints | null;
  readonly extendedSizeConstraints?: BoxConstraints | null;
  /** @dartType double? */
  readonly extendedIconLabelSpacing?: number | null;
  readonly extendedPadding?: EdgeInsetsGeometry | null;
  readonly extendedTextStyle?: TextStyle | null;
  readonly mouseCursor?: WidgetStateProperty<MouseCursor | null> | null;
}
export class FloatingActionButtonThemeData extends Diagnosticable(class {}) {
  readonly foregroundColor: Color | null;
  readonly backgroundColor: Color | null;
  readonly focusColor: Color | null;
  readonly hoverColor: Color | null;
  readonly splashColor: Color | null;
  /** @dartType double? */
  readonly elevation: number | null;
  /** @dartType double? */
  readonly focusElevation: number | null;
  /** @dartType double? */
  readonly hoverElevation: number | null;
  /** @dartType double? */
  readonly disabledElevation: number | null;
  /** @dartType double? */
  readonly highlightElevation: number | null;
  readonly shape: ShapeBorder | null;
  readonly enableFeedback: boolean | null;
  /** @dartType double? */
  readonly iconSize: number | null;
  readonly sizeConstraints: BoxConstraints | null;
  readonly smallSizeConstraints: BoxConstraints | null;
  readonly largeSizeConstraints: BoxConstraints | null;
  readonly extendedSizeConstraints: BoxConstraints | null;
  /** @dartType double? */
  readonly extendedIconLabelSpacing: number | null;
  readonly extendedPadding: EdgeInsetsGeometry | null;
  readonly extendedTextStyle: TextStyle | null;
  readonly mouseCursor: WidgetStateProperty<MouseCursor | null> | null;
  /** @dartParam elevation double?
   * @dartParam focusElevation double?
   * @dartParam hoverElevation double?
   * @dartParam disabledElevation double?
   * @dartParam highlightElevation double?
   * @dartParam iconSize double?
   * @dartParam extendedIconLabelSpacing double? */
  constructor(options: FloatingActionButtonThemeDataOptions = {}) {
    super();
    this.foregroundColor = options.foregroundColor ?? null;
    this.backgroundColor = options.backgroundColor ?? null;
    this.focusColor = options.focusColor ?? null;
    this.hoverColor = options.hoverColor ?? null;
    this.splashColor = options.splashColor ?? null;
    this.elevation = options.elevation ?? null;
    this.focusElevation = options.focusElevation ?? null;
    this.hoverElevation = options.hoverElevation ?? null;
    this.disabledElevation = options.disabledElevation ?? null;
    this.highlightElevation = options.highlightElevation ?? null;
    this.shape = options.shape ?? null;
    this.enableFeedback = options.enableFeedback ?? null;
    this.iconSize = options.iconSize ?? null;
    this.sizeConstraints = options.sizeConstraints ?? null;
    this.smallSizeConstraints = options.smallSizeConstraints ?? null;
    this.largeSizeConstraints = options.largeSizeConstraints ?? null;
    this.extendedSizeConstraints = options.extendedSizeConstraints ?? null;
    this.extendedIconLabelSpacing = options.extendedIconLabelSpacing ?? null;
    this.extendedPadding = options.extendedPadding ?? null;
    this.extendedTextStyle = options.extendedTextStyle ?? null;
    this.mouseCursor = options.mouseCursor ?? null;
    if (new.target === FloatingActionButtonThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double?
   * @dartParam focusElevation double?
   * @dartParam hoverElevation double?
   * @dartParam disabledElevation double?
   * @dartParam highlightElevation double?
   * @dartParam iconSize double?
   * @dartParam extendedIconLabelSpacing double? */
  copyWith(options: FloatingActionButtonThemeDataOptions = {}): FloatingActionButtonThemeData {
    return new FloatingActionButtonThemeData({
      foregroundColor: options.foregroundColor ?? this.foregroundColor,
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      focusColor: options.focusColor ?? this.focusColor,
      hoverColor: options.hoverColor ?? this.hoverColor,
      splashColor: options.splashColor ?? this.splashColor,
      elevation: options.elevation ?? this.elevation,
      focusElevation: options.focusElevation ?? this.focusElevation,
      hoverElevation: options.hoverElevation ?? this.hoverElevation,
      disabledElevation: options.disabledElevation ?? this.disabledElevation,
      highlightElevation: options.highlightElevation ?? this.highlightElevation,
      shape: options.shape ?? this.shape,
      enableFeedback: options.enableFeedback ?? this.enableFeedback,
      iconSize: options.iconSize ?? this.iconSize,
      sizeConstraints: options.sizeConstraints ?? this.sizeConstraints,
      smallSizeConstraints: options.smallSizeConstraints ?? this.smallSizeConstraints,
      largeSizeConstraints: options.largeSizeConstraints ?? this.largeSizeConstraints,
      extendedSizeConstraints: options.extendedSizeConstraints ?? this.extendedSizeConstraints,
      extendedIconLabelSpacing: options.extendedIconLabelSpacing ?? this.extendedIconLabelSpacing,
      extendedPadding: options.extendedPadding ?? this.extendedPadding,
      extendedTextStyle: options.extendedTextStyle ?? this.extendedTextStyle,
      mouseCursor: options.mouseCursor ?? this.mouseCursor,
    });
  }
  /** @dartParam t double */
  static lerp(a: FloatingActionButtonThemeData | null, b: FloatingActionButtonThemeData | null, t: number): FloatingActionButtonThemeData | null {
    if ((a === b)) {
    return a;
}
    return new FloatingActionButtonThemeData({
      foregroundColor: Color.lerp((a?.foregroundColor ?? null), (b?.foregroundColor ?? null), t),
      backgroundColor: Color.lerp((a?.backgroundColor ?? null), (b?.backgroundColor ?? null), t),
      focusColor: Color.lerp((a?.focusColor ?? null), (b?.focusColor ?? null), t),
      hoverColor: Color.lerp((a?.hoverColor ?? null), (b?.hoverColor ?? null), t),
      splashColor: Color.lerp((a?.splashColor ?? null), (b?.splashColor ?? null), t),
      elevation: lerpDouble((a?.elevation ?? null), (b?.elevation ?? null), t),
      focusElevation: lerpDouble((a?.focusElevation ?? null), (b?.focusElevation ?? null), t),
      hoverElevation: lerpDouble((a?.hoverElevation ?? null), (b?.hoverElevation ?? null), t),
      disabledElevation: lerpDouble((a?.disabledElevation ?? null), (b?.disabledElevation ?? null), t),
      highlightElevation: lerpDouble((a?.highlightElevation ?? null), (b?.highlightElevation ?? null), t),
      shape: ShapeBorder.lerp((a?.shape ?? null), (b?.shape ?? null), t),
      enableFeedback: ((t < 0.5) ? (a?.enableFeedback ?? null) : (b?.enableFeedback ?? null)),
      iconSize: lerpDouble((a?.iconSize ?? null), (b?.iconSize ?? null), t),
      sizeConstraints: BoxConstraints.lerp((a?.sizeConstraints ?? null), (b?.sizeConstraints ?? null), t),
      smallSizeConstraints: BoxConstraints.lerp((a?.smallSizeConstraints ?? null), (b?.smallSizeConstraints ?? null), t),
      largeSizeConstraints: BoxConstraints.lerp((a?.largeSizeConstraints ?? null), (b?.largeSizeConstraints ?? null), t),
      extendedSizeConstraints: BoxConstraints.lerp((a?.extendedSizeConstraints ?? null), (b?.extendedSizeConstraints ?? null), t),
      extendedIconLabelSpacing: lerpDouble((a?.extendedIconLabelSpacing ?? null), (b?.extendedIconLabelSpacing ?? null), t),
      extendedPadding: EdgeInsetsGeometry.lerp((a?.extendedPadding ?? null), (b?.extendedPadding ?? null), t),
      extendedTextStyle: TextStyle.lerp((a?.extendedTextStyle ?? null), (b?.extendedTextStyle ?? null), t),
      mouseCursor: ((t < 0.5) ? (a?.mouseCursor ?? null) : (b?.mouseCursor ?? null)),
    });
}
  equals(other: unknown): boolean { return this === other || other instanceof FloatingActionButtonThemeData && other.constructor === this.constructor && valueEquals(this.foregroundColor, other.foregroundColor) && valueEquals(this.backgroundColor, other.backgroundColor) && valueEquals(this.focusColor, other.focusColor) && valueEquals(this.hoverColor, other.hoverColor) && valueEquals(this.splashColor, other.splashColor) && valueEquals(this.elevation, other.elevation) && valueEquals(this.focusElevation, other.focusElevation) && valueEquals(this.hoverElevation, other.hoverElevation) && valueEquals(this.disabledElevation, other.disabledElevation) && valueEquals(this.highlightElevation, other.highlightElevation) && valueEquals(this.shape, other.shape) && valueEquals(this.enableFeedback, other.enableFeedback) && valueEquals(this.iconSize, other.iconSize) && valueEquals(this.sizeConstraints, other.sizeConstraints) && valueEquals(this.smallSizeConstraints, other.smallSizeConstraints) && valueEquals(this.largeSizeConstraints, other.largeSizeConstraints) && valueEquals(this.extendedSizeConstraints, other.extendedSizeConstraints) && valueEquals(this.extendedIconLabelSpacing, other.extendedIconLabelSpacing) && valueEquals(this.extendedPadding, other.extendedPadding) && valueEquals(this.extendedTextStyle, other.extendedTextStyle) && valueEquals(this.mouseCursor, other.mouseCursor); }
  /** @dartReturn int */
  get hashCode(): number { return hashValues(this.foregroundColor, this.backgroundColor, this.focusColor, this.hoverColor, this.splashColor, this.elevation, this.focusElevation, this.hoverElevation, this.disabledElevation, this.highlightElevation, this.shape, this.enableFeedback, this.iconSize, this.sizeConstraints, this.smallSizeConstraints, this.largeSizeConstraints, this.extendedSizeConstraints, this.extendedIconLabelSpacing, this.extendedPadding, this.extendedTextStyle, this.mouseCursor); }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new ColorProperty("foregroundColor", this.foregroundColor, { defaultValue: null }));
    properties.add(new ColorProperty("backgroundColor", this.backgroundColor, { defaultValue: null }));
    properties.add(new ColorProperty("focusColor", this.focusColor, { defaultValue: null }));
    properties.add(new ColorProperty("hoverColor", this.hoverColor, { defaultValue: null }));
    properties.add(new ColorProperty("splashColor", this.splashColor, { defaultValue: null }));
    properties.add(new DoubleProperty("elevation", this.elevation, { defaultValue: null }));
    properties.add(new DoubleProperty("focusElevation", this.focusElevation, { defaultValue: null }));
    properties.add(new DoubleProperty("hoverElevation", this.hoverElevation, { defaultValue: null }));
    properties.add(new DoubleProperty("disabledElevation", this.disabledElevation, { defaultValue: null }));
    properties.add(new DoubleProperty("highlightElevation", this.highlightElevation, { defaultValue: null }));
    properties.add(new DiagnosticsProperty("shape", this.shape, { defaultValue: null, typeName: "ShapeBorder" }));
    properties.add(new DiagnosticsProperty("enableFeedback", this.enableFeedback, { defaultValue: null, typeName: "bool" }));
    properties.add(new DoubleProperty("iconSize", this.iconSize, { defaultValue: null }));
    properties.add(new DiagnosticsProperty("sizeConstraints", this.sizeConstraints, { defaultValue: null, typeName: "BoxConstraints" }));
    properties.add(new DiagnosticsProperty("smallSizeConstraints", this.smallSizeConstraints, { defaultValue: null, typeName: "BoxConstraints" }));
    properties.add(new DiagnosticsProperty("largeSizeConstraints", this.largeSizeConstraints, { defaultValue: null, typeName: "BoxConstraints" }));
    properties.add(new DiagnosticsProperty("extendedSizeConstraints", this.extendedSizeConstraints, { defaultValue: null, typeName: "BoxConstraints" }));
    properties.add(new DoubleProperty("extendedIconLabelSpacing", this.extendedIconLabelSpacing, { defaultValue: null }));
    properties.add(new DiagnosticsProperty("extendedPadding", this.extendedPadding, { defaultValue: null, typeName: "EdgeInsetsGeometry" }));
    properties.add(new DiagnosticsProperty("extendedTextStyle", this.extendedTextStyle, { defaultValue: null, typeName: "TextStyle" }));
    properties.add(new DiagnosticsProperty("mouseCursor", this.mouseCursor, { defaultValue: null, typeName: "WidgetStateProperty<MouseCursor?>" }));
  }
}
