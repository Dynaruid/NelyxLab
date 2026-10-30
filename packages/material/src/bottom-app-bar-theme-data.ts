// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Color } from "@nelyx/core/ui/color";
import { EdgeInsetsGeometry } from "@nelyx/core/framework/painting/edge-insets";
import type { NotchedShape } from "@nelyx/core/framework/painting/notched-shapes";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface BottomAppBarThemeDataOptions {
  readonly color?: Color | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly shape?: NotchedShape | null;
  /** @dartType double? */
  readonly height?: number | null;
  readonly surfaceTintColor?: Color | null;
  readonly shadowColor?: Color | null;
  readonly padding?: EdgeInsetsGeometry | null;
}
type Values = {readonly [K in keyof Required<BottomAppBarThemeDataOptions>]: Exclude<BottomAppBarThemeDataOptions[K], undefined>};
export class BottomAppBarThemeData extends Diagnosticable(class {}) {
  private readonly values: Values;
  get color(): Color | null { return this.values.color; }
  /** @dartType double? */
  get elevation(): number | null { return this.values.elevation; }
  get shape(): NotchedShape | null { return this.values.shape; }
  /** @dartType double? */
  get height(): number | null { return this.values.height; }
  get surfaceTintColor(): Color | null { return this.values.surfaceTintColor; }
  get shadowColor(): Color | null { return this.values.shadowColor; }
  get padding(): EdgeInsetsGeometry | null { return this.values.padding; }
  /** @dartParam elevation double?
   * @dartParam height double? */
  constructor(options: BottomAppBarThemeDataOptions = {}) {
    super();
    this.values = Object.freeze({
      color: options.color ?? null,
      elevation: options.elevation ?? null,
      shape: options.shape ?? null,
      height: options.height ?? null,
      surfaceTintColor: options.surfaceTintColor ?? null,
      shadowColor: options.shadowColor ?? null,
      padding: options.padding ?? null,
    });
    if (new.target === BottomAppBarThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double?
   * @dartParam height double? */
  copyWith(options: BottomAppBarThemeDataOptions = {}): BottomAppBarThemeData {
    return new BottomAppBarThemeData({
      color: options.color ?? this.color,
      elevation: options.elevation ?? this.elevation,
      shape: options.shape ?? this.shape,
      height: options.height ?? this.height,
      surfaceTintColor: options.surfaceTintColor ?? this.surfaceTintColor,
      shadowColor: options.shadowColor ?? this.shadowColor,
      padding: options.padding ?? this.padding,
    });
  }
  /** @dartParam t double */
  static lerp(a: BottomAppBarThemeData | null, b: BottomAppBarThemeData | null, t: number): BottomAppBarThemeData {
    if (((a === b) && (a !== null))) {
    return a;
  }
    return new BottomAppBarThemeData({
      color: Color.lerp((a?.color ?? null), (b?.color ?? null), t),
      elevation: lerpDouble((a?.elevation ?? null), (b?.elevation ?? null), t),
      shape: ((t < 0.5) ? (a?.shape ?? null) : (b?.shape ?? null)),
      height: lerpDouble((a?.height ?? null), (b?.height ?? null), t),
      surfaceTintColor: Color.lerp((a?.surfaceTintColor ?? null), (b?.surfaceTintColor ?? null), t),
      shadowColor: Color.lerp((a?.shadowColor ?? null), (b?.shadowColor ?? null), t),
      padding: EdgeInsetsGeometry.lerp((a?.padding ?? null), (b?.padding ?? null), t),
    });
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof BottomAppBarThemeData) || other.constructor !== this.constructor) return false;
    return valueEquals(this.color, other.color) &&
      valueEquals(this.elevation, other.elevation) &&
      valueEquals(this.shape, other.shape) &&
      valueEquals(this.height, other.height) &&
      valueEquals(this.surfaceTintColor, other.surfaceTintColor) &&
      valueEquals(this.shadowColor, other.shadowColor) &&
      valueEquals(this.padding, other.padding);
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.color,
      this.elevation,
      this.shape,
      this.height,
      this.surfaceTintColor,
      this.shadowColor,
      this.padding,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new ColorProperty("color", this.color, {defaultValue: null}));
    properties.add(new DoubleProperty("elevation", this.elevation, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("shape", this.shape, {defaultValue: null, typeName: "NotchedShape?"}));
    properties.add(new DoubleProperty("height", this.height, {defaultValue: null}));
    properties.add(new ColorProperty("surfaceTintColor", this.surfaceTintColor, {defaultValue: null}));
    properties.add(new ColorProperty("shadowColor", this.shadowColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("padding", this.padding, {defaultValue: null, typeName: "EdgeInsetsGeometry?"}));
  }
}
