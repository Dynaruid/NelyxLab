// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { BorderSide } from "@nelyx/core/framework/painting/borders";
import { BoxConstraints } from "@nelyx/core/framework/rendering/constraints";
import { Color } from "@nelyx/core/ui/color";
import { DartDouble } from "@nelyx/core/foundation/dart-numeric";
import { EdgeInsetsGeometry } from "@nelyx/core/framework/painting/edge-insets";
import { OutlinedBorder } from "@nelyx/core/framework/painting/borders";
import type { TextCapitalization } from "@nelyx/core/services/text-capitalization";
import { TextStyle } from "@nelyx/core/framework/painting/text-style";
import { WidgetStateProperty } from "@nelyx/core/framework/widgets/widget-state";
import { lerpDoubleProperty, lerpColorProperty, lerpOutlinedBorderProperty, lerpEdgeInsetsGeometryProperty, lerpTextStyleProperty } from "./internal/theme/value-interpolation.ts";
import { WidgetStateBorderSide } from "@nelyx/core/framework/widgets/widget-state";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty, EnumProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, valueHash, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface SearchBarThemeDataOptions {
  /** @dartType WidgetStateProperty<double?>? */
  readonly elevation?: WidgetStateProperty<DartDouble | null> | null;
  readonly backgroundColor?: WidgetStateProperty<Color | null> | null;
  readonly shadowColor?: WidgetStateProperty<Color | null> | null;
  readonly surfaceTintColor?: WidgetStateProperty<Color | null> | null;
  readonly overlayColor?: WidgetStateProperty<Color | null> | null;
  readonly side?: WidgetStateProperty<BorderSide | null> | null;
  readonly shape?: WidgetStateProperty<OutlinedBorder | null> | null;
  readonly padding?: WidgetStateProperty<EdgeInsetsGeometry | null> | null;
  readonly textStyle?: WidgetStateProperty<TextStyle | null> | null;
  readonly hintStyle?: WidgetStateProperty<TextStyle | null> | null;
  readonly constraints?: BoxConstraints | null;
  readonly textCapitalization?: TextCapitalization | null;
}
export class SearchBarThemeData extends Diagnosticable(class {}) {
  /** @dartType WidgetStateProperty<double?>? */
  readonly elevation: WidgetStateProperty<DartDouble | null> | null;
  readonly backgroundColor: WidgetStateProperty<Color | null> | null;
  readonly shadowColor: WidgetStateProperty<Color | null> | null;
  readonly surfaceTintColor: WidgetStateProperty<Color | null> | null;
  readonly overlayColor: WidgetStateProperty<Color | null> | null;
  readonly side: WidgetStateProperty<BorderSide | null> | null;
  readonly shape: WidgetStateProperty<OutlinedBorder | null> | null;
  readonly padding: WidgetStateProperty<EdgeInsetsGeometry | null> | null;
  readonly textStyle: WidgetStateProperty<TextStyle | null> | null;
  readonly hintStyle: WidgetStateProperty<TextStyle | null> | null;
  readonly constraints: BoxConstraints | null;
  readonly textCapitalization: TextCapitalization | null;
  /** @dartParam elevation WidgetStateProperty<double?>? */
  constructor(options: SearchBarThemeDataOptions = {}) {
    super();
    this.elevation = options.elevation ?? null;
    this.backgroundColor = options.backgroundColor ?? null;
    this.shadowColor = options.shadowColor ?? null;
    this.surfaceTintColor = options.surfaceTintColor ?? null;
    this.overlayColor = options.overlayColor ?? null;
    this.side = options.side ?? null;
    this.shape = options.shape ?? null;
    this.padding = options.padding ?? null;
    this.textStyle = options.textStyle ?? null;
    this.hintStyle = options.hintStyle ?? null;
    this.constraints = options.constraints ?? null;
    this.textCapitalization = options.textCapitalization ?? null;
    if (new.target === SearchBarThemeData) Object.freeze(this);
  }
  /** @dartParam elevation WidgetStateProperty<double?>? */
  copyWith(options: SearchBarThemeDataOptions = {}): SearchBarThemeData {
    return new SearchBarThemeData({
      elevation: options.elevation ?? this.elevation,
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      shadowColor: options.shadowColor ?? this.shadowColor,
      surfaceTintColor: options.surfaceTintColor ?? this.surfaceTintColor,
      overlayColor: options.overlayColor ?? this.overlayColor,
      side: options.side ?? this.side,
      shape: options.shape ?? this.shape,
      padding: options.padding ?? this.padding,
      textStyle: options.textStyle ?? this.textStyle,
      hintStyle: options.hintStyle ?? this.hintStyle,
      constraints: options.constraints ?? this.constraints,
      textCapitalization: options.textCapitalization ?? this.textCapitalization,
    });
  }
  /** @dartParam t double */
  static lerp(a: SearchBarThemeData | null, b: SearchBarThemeData | null, t: number): SearchBarThemeData | null {
    if ((a === b)) {
    return a;
}
    return new SearchBarThemeData({
      elevation: lerpDoubleProperty((a?.elevation ?? null), (b?.elevation ?? null), t),
      backgroundColor: lerpColorProperty((a?.backgroundColor ?? null), (b?.backgroundColor ?? null), t),
      shadowColor: lerpColorProperty((a?.shadowColor ?? null), (b?.shadowColor ?? null), t),
      surfaceTintColor: lerpColorProperty((a?.surfaceTintColor ?? null), (b?.surfaceTintColor ?? null), t),
      overlayColor: lerpColorProperty((a?.overlayColor ?? null), (b?.overlayColor ?? null), t),
      side: WidgetStateBorderSide.lerp((a?.side ?? null), (b?.side ?? null), t),
      shape: lerpOutlinedBorderProperty((a?.shape ?? null), (b?.shape ?? null), t),
      padding: lerpEdgeInsetsGeometryProperty((a?.padding ?? null), (b?.padding ?? null), t),
      textStyle: lerpTextStyleProperty((a?.textStyle ?? null), (b?.textStyle ?? null), t),
      hintStyle: lerpTextStyleProperty((a?.hintStyle ?? null), (b?.hintStyle ?? null), t),
      constraints: BoxConstraints.lerp((a?.constraints ?? null), (b?.constraints ?? null), t),
      textCapitalization: ((t < 0.5) ? (a?.textCapitalization ?? null) : (b?.textCapitalization ?? null)),
    });
}
  equals(other: unknown): boolean { return this === other || other instanceof SearchBarThemeData && other.constructor === this.constructor && valueEquals(this.elevation, other.elevation) && valueEquals(this.backgroundColor, other.backgroundColor) && valueEquals(this.shadowColor, other.shadowColor) && valueEquals(this.surfaceTintColor, other.surfaceTintColor) && valueEquals(this.overlayColor, other.overlayColor) && valueEquals(this.side, other.side) && valueEquals(this.shape, other.shape) && valueEquals(this.padding, other.padding) && valueEquals(this.textStyle, other.textStyle) && valueEquals(this.hintStyle, other.hintStyle) && valueEquals(this.constraints, other.constraints) && valueEquals(this.textCapitalization, other.textCapitalization); }
  /** @dartReturn int */
  get hashCode(): number { return hashValues(this.elevation, this.backgroundColor, this.shadowColor, this.surfaceTintColor, this.overlayColor, this.side, this.shape, this.padding, this.textStyle, this.hintStyle, this.constraints, this.textCapitalization); }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty("elevation", this.elevation, { defaultValue: null, typeName: "WidgetStateProperty<double?>" }));
    properties.add(new DiagnosticsProperty("backgroundColor", this.backgroundColor, { defaultValue: null, typeName: "WidgetStateProperty<Color?>" }));
    properties.add(new DiagnosticsProperty("shadowColor", this.shadowColor, { defaultValue: null, typeName: "WidgetStateProperty<Color?>" }));
    properties.add(new DiagnosticsProperty("surfaceTintColor", this.surfaceTintColor, { defaultValue: null, typeName: "WidgetStateProperty<Color?>" }));
    properties.add(new DiagnosticsProperty("overlayColor", this.overlayColor, { defaultValue: null, typeName: "WidgetStateProperty<Color?>" }));
    properties.add(new DiagnosticsProperty("side", this.side, { defaultValue: null, typeName: "WidgetStateProperty<BorderSide?>" }));
    properties.add(new DiagnosticsProperty("shape", this.shape, { defaultValue: null, typeName: "WidgetStateProperty<OutlinedBorder?>" }));
    properties.add(new DiagnosticsProperty("padding", this.padding, { defaultValue: null, typeName: "WidgetStateProperty<EdgeInsetsGeometry?>" }));
    properties.add(new DiagnosticsProperty("textStyle", this.textStyle, { defaultValue: null, typeName: "WidgetStateProperty<TextStyle?>" }));
    properties.add(new DiagnosticsProperty("hintStyle", this.hintStyle, { defaultValue: null, typeName: "WidgetStateProperty<TextStyle?>" }));
    properties.add(new DiagnosticsProperty("constraints", this.constraints, { defaultValue: null, typeName: "BoxConstraints" }));
    properties.add(new DiagnosticsProperty("textCapitalization", this.textCapitalization, { defaultValue: null, typeName: "TextCapitalization" }));
  }
}
