// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { BoxConstraints } from "@nelyx/core/framework/rendering/constraints";
import type { Clip } from "@nelyx/core/ui/clip";
import { Color } from "@nelyx/core/ui/color";
import { ShapeBorder } from "@nelyx/core/framework/painting/borders";
import { Size } from "@nelyx/core/ui/size";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty, EnumProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface BottomSheetThemeDataOptions {
  readonly backgroundColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly modalBackgroundColor?: Color | null;
  readonly modalBarrierColor?: Color | null;
  readonly shadowColor?: Color | null;
  /** @dartType double? */
  readonly modalElevation?: number | null;
  readonly shape?: ShapeBorder | null;
  readonly showDragHandle?: boolean | null;
  readonly dragHandleColor?: Color | null;
  readonly dragHandleSize?: Size | null;
  readonly clipBehavior?: Clip | null;
  readonly constraints?: BoxConstraints | null;
}
type Values = {readonly [K in keyof Required<BottomSheetThemeDataOptions>]: Exclude<BottomSheetThemeDataOptions[K], undefined>};
export class BottomSheetThemeData extends Diagnosticable(class {}) {
  private readonly values: Values;
  get backgroundColor(): Color | null { return this.values.backgroundColor; }
  get surfaceTintColor(): Color | null { return this.values.surfaceTintColor; }
  /** @dartType double? */
  get elevation(): number | null { return this.values.elevation; }
  get modalBackgroundColor(): Color | null { return this.values.modalBackgroundColor; }
  get modalBarrierColor(): Color | null { return this.values.modalBarrierColor; }
  get shadowColor(): Color | null { return this.values.shadowColor; }
  /** @dartType double? */
  get modalElevation(): number | null { return this.values.modalElevation; }
  get shape(): ShapeBorder | null { return this.values.shape; }
  get showDragHandle(): boolean | null { return this.values.showDragHandle; }
  get dragHandleColor(): Color | null { return this.values.dragHandleColor; }
  get dragHandleSize(): Size | null { return this.values.dragHandleSize; }
  get clipBehavior(): Clip | null { return this.values.clipBehavior; }
  get constraints(): BoxConstraints | null { return this.values.constraints; }
  /** @dartParam elevation double?
   * @dartParam modalElevation double? */
  constructor(options: BottomSheetThemeDataOptions = {}) {
    super();
    this.values = Object.freeze({
      backgroundColor: options.backgroundColor ?? null,
      surfaceTintColor: options.surfaceTintColor ?? null,
      elevation: options.elevation ?? null,
      modalBackgroundColor: options.modalBackgroundColor ?? null,
      modalBarrierColor: options.modalBarrierColor ?? null,
      shadowColor: options.shadowColor ?? null,
      modalElevation: options.modalElevation ?? null,
      shape: options.shape ?? null,
      showDragHandle: options.showDragHandle ?? null,
      dragHandleColor: options.dragHandleColor ?? null,
      dragHandleSize: options.dragHandleSize ?? null,
      clipBehavior: options.clipBehavior ?? null,
      constraints: options.constraints ?? null,
    });
    if (new.target === BottomSheetThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double?
   * @dartParam modalElevation double? */
  copyWith(options: BottomSheetThemeDataOptions = {}): BottomSheetThemeData {
    return new BottomSheetThemeData({
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      surfaceTintColor: options.surfaceTintColor ?? this.surfaceTintColor,
      elevation: options.elevation ?? this.elevation,
      modalBackgroundColor: options.modalBackgroundColor ?? this.modalBackgroundColor,
      modalBarrierColor: options.modalBarrierColor ?? this.modalBarrierColor,
      shadowColor: options.shadowColor ?? this.shadowColor,
      modalElevation: options.modalElevation ?? this.modalElevation,
      shape: options.shape ?? this.shape,
      showDragHandle: options.showDragHandle ?? this.showDragHandle,
      dragHandleColor: options.dragHandleColor ?? this.dragHandleColor,
      dragHandleSize: options.dragHandleSize ?? this.dragHandleSize,
      clipBehavior: options.clipBehavior ?? this.clipBehavior,
      constraints: options.constraints ?? this.constraints,
    });
  }
  /** @dartParam t double */
  static lerp(a: BottomSheetThemeData | null, b: BottomSheetThemeData | null, t: number): BottomSheetThemeData | null {
    if ((a === b)) {
    return a;
  }
    return new BottomSheetThemeData({
      backgroundColor: Color.lerp((a?.backgroundColor ?? null), (b?.backgroundColor ?? null), t),
      surfaceTintColor: Color.lerp((a?.surfaceTintColor ?? null), (b?.surfaceTintColor ?? null), t),
      elevation: lerpDouble((a?.elevation ?? null), (b?.elevation ?? null), t),
      modalBackgroundColor: Color.lerp((a?.modalBackgroundColor ?? null), (b?.modalBackgroundColor ?? null), t),
      modalBarrierColor: Color.lerp((a?.modalBarrierColor ?? null), (b?.modalBarrierColor ?? null), t),
      shadowColor: Color.lerp((a?.shadowColor ?? null), (b?.shadowColor ?? null), t),
      modalElevation: lerpDouble((a?.modalElevation ?? null), (b?.modalElevation ?? null), t),
      shape: ShapeBorder.lerp((a?.shape ?? null), (b?.shape ?? null), t),
      showDragHandle: ((t < 0.5) ? (a?.showDragHandle ?? null) : (b?.showDragHandle ?? null)),
      dragHandleColor: Color.lerp((a?.dragHandleColor ?? null), (b?.dragHandleColor ?? null), t),
      dragHandleSize: Size.lerp((a?.dragHandleSize ?? null), (b?.dragHandleSize ?? null), t),
      clipBehavior: ((t < 0.5) ? (a?.clipBehavior ?? null) : (b?.clipBehavior ?? null)),
      constraints: BoxConstraints.lerp((a?.constraints ?? null), (b?.constraints ?? null), t),
    });
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof BottomSheetThemeData) || other.constructor !== this.constructor) return false;
    return valueEquals(this.backgroundColor, other.backgroundColor) &&
      valueEquals(this.surfaceTintColor, other.surfaceTintColor) &&
      valueEquals(this.elevation, other.elevation) &&
      valueEquals(this.modalBackgroundColor, other.modalBackgroundColor) &&
      valueEquals(this.modalBarrierColor, other.modalBarrierColor) &&
      valueEquals(this.shadowColor, other.shadowColor) &&
      valueEquals(this.modalElevation, other.modalElevation) &&
      valueEquals(this.shape, other.shape) &&
      valueEquals(this.showDragHandle, other.showDragHandle) &&
      valueEquals(this.dragHandleColor, other.dragHandleColor) &&
      valueEquals(this.dragHandleSize, other.dragHandleSize) &&
      valueEquals(this.clipBehavior, other.clipBehavior) &&
      valueEquals(this.constraints, other.constraints);
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.backgroundColor,
      this.surfaceTintColor,
      this.elevation,
      this.modalBackgroundColor,
      this.modalBarrierColor,
      this.shadowColor,
      this.modalElevation,
      this.shape,
      this.showDragHandle,
      this.dragHandleColor,
      this.dragHandleSize,
      this.clipBehavior,
      this.constraints,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new ColorProperty("backgroundColor", this.backgroundColor, {defaultValue: null}));
    properties.add(new ColorProperty("surfaceTintColor", this.surfaceTintColor, {defaultValue: null}));
    properties.add(new DoubleProperty("elevation", this.elevation, {defaultValue: null}));
    properties.add(new ColorProperty("modalBackgroundColor", this.modalBackgroundColor, {defaultValue: null}));
    properties.add(new ColorProperty("shadowColor", this.shadowColor, {defaultValue: null}));
    properties.add(new ColorProperty("modalBarrierColor", this.modalBarrierColor, {defaultValue: null}));
    properties.add(new DoubleProperty("modalElevation", this.modalElevation, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("shape", this.shape, {defaultValue: null, typeName: "ShapeBorder"}));
    properties.add(new DiagnosticsProperty("showDragHandle", this.showDragHandle, {defaultValue: null, typeName: "bool"}));
    properties.add(new ColorProperty("dragHandleColor", this.dragHandleColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("dragHandleSize", this.dragHandleSize, {defaultValue: null, typeName: "Size"}));
    properties.add(new DiagnosticsProperty("clipBehavior", this.clipBehavior, {defaultValue: null, typeName: "Clip"}));
    properties.add(new DiagnosticsProperty("constraints", this.constraints, {defaultValue: null, typeName: "BoxConstraints"}));
  }
}
