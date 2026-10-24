// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { Clip } from "@nelyx/core/ui/clip";
import { Color } from "@nelyx/core/ui/color";
import { ShapeBorder } from "@nelyx/core/framework/painting/borders";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty, EnumProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, valueHash, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface DrawerThemeDataOptions {
  readonly backgroundColor?: Color | null;
  readonly scrimColor?: Color | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly shape?: ShapeBorder | null;
  readonly endShape?: ShapeBorder | null;
  /** @dartType double? */
  readonly width?: number | null;
  readonly clipBehavior?: Clip | null;
}
export class DrawerThemeData extends Diagnosticable(class {}) {
  readonly backgroundColor: Color | null;
  readonly scrimColor: Color | null;
  /** @dartType double? */
  readonly elevation: number | null;
  readonly shadowColor: Color | null;
  readonly surfaceTintColor: Color | null;
  readonly shape: ShapeBorder | null;
  readonly endShape: ShapeBorder | null;
  /** @dartType double? */
  readonly width: number | null;
  readonly clipBehavior: Clip | null;
  /** @dartParam elevation double?
   * @dartParam width double? */
  constructor(options: DrawerThemeDataOptions = {}) {
    super();
    this.backgroundColor = options.backgroundColor ?? null;
    this.scrimColor = options.scrimColor ?? null;
    this.elevation = options.elevation ?? null;
    this.shadowColor = options.shadowColor ?? null;
    this.surfaceTintColor = options.surfaceTintColor ?? null;
    this.shape = options.shape ?? null;
    this.endShape = options.endShape ?? null;
    this.width = options.width ?? null;
    this.clipBehavior = options.clipBehavior ?? null;
    if (new.target === DrawerThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double?
   * @dartParam width double? */
  copyWith(options: DrawerThemeDataOptions = {}): DrawerThemeData {
    return new DrawerThemeData({
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      scrimColor: options.scrimColor ?? this.scrimColor,
      elevation: options.elevation ?? this.elevation,
      shadowColor: options.shadowColor ?? this.shadowColor,
      surfaceTintColor: options.surfaceTintColor ?? this.surfaceTintColor,
      shape: options.shape ?? this.shape,
      endShape: options.endShape ?? this.endShape,
      width: options.width ?? this.width,
      clipBehavior: options.clipBehavior ?? this.clipBehavior,
    });
  }
  /** @dartParam t double */
  static lerp(a: DrawerThemeData | null, b: DrawerThemeData | null, t: number): DrawerThemeData | null {
    if ((a === b)) {
    return a;
}
    return new DrawerThemeData({
      backgroundColor: Color.lerp((a?.backgroundColor ?? null), (b?.backgroundColor ?? null), t),
      scrimColor: Color.lerp((a?.scrimColor ?? null), (b?.scrimColor ?? null), t),
      elevation: lerpDouble((a?.elevation ?? null), (b?.elevation ?? null), t),
      shadowColor: Color.lerp((a?.shadowColor ?? null), (b?.shadowColor ?? null), t),
      surfaceTintColor: Color.lerp((a?.surfaceTintColor ?? null), (b?.surfaceTintColor ?? null), t),
      shape: ShapeBorder.lerp((a?.shape ?? null), (b?.shape ?? null), t),
      endShape: ShapeBorder.lerp((a?.endShape ?? null), (b?.endShape ?? null), t),
      width: lerpDouble((a?.width ?? null), (b?.width ?? null), t),
      clipBehavior: ((t < 0.5) ? (a?.clipBehavior ?? null) : (b?.clipBehavior ?? null)),
    });
}
  equals(other: unknown): boolean { return this === other || other instanceof DrawerThemeData && other.constructor === this.constructor && valueEquals(this.backgroundColor, other.backgroundColor) && valueEquals(this.scrimColor, other.scrimColor) && valueEquals(this.elevation, other.elevation) && valueEquals(this.shadowColor, other.shadowColor) && valueEquals(this.surfaceTintColor, other.surfaceTintColor) && valueEquals(this.shape, other.shape) && valueEquals(this.endShape, other.endShape) && valueEquals(this.width, other.width) && valueEquals(this.clipBehavior, other.clipBehavior); }
  /** @dartReturn int */
  get hashCode(): number { return hashValues(this.backgroundColor, this.scrimColor, this.elevation, this.shadowColor, this.surfaceTintColor, this.shape, this.endShape, this.width, this.clipBehavior); }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new ColorProperty("backgroundColor", this.backgroundColor, { defaultValue: null }));
    properties.add(new ColorProperty("scrimColor", this.scrimColor, { defaultValue: null }));
    properties.add(new DoubleProperty("elevation", this.elevation, { defaultValue: null }));
    properties.add(new ColorProperty("shadowColor", this.shadowColor, { defaultValue: null }));
    properties.add(new ColorProperty("surfaceTintColor", this.surfaceTintColor, { defaultValue: null }));
    properties.add(new DiagnosticsProperty("shape", this.shape, { defaultValue: null, typeName: "ShapeBorder" }));
    properties.add(new DiagnosticsProperty("endShape", this.endShape, { defaultValue: null, typeName: "ShapeBorder" }));
    properties.add(new DoubleProperty("width", this.width, { defaultValue: null }));
    properties.add(new DiagnosticsProperty("clipBehavior", this.clipBehavior, { defaultValue: null, typeName: "Clip" }));
  }
}
