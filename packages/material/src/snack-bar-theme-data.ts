// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Color } from "@nelyx/core/ui/color";
import { DismissDirection } from "@nelyx/core/framework/widgets/dismissible";
import { EdgeInsets } from "@nelyx/core/framework/painting/edge-insets";
import { ShapeBorder } from "@nelyx/core/framework/painting/borders";
import { SnackBarBehavior } from "./snack-bar-behavior.ts";
import { TextStyle } from "@nelyx/core/framework/painting/text-style";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty, EnumProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, hashValues } from "@nelyx/core/framework/painting/value-equality";
import { invariant } from "@nelyx/core/foundation/errors";
import { WidgetStateColor, WidgetState } from "@nelyx/core/framework/widgets/widget-state";
export interface SnackBarThemeDataOptions {
  readonly backgroundColor?: Color | null;
  readonly actionTextColor?: Color | null;
  readonly disabledActionTextColor?: Color | null;
  readonly contentTextStyle?: TextStyle | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly shape?: ShapeBorder | null;
  readonly behavior?: SnackBarBehavior | null;
  /** @dartType double? */
  readonly width?: number | null;
  readonly insetPadding?: EdgeInsets | null;
  readonly showCloseIcon?: boolean | null;
  readonly closeIconColor?: Color | null;
  /** @dartType double? */
  readonly actionOverflowThreshold?: number | null;
  readonly actionBackgroundColor?: Color | null;
  readonly disabledActionBackgroundColor?: Color | null;
  readonly dismissDirection?: DismissDirection | null;
}
type Values = {readonly [K in keyof Required<SnackBarThemeDataOptions>]: Exclude<SnackBarThemeDataOptions[K], undefined>};
export class SnackBarThemeData extends Diagnosticable(class {}) {
  private readonly values: Values;
  get backgroundColor(): Color | null { return this.values.backgroundColor; }
  get actionTextColor(): Color | null { return this.values.actionTextColor; }
  get disabledActionTextColor(): Color | null { return this.values.disabledActionTextColor; }
  get contentTextStyle(): TextStyle | null { return this.values.contentTextStyle; }
  /** @dartType double? */
  get elevation(): number | null { return this.values.elevation; }
  get shape(): ShapeBorder | null { return this.values.shape; }
  get behavior(): SnackBarBehavior | null { return this.values.behavior; }
  /** @dartType double? */
  get width(): number | null { return this.values.width; }
  get insetPadding(): EdgeInsets | null { return this.values.insetPadding; }
  get showCloseIcon(): boolean | null { return this.values.showCloseIcon; }
  get closeIconColor(): Color | null { return this.values.closeIconColor; }
  /** @dartType double? */
  get actionOverflowThreshold(): number | null { return this.values.actionOverflowThreshold; }
  get actionBackgroundColor(): Color | null { return this.values.actionBackgroundColor; }
  get disabledActionBackgroundColor(): Color | null { return this.values.disabledActionBackgroundColor; }
  get dismissDirection(): DismissDirection | null { return this.values.dismissDirection; }
  /** @dartParam elevation double?
   * @dartParam width double?
   * @dartParam actionOverflowThreshold double? */
  constructor(options: SnackBarThemeDataOptions = {}) {
    super();
    this.values = Object.freeze({
      backgroundColor: options.backgroundColor ?? null,
      actionTextColor: options.actionTextColor ?? null,
      disabledActionTextColor: options.disabledActionTextColor ?? null,
      contentTextStyle: options.contentTextStyle ?? null,
      elevation: options.elevation ?? null,
      shape: options.shape ?? null,
      behavior: options.behavior ?? null,
      width: options.width ?? null,
      insetPadding: options.insetPadding ?? null,
      showCloseIcon: options.showCloseIcon ?? null,
      closeIconColor: options.closeIconColor ?? null,
      actionOverflowThreshold: options.actionOverflowThreshold ?? null,
      actionBackgroundColor: options.actionBackgroundColor ?? null,
      disabledActionBackgroundColor: options.disabledActionBackgroundColor ?? null,
      dismissDirection: options.dismissDirection ?? null,
    });
    if (this.behavior !== null && !SnackBarBehavior.values.includes(this.behavior)) throw new TypeError("Expected a canonical SnackBarBehavior");
    if (this.dismissDirection !== null && !DismissDirection.values.includes(this.dismissDirection)) throw new TypeError("Expected a canonical DismissDirection");
    invariant(this.elevation === null || this.elevation >= 0, "invalid-snack-elevation", "SnackBar elevation must be non-negative");
    invariant(this.width === null || this.behavior === SnackBarBehavior.floating, "invalid-snack-width", "SnackBar width requires floating behavior");
    invariant(this.actionOverflowThreshold === null || this.actionOverflowThreshold >= 0 && this.actionOverflowThreshold <= 1, "invalid-snack-overflow", "Action overflow threshold must be within [0,1]");
    invariant(!(this.actionBackgroundColor instanceof WidgetStateColor) || this.disabledActionBackgroundColor === null, "invalid-snack-state-background", "State background cannot have a separate disabled background");
    if (new.target === SnackBarThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double?
   * @dartParam width double?
   * @dartParam actionOverflowThreshold double? */
  copyWith(options: SnackBarThemeDataOptions = {}): SnackBarThemeData {
    return new SnackBarThemeData({
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      actionTextColor: options.actionTextColor ?? this.actionTextColor,
      disabledActionTextColor: options.disabledActionTextColor ?? this.disabledActionTextColor,
      contentTextStyle: options.contentTextStyle ?? this.contentTextStyle,
      elevation: options.elevation ?? this.elevation,
      shape: options.shape ?? this.shape,
      behavior: options.behavior ?? this.behavior,
      width: options.width ?? this.width,
      insetPadding: options.insetPadding ?? this.insetPadding,
      showCloseIcon: options.showCloseIcon ?? this.showCloseIcon,
      closeIconColor: options.closeIconColor ?? this.closeIconColor,
      actionOverflowThreshold: options.actionOverflowThreshold ?? this.actionOverflowThreshold,
      actionBackgroundColor: options.actionBackgroundColor ?? this.actionBackgroundColor,
      disabledActionBackgroundColor: options.disabledActionBackgroundColor ?? this.disabledActionBackgroundColor,
      dismissDirection: options.dismissDirection ?? this.dismissDirection,
    });
  }
  /** @dartParam t double */
  static lerp(a: SnackBarThemeData | null, b: SnackBarThemeData | null, t: number): SnackBarThemeData {
    if (((a === b) && (a !== null))) {
    return a;
  }
    return new SnackBarThemeData({
      backgroundColor: Color.lerp((a?.backgroundColor ?? null), (b?.backgroundColor ?? null), t),
      actionTextColor: Color.lerp((a?.actionTextColor ?? null), (b?.actionTextColor ?? null), t),
      disabledActionTextColor: Color.lerp((a?.disabledActionTextColor ?? null), (b?.disabledActionTextColor ?? null), t),
      contentTextStyle: TextStyle.lerp((a?.contentTextStyle ?? null), (b?.contentTextStyle ?? null), t),
      elevation: lerpDouble((a?.elevation ?? null), (b?.elevation ?? null), t),
      shape: ShapeBorder.lerp((a?.shape ?? null), (b?.shape ?? null), t),
      behavior: ((t < 0.5) ? (a?.behavior ?? null) : (b?.behavior ?? null)),
      width: lerpDouble((a?.width ?? null), (b?.width ?? null), t),
      insetPadding: EdgeInsets.lerp((a?.insetPadding ?? null), (b?.insetPadding ?? null), t),
      closeIconColor: Color.lerp((a?.closeIconColor ?? null), (b?.closeIconColor ?? null), t),
      actionOverflowThreshold: lerpDouble((a?.actionOverflowThreshold ?? null), (b?.actionOverflowThreshold ?? null), t),
      actionBackgroundColor: Color.lerp((a?.actionBackgroundColor ?? null), (b?.actionBackgroundColor ?? null), t),
      disabledActionBackgroundColor: Color.lerp((a?.disabledActionBackgroundColor ?? null), (b?.disabledActionBackgroundColor ?? null), t),
      dismissDirection: ((t < 0.5) ? (a?.dismissDirection ?? null) : (b?.dismissDirection ?? null)),
    });
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof SnackBarThemeData) || other.constructor !== this.constructor) return false;
    return valueEquals(this.backgroundColor, other.backgroundColor) &&
      valueEquals(this.actionTextColor, other.actionTextColor) &&
      valueEquals(this.disabledActionTextColor, other.disabledActionTextColor) &&
      valueEquals(this.contentTextStyle, other.contentTextStyle) &&
      valueEquals(this.elevation, other.elevation) &&
      valueEquals(this.shape, other.shape) &&
      valueEquals(this.behavior, other.behavior) &&
      valueEquals(this.width, other.width) &&
      valueEquals(this.insetPadding, other.insetPadding) &&
      valueEquals(this.showCloseIcon, other.showCloseIcon) &&
      valueEquals(this.closeIconColor, other.closeIconColor) &&
      valueEquals(this.actionOverflowThreshold, other.actionOverflowThreshold) &&
      valueEquals(this.actionBackgroundColor, other.actionBackgroundColor) &&
      valueEquals(this.disabledActionBackgroundColor, other.disabledActionBackgroundColor) &&
      valueEquals(this.dismissDirection, other.dismissDirection);
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.backgroundColor,
      this.actionTextColor,
      this.disabledActionTextColor,
      this.contentTextStyle,
      this.elevation,
      this.shape,
      this.behavior,
      this.width,
      this.insetPadding,
      this.showCloseIcon,
      this.closeIconColor,
      this.actionOverflowThreshold,
      this.actionBackgroundColor,
      this.disabledActionBackgroundColor,
      this.dismissDirection,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new ColorProperty("backgroundColor", this.backgroundColor, {defaultValue: null}));
    properties.add(new ColorProperty("actionTextColor", this.actionTextColor, {defaultValue: null}));
    properties.add(new ColorProperty("disabledActionTextColor", this.disabledActionTextColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("contentTextStyle", this.contentTextStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new DoubleProperty("elevation", this.elevation, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("shape", this.shape, {defaultValue: null, typeName: "ShapeBorder"}));
    properties.add(new DiagnosticsProperty("behavior", this.behavior, {defaultValue: null, typeName: "SnackBarBehavior"}));
    properties.add(new DoubleProperty("width", this.width, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("insetPadding", this.insetPadding, {defaultValue: null, typeName: "EdgeInsets"}));
    properties.add(new DiagnosticsProperty("showCloseIcon", this.showCloseIcon, {defaultValue: null, typeName: "bool"}));
    properties.add(new ColorProperty("closeIconColor", this.closeIconColor, {defaultValue: null}));
    properties.add(new DoubleProperty("actionOverflowThreshold", this.actionOverflowThreshold, {defaultValue: null}));
    properties.add(new ColorProperty("actionBackgroundColor", this.actionBackgroundColor, {defaultValue: null}));
    properties.add(new ColorProperty("disabledActionBackgroundColor", this.disabledActionBackgroundColor, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("dismissDirection", this.dismissDirection, {defaultValue: null, typeName: "DismissDirection"}));
  }
}
