// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { AlignmentGeometry } from "@nelyx/core/framework/painting/alignment";
import { Color } from "@nelyx/core/ui/color";
import { EdgeInsetsGeometry } from "@nelyx/core/framework/painting/edge-insets";
import { Offset } from "@nelyx/core/ui/offset";
import { TextStyle } from "@nelyx/core/framework/painting/text-style";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { ColorProperty } from "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, hashValues } from "@nelyx/core/framework/painting/value-equality";
export interface BadgeThemeDataOptions {
  readonly backgroundColor?: Color | null;
  readonly textColor?: Color | null;
  /** @dartType double? */
  readonly smallSize?: number | null;
  /** @dartType double? */
  readonly largeSize?: number | null;
  readonly textStyle?: TextStyle | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly alignment?: AlignmentGeometry | null;
  readonly offset?: Offset | null;
}
export class BadgeThemeData extends Diagnosticable(class {}) {
  readonly backgroundColor: Color | null;
  readonly textColor: Color | null;
  /** @dartType double? */
  readonly smallSize: number | null;
  /** @dartType double? */
  readonly largeSize: number | null;
  readonly textStyle: TextStyle | null;
  readonly padding: EdgeInsetsGeometry | null;
  readonly alignment: AlignmentGeometry | null;
  readonly offset: Offset | null;
  /** @dartParam smallSize double?
   * @dartParam largeSize double? */
  constructor(options: BadgeThemeDataOptions = {}) {
    super();
    this.backgroundColor = options.backgroundColor ?? null;
    this.textColor = options.textColor ?? null;
    this.smallSize = options.smallSize ?? null;
    this.largeSize = options.largeSize ?? null;
    this.textStyle = options.textStyle ?? null;
    this.padding = options.padding ?? null;
    this.alignment = options.alignment ?? null;
    this.offset = options.offset ?? null;
    if (new.target === BadgeThemeData) Object.freeze(this);
  }
  /** @dartParam smallSize double?
   * @dartParam largeSize double? */
  copyWith(options: BadgeThemeDataOptions = {}): BadgeThemeData {
    return new BadgeThemeData({
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      textColor: options.textColor ?? this.textColor,
      smallSize: options.smallSize ?? this.smallSize,
      largeSize: options.largeSize ?? this.largeSize,
      textStyle: options.textStyle ?? this.textStyle,
      padding: options.padding ?? this.padding,
      alignment: options.alignment ?? this.alignment,
      offset: options.offset ?? this.offset,
    });
  }
  /** @dartParam t double */
  static lerp(a: BadgeThemeData | null, b: BadgeThemeData | null, t: number): BadgeThemeData {
    if (((a === b) && (a !== null))) {
    return a;
}
    return new BadgeThemeData({
      backgroundColor: Color.lerp((a?.backgroundColor ?? null), (b?.backgroundColor ?? null), t),
      textColor: Color.lerp((a?.textColor ?? null), (b?.textColor ?? null), t),
      smallSize: lerpDouble((a?.smallSize ?? null), (b?.smallSize ?? null), t),
      largeSize: lerpDouble((a?.largeSize ?? null), (b?.largeSize ?? null), t),
      textStyle: TextStyle.lerp((a?.textStyle ?? null), (b?.textStyle ?? null), t),
      padding: EdgeInsetsGeometry.lerp((a?.padding ?? null), (b?.padding ?? null), t),
      alignment: AlignmentGeometry.lerp((a?.alignment ?? null), (b?.alignment ?? null), t),
      offset: Offset.lerp((a?.offset ?? null), (b?.offset ?? null), t),
    });
}
  equals(other: unknown): boolean { return this === other || other instanceof BadgeThemeData && other.constructor === this.constructor && valueEquals(this.backgroundColor, other.backgroundColor) && valueEquals(this.textColor, other.textColor) && valueEquals(this.smallSize, other.smallSize) && valueEquals(this.largeSize, other.largeSize) && valueEquals(this.textStyle, other.textStyle) && valueEquals(this.padding, other.padding) && valueEquals(this.alignment, other.alignment) && valueEquals(this.offset, other.offset); }
  /** @dartReturn int */
  get hashCode(): number { return hashValues(this.backgroundColor, this.textColor, this.smallSize, this.largeSize, this.textStyle, this.padding, this.alignment, this.offset); }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new ColorProperty("backgroundColor", this.backgroundColor, { defaultValue: null }));
    properties.add(new ColorProperty("textColor", this.textColor, { defaultValue: null }));
    properties.add(new DoubleProperty("smallSize", this.smallSize, { defaultValue: null }));
    properties.add(new DoubleProperty("largeSize", this.largeSize, { defaultValue: null }));
    properties.add(new DiagnosticsProperty("textStyle", this.textStyle, { defaultValue: null, typeName: "TextStyle" }));
    properties.add(new DiagnosticsProperty("padding", this.padding, { defaultValue: null, typeName: "EdgeInsetsGeometry" }));
    properties.add(new DiagnosticsProperty("alignment", this.alignment, { defaultValue: null, typeName: "AlignmentGeometry" }));
    properties.add(new DiagnosticsProperty("offset", this.offset, { defaultValue: null, typeName: "Offset" }));
  }
}
