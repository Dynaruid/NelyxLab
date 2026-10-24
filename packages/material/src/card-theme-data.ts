// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { Clip } from "@nelyx/core/ui/clip";
import { Color } from "@nelyx/core/ui/color";
import { EdgeInsetsGeometry } from "@nelyx/core/framework/painting/edge-insets";
import { ShapeBorder } from "@nelyx/core/framework/painting/borders";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty, EnumProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, valueHash, hashValues } from "@nelyx/core/framework/painting/value-equality";
import { invariant } from "@nelyx/core/foundation/errors";
export interface CardThemeDataOptions {
  readonly clipBehavior?: Clip | null;
  readonly color?: Color | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly margin?: EdgeInsetsGeometry | null;
  readonly shape?: ShapeBorder | null;
}
export class CardThemeData extends Diagnosticable(class {}) {
  readonly clipBehavior: Clip | null;
  readonly color: Color | null;
  readonly shadowColor: Color | null;
  readonly surfaceTintColor: Color | null;
  /** @dartType double? */
  readonly elevation: number | null;
  readonly margin: EdgeInsetsGeometry | null;
  readonly shape: ShapeBorder | null;
  /** @dartParam elevation double? */
  constructor(options: CardThemeDataOptions = {}) {
    super();
    invariant(options.elevation == null || options.elevation >= 0, 'invalid-card-elevation', 'Card elevation must be null or non-negative');
    this.clipBehavior = options.clipBehavior ?? null;
    this.color = options.color ?? null;
    this.shadowColor = options.shadowColor ?? null;
    this.surfaceTintColor = options.surfaceTintColor ?? null;
    this.elevation = options.elevation ?? null;
    this.margin = options.margin ?? null;
    this.shape = options.shape ?? null;
    if (new.target === CardThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double? */
  copyWith(options: CardThemeDataOptions = {}): CardThemeData {
    return new CardThemeData({
      clipBehavior: options.clipBehavior ?? this.clipBehavior,
      color: options.color ?? this.color,
      shadowColor: options.shadowColor ?? this.shadowColor,
      surfaceTintColor: options.surfaceTintColor ?? this.surfaceTintColor,
      elevation: options.elevation ?? this.elevation,
      margin: options.margin ?? this.margin,
      shape: options.shape ?? this.shape,
    });
  }
  /** @dartParam t double */
  static lerp(a: CardThemeData | null, b: CardThemeData | null, t: number): CardThemeData {
    if (((a === b) && (a !== null))) {
    return a;
}
    return new CardThemeData({
      clipBehavior: ((t < 0.5) ? (a?.clipBehavior ?? null) : (b?.clipBehavior ?? null)),
      color: Color.lerp((a?.color ?? null), (b?.color ?? null), t),
      shadowColor: Color.lerp((a?.shadowColor ?? null), (b?.shadowColor ?? null), t),
      surfaceTintColor: Color.lerp((a?.surfaceTintColor ?? null), (b?.surfaceTintColor ?? null), t),
      elevation: lerpDouble((a?.elevation ?? null), (b?.elevation ?? null), t),
      margin: EdgeInsetsGeometry.lerp((a?.margin ?? null), (b?.margin ?? null), t),
      shape: ShapeBorder.lerp((a?.shape ?? null), (b?.shape ?? null), t),
    });
}
  equals(other: unknown): boolean { return this === other || other instanceof CardThemeData && other.constructor === this.constructor && valueEquals(this.clipBehavior, other.clipBehavior) && valueEquals(this.color, other.color) && valueEquals(this.shadowColor, other.shadowColor) && valueEquals(this.surfaceTintColor, other.surfaceTintColor) && valueEquals(this.elevation, other.elevation) && valueEquals(this.margin, other.margin) && valueEquals(this.shape, other.shape); }
  /** @dartReturn int */
  get hashCode(): number { return hashValues(this.clipBehavior, this.color, this.shadowColor, this.surfaceTintColor, this.elevation, this.margin, this.shape); }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty("clipBehavior", this.clipBehavior, { defaultValue: null, typeName: "Clip" }));
    properties.add(new ColorProperty("color", this.color, { defaultValue: null }));
    properties.add(new ColorProperty("shadowColor", this.shadowColor, { defaultValue: null }));
    properties.add(new ColorProperty("surfaceTintColor", this.surfaceTintColor, { defaultValue: null }));
    properties.add(new DiagnosticsProperty("elevation", this.elevation, { defaultValue: null, typeName: "double" }));
    properties.add(new DiagnosticsProperty("margin", this.margin, { defaultValue: null, typeName: "EdgeInsetsGeometry" }));
    properties.add(new DiagnosticsProperty("shape", this.shape, { defaultValue: null, typeName: "ShapeBorder" }));
  }
}
