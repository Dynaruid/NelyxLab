// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { BorderRadius } from "@nelyx/core/framework/painting/border-radius";
import { BoxConstraints } from "@nelyx/core/framework/rendering/constraints";
import { Color } from "@nelyx/core/ui/color";
import { TextStyle } from "@nelyx/core/framework/painting/text-style";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty, EnumProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface ToggleButtonsThemeDataOptions {
  readonly textStyle?: TextStyle | null;
  readonly constraints?: BoxConstraints | null;
  readonly color?: Color | null;
  readonly selectedColor?: Color | null;
  readonly disabledColor?: Color | null;
  readonly fillColor?: Color | null;
  readonly focusColor?: Color | null;
  readonly highlightColor?: Color | null;
  readonly splashColor?: Color | null;
  readonly hoverColor?: Color | null;
  readonly borderColor?: Color | null;
  readonly selectedBorderColor?: Color | null;
  readonly disabledBorderColor?: Color | null;
  /** @dartType double? */
  readonly borderWidth?: number | null;
  readonly borderRadius?: BorderRadius | null;
}
type Values = {readonly [K in keyof Required<ToggleButtonsThemeDataOptions>]: Exclude<ToggleButtonsThemeDataOptions[K], undefined>};
export class ToggleButtonsThemeData extends Diagnosticable(class {}) {
  private readonly values: Values;
  get textStyle(): TextStyle | null { return this.values.textStyle; }
  get constraints(): BoxConstraints | null { return this.values.constraints; }
  get color(): Color | null { return this.values.color; }
  get selectedColor(): Color | null { return this.values.selectedColor; }
  get disabledColor(): Color | null { return this.values.disabledColor; }
  get fillColor(): Color | null { return this.values.fillColor; }
  get focusColor(): Color | null { return this.values.focusColor; }
  get highlightColor(): Color | null { return this.values.highlightColor; }
  get splashColor(): Color | null { return this.values.splashColor; }
  get hoverColor(): Color | null { return this.values.hoverColor; }
  get borderColor(): Color | null { return this.values.borderColor; }
  get selectedBorderColor(): Color | null { return this.values.selectedBorderColor; }
  get disabledBorderColor(): Color | null { return this.values.disabledBorderColor; }
  /** @dartType double? */
  get borderWidth(): number | null { return this.values.borderWidth; }
  get borderRadius(): BorderRadius | null { return this.values.borderRadius; }
  /** @dartParam borderWidth double? */
  constructor(options: ToggleButtonsThemeDataOptions = {}) {
    super();
    this.values = Object.freeze({
      textStyle: options.textStyle ?? null,
      constraints: options.constraints ?? null,
      color: options.color ?? null,
      selectedColor: options.selectedColor ?? null,
      disabledColor: options.disabledColor ?? null,
      fillColor: options.fillColor ?? null,
      focusColor: options.focusColor ?? null,
      highlightColor: options.highlightColor ?? null,
      splashColor: options.splashColor ?? null,
      hoverColor: options.hoverColor ?? null,
      borderColor: options.borderColor ?? null,
      selectedBorderColor: options.selectedBorderColor ?? null,
      disabledBorderColor: options.disabledBorderColor ?? null,
      borderWidth: options.borderWidth ?? null,
      borderRadius: options.borderRadius ?? null,
    });
    if (new.target === ToggleButtonsThemeData) Object.freeze(this);
  }
  /** @dartParam borderWidth double? */
  copyWith(options: ToggleButtonsThemeDataOptions = {}): ToggleButtonsThemeData {
    return new ToggleButtonsThemeData({
      textStyle: options.textStyle ?? this.textStyle,
      constraints: options.constraints ?? this.constraints,
      color: options.color ?? this.color,
      selectedColor: options.selectedColor ?? this.selectedColor,
      disabledColor: options.disabledColor ?? this.disabledColor,
      fillColor: options.fillColor ?? this.fillColor,
      focusColor: options.focusColor ?? this.focusColor,
      highlightColor: options.highlightColor ?? this.highlightColor,
      hoverColor: options.hoverColor ?? this.hoverColor,
      splashColor: options.splashColor ?? this.splashColor,
      borderColor: options.borderColor ?? this.borderColor,
      selectedBorderColor: options.selectedBorderColor ?? this.selectedBorderColor,
      disabledBorderColor: options.disabledBorderColor ?? this.disabledBorderColor,
      borderRadius: options.borderRadius ?? this.borderRadius,
      borderWidth: options.borderWidth ?? this.borderWidth,
    });
  }
  /** @dartParam t double */
  static lerp(a: ToggleButtonsThemeData | null, b: ToggleButtonsThemeData | null, t: number): ToggleButtonsThemeData | null {
    if ((a === b)) {
    return a;
  }
    return new ToggleButtonsThemeData({
      textStyle: TextStyle.lerp((a?.textStyle ?? null), (b?.textStyle ?? null), t),
      constraints: BoxConstraints.lerp((a?.constraints ?? null), (b?.constraints ?? null), t),
      color: Color.lerp((a?.color ?? null), (b?.color ?? null), t),
      selectedColor: Color.lerp((a?.selectedColor ?? null), (b?.selectedColor ?? null), t),
      disabledColor: Color.lerp((a?.disabledColor ?? null), (b?.disabledColor ?? null), t),
      fillColor: Color.lerp((a?.fillColor ?? null), (b?.fillColor ?? null), t),
      focusColor: Color.lerp((a?.focusColor ?? null), (b?.focusColor ?? null), t),
      highlightColor: Color.lerp((a?.highlightColor ?? null), (b?.highlightColor ?? null), t),
      hoverColor: Color.lerp((a?.hoverColor ?? null), (b?.hoverColor ?? null), t),
      splashColor: Color.lerp((a?.splashColor ?? null), (b?.splashColor ?? null), t),
      borderColor: Color.lerp((a?.borderColor ?? null), (b?.borderColor ?? null), t),
      selectedBorderColor: Color.lerp((a?.selectedBorderColor ?? null), (b?.selectedBorderColor ?? null), t),
      disabledBorderColor: Color.lerp((a?.disabledBorderColor ?? null), (b?.disabledBorderColor ?? null), t),
      borderRadius: BorderRadius.lerp((a?.borderRadius ?? null), (b?.borderRadius ?? null), t),
      borderWidth: lerpDouble((a?.borderWidth ?? null), (b?.borderWidth ?? null), t),
    });
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof ToggleButtonsThemeData) || other.constructor !== this.constructor) return false;
    return valueEquals(this.textStyle, other.textStyle) &&
      valueEquals(this.constraints, other.constraints) &&
      valueEquals(this.color, other.color) &&
      valueEquals(this.selectedColor, other.selectedColor) &&
      valueEquals(this.disabledColor, other.disabledColor) &&
      valueEquals(this.fillColor, other.fillColor) &&
      valueEquals(this.focusColor, other.focusColor) &&
      valueEquals(this.highlightColor, other.highlightColor) &&
      valueEquals(this.splashColor, other.splashColor) &&
      valueEquals(this.hoverColor, other.hoverColor) &&
      valueEquals(this.borderColor, other.borderColor) &&
      valueEquals(this.selectedBorderColor, other.selectedBorderColor) &&
      valueEquals(this.disabledBorderColor, other.disabledBorderColor) &&
      valueEquals(this.borderWidth, other.borderWidth) &&
      valueEquals(this.borderRadius, other.borderRadius);
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.textStyle,
      this.constraints,
      this.color,
      this.selectedColor,
      this.disabledColor,
      this.fillColor,
      this.focusColor,
      this.highlightColor,
      this.hoverColor,
      this.splashColor,
      this.borderColor,
      this.selectedBorderColor,
      this.disabledBorderColor,
      this.borderRadius,
      this.borderWidth,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty("constraints", this.constraints, {defaultValue: null, typeName: "BoxConstraints"}));
    properties.add(new ColorProperty("color", this.color, {defaultValue: null}));
    properties.add(new ColorProperty("selectedColor", this.selectedColor, {defaultValue: null}));
    properties.add(new ColorProperty("disabledColor", this.disabledColor, {defaultValue: null}));
    properties.add(new ColorProperty("fillColor", this.fillColor, {defaultValue: null}));
    properties.add(new ColorProperty("focusColor", this.focusColor, {defaultValue: null}));
    properties.add(new ColorProperty("highlightColor", this.highlightColor, {defaultValue: null}));
    properties.add(new ColorProperty("hoverColor", this.hoverColor, {defaultValue: null}));
    properties.add(new ColorProperty("splashColor", this.splashColor, {defaultValue: null}));
    properties.add(new ColorProperty("borderColor", this.borderColor, {defaultValue: null}));
    properties.add(new ColorProperty("selectedBorderColor", this.selectedBorderColor, {defaultValue: null}));
    properties.add(new ColorProperty("disabledBorderColor", this.disabledBorderColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("borderRadius", this.borderRadius, {defaultValue: null, typeName: "BorderRadius"}));
    properties.add(new DoubleProperty("borderWidth", this.borderWidth, {defaultValue: null}));
  }
}
