// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Color } from "@nelyx/core/ui/color";
import { EdgeInsetsGeometry } from "@nelyx/core/framework/painting/edge-insets";
import { IconThemeData } from "@nelyx/core/framework/widgets/icon-theme-data";
import { NavigationDestinationLabelBehavior } from "./navigation-destination-label-behavior.ts";
import { ShapeBorder } from "@nelyx/core/framework/painting/borders";
import { TextStyle } from "@nelyx/core/framework/painting/text-style";
import { WidgetStateProperty } from "@nelyx/core/framework/widgets/widget-state";
import { lerpTextStyleProperty, lerpIconThemeDataProperty, lerpColorProperty } from "./internal/theme/value-interpolation.ts";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty, EnumProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, valueHash, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface NavigationBarThemeDataOptions {
  /** @dartType double? */
  readonly height?: number | null;
  readonly backgroundColor?: Color | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly indicatorColor?: Color | null;
  readonly indicatorShape?: ShapeBorder | null;
  readonly labelTextStyle?: WidgetStateProperty<TextStyle | null> | null;
  readonly iconTheme?: WidgetStateProperty<IconThemeData | null> | null;
  readonly labelBehavior?: NavigationDestinationLabelBehavior | null;
  readonly overlayColor?: WidgetStateProperty<Color | null> | null;
  readonly labelPadding?: EdgeInsetsGeometry | null;
}
export class NavigationBarThemeData extends Diagnosticable(class {}) {
  /** @dartType double? */
  readonly height: number | null;
  readonly backgroundColor: Color | null;
  /** @dartType double? */
  readonly elevation: number | null;
  readonly shadowColor: Color | null;
  readonly surfaceTintColor: Color | null;
  readonly indicatorColor: Color | null;
  readonly indicatorShape: ShapeBorder | null;
  readonly labelTextStyle: WidgetStateProperty<TextStyle | null> | null;
  readonly iconTheme: WidgetStateProperty<IconThemeData | null> | null;
  readonly labelBehavior: NavigationDestinationLabelBehavior | null;
  readonly overlayColor: WidgetStateProperty<Color | null> | null;
  readonly labelPadding: EdgeInsetsGeometry | null;
  /** @dartParam height double?
   * @dartParam elevation double? */
  constructor(options: NavigationBarThemeDataOptions = {}) {
    super();
    this.height = options.height ?? null;
    this.backgroundColor = options.backgroundColor ?? null;
    this.elevation = options.elevation ?? null;
    this.shadowColor = options.shadowColor ?? null;
    this.surfaceTintColor = options.surfaceTintColor ?? null;
    this.indicatorColor = options.indicatorColor ?? null;
    this.indicatorShape = options.indicatorShape ?? null;
    this.labelTextStyle = options.labelTextStyle ?? null;
    this.iconTheme = options.iconTheme ?? null;
    this.labelBehavior = options.labelBehavior ?? null;
    this.overlayColor = options.overlayColor ?? null;
    this.labelPadding = options.labelPadding ?? null;
    if (new.target === NavigationBarThemeData) Object.freeze(this);
  }
  /** @dartParam height double?
   * @dartParam elevation double? */
  copyWith(options: NavigationBarThemeDataOptions = {}): NavigationBarThemeData {
    return new NavigationBarThemeData({
      height: options.height ?? this.height,
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      elevation: options.elevation ?? this.elevation,
      shadowColor: options.shadowColor ?? this.shadowColor,
      surfaceTintColor: options.surfaceTintColor ?? this.surfaceTintColor,
      indicatorColor: options.indicatorColor ?? this.indicatorColor,
      indicatorShape: options.indicatorShape ?? this.indicatorShape,
      labelTextStyle: options.labelTextStyle ?? this.labelTextStyle,
      iconTheme: options.iconTheme ?? this.iconTheme,
      labelBehavior: options.labelBehavior ?? this.labelBehavior,
      overlayColor: options.overlayColor ?? this.overlayColor,
      labelPadding: options.labelPadding ?? this.labelPadding,
    });
  }
  /** @dartParam t double */
  static lerp(a: NavigationBarThemeData | null, b: NavigationBarThemeData | null, t: number): NavigationBarThemeData | null {
    if ((a === b)) {
    return a;
}
    return new NavigationBarThemeData({
      height: lerpDouble((a?.height ?? null), (b?.height ?? null), t),
      backgroundColor: Color.lerp((a?.backgroundColor ?? null), (b?.backgroundColor ?? null), t),
      elevation: lerpDouble((a?.elevation ?? null), (b?.elevation ?? null), t),
      shadowColor: Color.lerp((a?.shadowColor ?? null), (b?.shadowColor ?? null), t),
      surfaceTintColor: Color.lerp((a?.surfaceTintColor ?? null), (b?.surfaceTintColor ?? null), t),
      indicatorColor: Color.lerp((a?.indicatorColor ?? null), (b?.indicatorColor ?? null), t),
      indicatorShape: ShapeBorder.lerp((a?.indicatorShape ?? null), (b?.indicatorShape ?? null), t),
      labelTextStyle: lerpTextStyleProperty((a?.labelTextStyle ?? null), (b?.labelTextStyle ?? null), t),
      iconTheme: lerpIconThemeDataProperty((a?.iconTheme ?? null), (b?.iconTheme ?? null), t),
      labelBehavior: ((t < 0.5) ? (a?.labelBehavior ?? null) : (b?.labelBehavior ?? null)),
      overlayColor: lerpColorProperty((a?.overlayColor ?? null), (b?.overlayColor ?? null), t),
      labelPadding: EdgeInsetsGeometry.lerp((a?.labelPadding ?? null), (b?.labelPadding ?? null), t),
    });
}
  equals(other: unknown): boolean { return this === other || other instanceof NavigationBarThemeData && other.constructor === this.constructor && valueEquals(this.height, other.height) && valueEquals(this.backgroundColor, other.backgroundColor) && valueEquals(this.elevation, other.elevation) && valueEquals(this.shadowColor, other.shadowColor) && valueEquals(this.surfaceTintColor, other.surfaceTintColor) && valueEquals(this.indicatorColor, other.indicatorColor) && valueEquals(this.indicatorShape, other.indicatorShape) && valueEquals(this.labelTextStyle, other.labelTextStyle) && valueEquals(this.iconTheme, other.iconTheme) && valueEquals(this.labelBehavior, other.labelBehavior) && valueEquals(this.overlayColor, other.overlayColor) && valueEquals(this.labelPadding, other.labelPadding); }
  /** @dartReturn int */
  get hashCode(): number { return hashValues(this.height, this.backgroundColor, this.elevation, this.shadowColor, this.surfaceTintColor, this.indicatorColor, this.indicatorShape, this.labelTextStyle, this.iconTheme, this.labelBehavior, this.overlayColor, this.labelPadding); }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DoubleProperty("height", this.height, { defaultValue: null }));
    properties.add(new ColorProperty("backgroundColor", this.backgroundColor, { defaultValue: null }));
    properties.add(new DoubleProperty("elevation", this.elevation, { defaultValue: null }));
    properties.add(new ColorProperty("shadowColor", this.shadowColor, { defaultValue: null }));
    properties.add(new ColorProperty("surfaceTintColor", this.surfaceTintColor, { defaultValue: null }));
    properties.add(new ColorProperty("indicatorColor", this.indicatorColor, { defaultValue: null }));
    properties.add(new DiagnosticsProperty("indicatorShape", this.indicatorShape, { defaultValue: null, typeName: "ShapeBorder" }));
    properties.add(new DiagnosticsProperty("labelTextStyle", this.labelTextStyle, { defaultValue: null, typeName: "WidgetStateProperty<TextStyle?>" }));
    properties.add(new DiagnosticsProperty("iconTheme", this.iconTheme, { defaultValue: null, typeName: "WidgetStateProperty<IconThemeData?>" }));
    properties.add(new DiagnosticsProperty("labelBehavior", this.labelBehavior, { defaultValue: null, typeName: "NavigationDestinationLabelBehavior" }));
    properties.add(new DiagnosticsProperty("overlayColor", this.overlayColor, { defaultValue: null, typeName: "WidgetStateProperty<Color?>" }));
    properties.add(new DiagnosticsProperty("labelPadding", this.labelPadding, { defaultValue: null, typeName: "EdgeInsetsGeometry" }));
  }
}
