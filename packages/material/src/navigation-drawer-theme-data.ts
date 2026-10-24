// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Color } from "@nelyx/core/ui/color";
import { IconThemeData } from "@nelyx/core/framework/widgets/icon-theme-data";
import { ShapeBorder } from "@nelyx/core/framework/painting/borders";
import { Size } from "@nelyx/core/ui/size";
import { TextStyle } from "@nelyx/core/framework/painting/text-style";
import { WidgetStateProperty } from "@nelyx/core/framework/widgets/widget-state";
import { lerpTextStyleProperty, lerpIconThemeDataProperty } from "./internal/theme/value-interpolation.ts";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty, EnumProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, valueHash, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface NavigationDrawerThemeDataOptions {
  /** @dartType double? */
  readonly tileHeight?: number | null;
  readonly backgroundColor?: Color | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly indicatorColor?: Color | null;
  readonly indicatorShape?: ShapeBorder | null;
  readonly indicatorSize?: Size | null;
  readonly labelTextStyle?: WidgetStateProperty<TextStyle | null> | null;
  readonly iconTheme?: WidgetStateProperty<IconThemeData | null> | null;
}
export class NavigationDrawerThemeData extends Diagnosticable(class {}) {
  /** @dartType double? */
  readonly tileHeight: number | null;
  readonly backgroundColor: Color | null;
  /** @dartType double? */
  readonly elevation: number | null;
  readonly shadowColor: Color | null;
  readonly surfaceTintColor: Color | null;
  readonly indicatorColor: Color | null;
  readonly indicatorShape: ShapeBorder | null;
  readonly indicatorSize: Size | null;
  readonly labelTextStyle: WidgetStateProperty<TextStyle | null> | null;
  readonly iconTheme: WidgetStateProperty<IconThemeData | null> | null;
  /** @dartParam tileHeight double?
   * @dartParam elevation double? */
  constructor(options: NavigationDrawerThemeDataOptions = {}) {
    super();
    this.tileHeight = options.tileHeight ?? null;
    this.backgroundColor = options.backgroundColor ?? null;
    this.elevation = options.elevation ?? null;
    this.shadowColor = options.shadowColor ?? null;
    this.surfaceTintColor = options.surfaceTintColor ?? null;
    this.indicatorColor = options.indicatorColor ?? null;
    this.indicatorShape = options.indicatorShape ?? null;
    this.indicatorSize = options.indicatorSize ?? null;
    this.labelTextStyle = options.labelTextStyle ?? null;
    this.iconTheme = options.iconTheme ?? null;
    if (new.target === NavigationDrawerThemeData) Object.freeze(this);
  }
  /** @dartParam tileHeight double?
   * @dartParam elevation double? */
  copyWith(options: NavigationDrawerThemeDataOptions = {}): NavigationDrawerThemeData {
    return new NavigationDrawerThemeData({
      tileHeight: options.tileHeight ?? this.tileHeight,
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      elevation: options.elevation ?? this.elevation,
      shadowColor: options.shadowColor ?? this.shadowColor,
      surfaceTintColor: options.surfaceTintColor ?? this.surfaceTintColor,
      indicatorColor: options.indicatorColor ?? this.indicatorColor,
      indicatorShape: options.indicatorShape ?? this.indicatorShape,
      indicatorSize: options.indicatorSize ?? this.indicatorSize,
      labelTextStyle: options.labelTextStyle ?? this.labelTextStyle,
      iconTheme: options.iconTheme ?? this.iconTheme,
    });
  }
  /** @dartParam t double */
  static lerp(a: NavigationDrawerThemeData | null, b: NavigationDrawerThemeData | null, t: number): NavigationDrawerThemeData | null {
    if ((a === b)) {
    return a;
}
    return new NavigationDrawerThemeData({
      tileHeight: lerpDouble((a?.tileHeight ?? null), (b?.tileHeight ?? null), t),
      backgroundColor: Color.lerp((a?.backgroundColor ?? null), (b?.backgroundColor ?? null), t),
      elevation: lerpDouble((a?.elevation ?? null), (b?.elevation ?? null), t),
      shadowColor: Color.lerp((a?.shadowColor ?? null), (b?.shadowColor ?? null), t),
      surfaceTintColor: Color.lerp((a?.surfaceTintColor ?? null), (b?.surfaceTintColor ?? null), t),
      indicatorColor: Color.lerp((a?.indicatorColor ?? null), (b?.indicatorColor ?? null), t),
      indicatorShape: ShapeBorder.lerp((a?.indicatorShape ?? null), (b?.indicatorShape ?? null), t),
      indicatorSize: Size.lerp((a?.indicatorSize ?? null), (a?.indicatorSize ?? null), t),
      labelTextStyle: lerpTextStyleProperty((a?.labelTextStyle ?? null), (b?.labelTextStyle ?? null), t),
      iconTheme: lerpIconThemeDataProperty((a?.iconTheme ?? null), (b?.iconTheme ?? null), t),
    });
}
  equals(other: unknown): boolean { return this === other || other instanceof NavigationDrawerThemeData && other.constructor === this.constructor && valueEquals(this.tileHeight, other.tileHeight) && valueEquals(this.backgroundColor, other.backgroundColor) && valueEquals(this.elevation, other.elevation) && valueEquals(this.shadowColor, other.shadowColor) && valueEquals(this.surfaceTintColor, other.surfaceTintColor) && valueEquals(this.indicatorColor, other.indicatorColor) && valueEquals(this.indicatorShape, other.indicatorShape) && valueEquals(this.indicatorSize, other.indicatorSize) && valueEquals(this.labelTextStyle, other.labelTextStyle) && valueEquals(this.iconTheme, other.iconTheme); }
  /** @dartReturn int */
  get hashCode(): number { return hashValues(this.tileHeight, this.backgroundColor, this.elevation, this.shadowColor, this.surfaceTintColor, this.indicatorColor, this.indicatorShape, this.indicatorSize, this.labelTextStyle, this.iconTheme); }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DoubleProperty("tileHeight", this.tileHeight, { defaultValue: null }));
    properties.add(new ColorProperty("backgroundColor", this.backgroundColor, { defaultValue: null }));
    properties.add(new DoubleProperty("elevation", this.elevation, { defaultValue: null }));
    properties.add(new ColorProperty("shadowColor", this.shadowColor, { defaultValue: null }));
    properties.add(new ColorProperty("surfaceTintColor", this.surfaceTintColor, { defaultValue: null }));
    properties.add(new ColorProperty("indicatorColor", this.indicatorColor, { defaultValue: null }));
    properties.add(new DiagnosticsProperty("indicatorShape", this.indicatorShape, { defaultValue: null, typeName: "ShapeBorder" }));
    properties.add(new DiagnosticsProperty("indicatorSize", this.indicatorSize, { defaultValue: null, typeName: "Size" }));
    properties.add(new DiagnosticsProperty("labelTextStyle", this.labelTextStyle, { defaultValue: null, typeName: "WidgetStateProperty<TextStyle?>" }));
    properties.add(new DiagnosticsProperty("iconTheme", this.iconTheme, { defaultValue: null, typeName: "WidgetStateProperty<IconThemeData?>" }));
  }
}
