// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Color } from "@nelyx/core/ui/color";
import { IconThemeData } from "@nelyx/core/framework/widgets/icon-theme-data";
import { NavigationRailLabelType } from "./navigation-rail-label-type.ts";
import { ShapeBorder } from "@nelyx/core/framework/painting/borders";
import { TextStyle } from "@nelyx/core/framework/painting/text-style";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface NavigationRailThemeDataOptions {
  readonly backgroundColor?: Color | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly unselectedLabelTextStyle?: TextStyle | null;
  readonly selectedLabelTextStyle?: TextStyle | null;
  readonly unselectedIconTheme?: IconThemeData | null;
  readonly selectedIconTheme?: IconThemeData | null;
  /** @dartType double? */
  readonly groupAlignment?: number | null;
  readonly labelType?: NavigationRailLabelType | null;
  readonly useIndicator?: boolean | null;
  readonly indicatorColor?: Color | null;
  readonly indicatorShape?: ShapeBorder | null;
  /** @dartType double? */
  readonly minWidth?: number | null;
  /** @dartType double? */
  readonly minExtendedWidth?: number | null;
}
type Values = {readonly [K in keyof Required<NavigationRailThemeDataOptions>]: Exclude<NavigationRailThemeDataOptions[K], undefined>};
export class NavigationRailThemeData extends Diagnosticable(class {}) {
  private readonly values: Values;
  get backgroundColor(): Color | null { return this.values.backgroundColor; }
  /** @dartType double? */
  get elevation(): number | null { return this.values.elevation; }
  get unselectedLabelTextStyle(): TextStyle | null { return this.values.unselectedLabelTextStyle; }
  get selectedLabelTextStyle(): TextStyle | null { return this.values.selectedLabelTextStyle; }
  get unselectedIconTheme(): IconThemeData | null { return this.values.unselectedIconTheme; }
  get selectedIconTheme(): IconThemeData | null { return this.values.selectedIconTheme; }
  /** @dartType double? */
  get groupAlignment(): number | null { return this.values.groupAlignment; }
  get labelType(): NavigationRailLabelType | null { return this.values.labelType; }
  get useIndicator(): boolean | null { return this.values.useIndicator; }
  get indicatorColor(): Color | null { return this.values.indicatorColor; }
  get indicatorShape(): ShapeBorder | null { return this.values.indicatorShape; }
  /** @dartType double? */
  get minWidth(): number | null { return this.values.minWidth; }
  /** @dartType double? */
  get minExtendedWidth(): number | null { return this.values.minExtendedWidth; }
  /** @dartParam elevation double?
   * @dartParam groupAlignment double?
   * @dartParam minWidth double?
   * @dartParam minExtendedWidth double? */
  constructor(options: NavigationRailThemeDataOptions = {}) {
    super();
    this.values = Object.freeze({
      backgroundColor: options.backgroundColor ?? null,
      elevation: options.elevation ?? null,
      unselectedLabelTextStyle: options.unselectedLabelTextStyle ?? null,
      selectedLabelTextStyle: options.selectedLabelTextStyle ?? null,
      unselectedIconTheme: options.unselectedIconTheme ?? null,
      selectedIconTheme: options.selectedIconTheme ?? null,
      groupAlignment: options.groupAlignment ?? null,
      labelType: options.labelType ?? null,
      useIndicator: options.useIndicator ?? null,
      indicatorColor: options.indicatorColor ?? null,
      indicatorShape: options.indicatorShape ?? null,
      minWidth: options.minWidth ?? null,
      minExtendedWidth: options.minExtendedWidth ?? null,
    });
    if (this.labelType !== null && !NavigationRailLabelType.values.includes(this.labelType)) throw new TypeError("Expected a canonical NavigationRailLabelType");
    if (new.target === NavigationRailThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double?
   * @dartParam groupAlignment double?
   * @dartParam minWidth double?
   * @dartParam minExtendedWidth double? */
  copyWith(options: NavigationRailThemeDataOptions = {}): NavigationRailThemeData {
    return new NavigationRailThemeData({
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      elevation: options.elevation ?? this.elevation,
      unselectedLabelTextStyle: options.unselectedLabelTextStyle ?? this.unselectedLabelTextStyle,
      selectedLabelTextStyle: options.selectedLabelTextStyle ?? this.selectedLabelTextStyle,
      unselectedIconTheme: options.unselectedIconTheme ?? this.unselectedIconTheme,
      selectedIconTheme: options.selectedIconTheme ?? this.selectedIconTheme,
      groupAlignment: options.groupAlignment ?? this.groupAlignment,
      labelType: options.labelType ?? this.labelType,
      useIndicator: options.useIndicator ?? this.useIndicator,
      indicatorColor: options.indicatorColor ?? this.indicatorColor,
      indicatorShape: options.indicatorShape ?? this.indicatorShape,
      minWidth: options.minWidth ?? this.minWidth,
      minExtendedWidth: options.minExtendedWidth ?? this.minExtendedWidth,
    });
  }
  /** @dartParam t double */
  static lerp(a: NavigationRailThemeData | null, b: NavigationRailThemeData | null, t: number): NavigationRailThemeData | null {
    if ((a === b)) {
    return a;
  }
    return new NavigationRailThemeData({
      backgroundColor: Color.lerp((a?.backgroundColor ?? null), (b?.backgroundColor ?? null), t),
      elevation: lerpDouble((a?.elevation ?? null), (b?.elevation ?? null), t),
      unselectedLabelTextStyle: TextStyle.lerp((a?.unselectedLabelTextStyle ?? null), (b?.unselectedLabelTextStyle ?? null), t),
      selectedLabelTextStyle: TextStyle.lerp((a?.selectedLabelTextStyle ?? null), (b?.selectedLabelTextStyle ?? null), t),
      unselectedIconTheme: ((((a?.unselectedIconTheme ?? null) === null) && ((b?.unselectedIconTheme ?? null) === null)) ? null : IconThemeData.lerp((a?.unselectedIconTheme ?? null), (b?.unselectedIconTheme ?? null), t)),
      selectedIconTheme: ((((a?.selectedIconTheme ?? null) === null) && ((b?.selectedIconTheme ?? null) === null)) ? null : IconThemeData.lerp((a?.selectedIconTheme ?? null), (b?.selectedIconTheme ?? null), t)),
      groupAlignment: lerpDouble((a?.groupAlignment ?? null), (b?.groupAlignment ?? null), t),
      labelType: ((t < 0.5) ? (a?.labelType ?? null) : (b?.labelType ?? null)),
      useIndicator: ((t < 0.5) ? (a?.useIndicator ?? null) : (b?.useIndicator ?? null)),
      indicatorColor: Color.lerp((a?.indicatorColor ?? null), (b?.indicatorColor ?? null), t),
      indicatorShape: ShapeBorder.lerp((a?.indicatorShape ?? null), (b?.indicatorShape ?? null), t),
      minWidth: lerpDouble((a?.minWidth ?? null), (b?.minWidth ?? null), t),
      minExtendedWidth: lerpDouble((a?.minExtendedWidth ?? null), (b?.minExtendedWidth ?? null), t),
    });
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof NavigationRailThemeData) || other.constructor !== this.constructor) return false;
    return valueEquals(this.backgroundColor, other.backgroundColor) &&
      valueEquals(this.elevation, other.elevation) &&
      valueEquals(this.unselectedLabelTextStyle, other.unselectedLabelTextStyle) &&
      valueEquals(this.selectedLabelTextStyle, other.selectedLabelTextStyle) &&
      valueEquals(this.unselectedIconTheme, other.unselectedIconTheme) &&
      valueEquals(this.selectedIconTheme, other.selectedIconTheme) &&
      valueEquals(this.groupAlignment, other.groupAlignment) &&
      valueEquals(this.labelType, other.labelType) &&
      valueEquals(this.useIndicator, other.useIndicator) &&
      valueEquals(this.indicatorColor, other.indicatorColor) &&
      valueEquals(this.indicatorShape, other.indicatorShape) &&
      valueEquals(this.minWidth, other.minWidth) &&
      valueEquals(this.minExtendedWidth, other.minExtendedWidth);
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.backgroundColor,
      this.elevation,
      this.unselectedLabelTextStyle,
      this.selectedLabelTextStyle,
      this.unselectedIconTheme,
      this.selectedIconTheme,
      this.groupAlignment,
      this.labelType,
      this.useIndicator,
      this.indicatorColor,
      this.indicatorShape,
      this.minWidth,
      this.minExtendedWidth,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new ColorProperty("backgroundColor", this.backgroundColor, {defaultValue: null}));
    properties.add(new DoubleProperty("elevation", this.elevation, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("unselectedLabelTextStyle", this.unselectedLabelTextStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new DiagnosticsProperty("selectedLabelTextStyle", this.selectedLabelTextStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new DiagnosticsProperty("unselectedIconTheme", this.unselectedIconTheme, {defaultValue: null, typeName: "IconThemeData"}));
    properties.add(new DiagnosticsProperty("selectedIconTheme", this.selectedIconTheme, {defaultValue: null, typeName: "IconThemeData"}));
    properties.add(new DoubleProperty("groupAlignment", this.groupAlignment, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("labelType", this.labelType, {defaultValue: null, typeName: "NavigationRailLabelType"}));
    properties.add(new DiagnosticsProperty("useIndicator", this.useIndicator, {defaultValue: null, typeName: "bool"}));
    properties.add(new ColorProperty("indicatorColor", this.indicatorColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("indicatorShape", this.indicatorShape, {defaultValue: null, typeName: "ShapeBorder"}));
    properties.add(new DoubleProperty("minWidth", this.minWidth, {defaultValue: null}));
    properties.add(new DoubleProperty("minExtendedWidth", this.minExtendedWidth, {defaultValue: null}));
  }
}
