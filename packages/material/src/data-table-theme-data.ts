// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Color } from "@nelyx/core/ui/color";
import { Decoration } from "@nelyx/core/framework/painting/decoration";
import type { MainAxisAlignment } from "@nelyx/core/framework/rendering/boxes";
import type { MouseCursor } from "@nelyx/core/services/mouse-cursor";
import { TextStyle } from "@nelyx/core/framework/painting/text-style";
import { WidgetStateProperty } from "@nelyx/core/framework/widgets/widget-state";
import { lerpColorProperty } from "./internal/theme/value-interpolation.ts";
import { lerpDouble } from "@nelyx/core/internal/ui/lerp-double.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { DoubleProperty, EnumProperty } from "@nelyx/core/foundation/diagnostic-properties";
import "@nelyx/core/internal/framework/painting/color-property.generated";
import { valueEquals, hashValues } from "@nelyx/core/framework/painting/value-equality";
import { invariant } from "@nelyx/core/foundation/errors";
export interface DataTableThemeDataOptions {
  readonly decoration?: Decoration | null;
  readonly dataRowColor?: WidgetStateProperty<Color | null> | null;
  /** @dartType double? */
  readonly dataRowMinHeight?: number | null;
  /** @dartType double? */
  readonly dataRowMaxHeight?: number | null;
  readonly dataTextStyle?: TextStyle | null;
  readonly headingRowColor?: WidgetStateProperty<Color | null> | null;
  /** @dartType double? */
  readonly headingRowHeight?: number | null;
  readonly headingTextStyle?: TextStyle | null;
  /** @dartType double? */
  readonly horizontalMargin?: number | null;
  /** @dartType double? */
  readonly columnSpacing?: number | null;
  /** @dartType double? */
  readonly dividerThickness?: number | null;
  /** @dartType double? */
  readonly checkboxHorizontalMargin?: number | null;
  readonly headingCellCursor?: WidgetStateProperty<MouseCursor | null> | null;
  readonly dataRowCursor?: WidgetStateProperty<MouseCursor | null> | null;
  readonly headingRowAlignment?: MainAxisAlignment | null;
}
type Values = {readonly [K in keyof Required<DataTableThemeDataOptions>]: Exclude<DataTableThemeDataOptions[K], undefined>};
export class DataTableThemeData extends Diagnosticable(class {}) {
  private readonly values: Values;
  get decoration(): Decoration | null { return this.values.decoration; }
  get dataRowColor(): WidgetStateProperty<Color | null> | null { return this.values.dataRowColor; }
  /** @dartType double? */
  get dataRowMinHeight(): number | null { return this.values.dataRowMinHeight; }
  /** @dartType double? */
  get dataRowMaxHeight(): number | null { return this.values.dataRowMaxHeight; }
  get dataTextStyle(): TextStyle | null { return this.values.dataTextStyle; }
  get headingRowColor(): WidgetStateProperty<Color | null> | null { return this.values.headingRowColor; }
  /** @dartType double? */
  get headingRowHeight(): number | null { return this.values.headingRowHeight; }
  get headingTextStyle(): TextStyle | null { return this.values.headingTextStyle; }
  /** @dartType double? */
  get horizontalMargin(): number | null { return this.values.horizontalMargin; }
  /** @dartType double? */
  get columnSpacing(): number | null { return this.values.columnSpacing; }
  /** @dartType double? */
  get dividerThickness(): number | null { return this.values.dividerThickness; }
  /** @dartType double? */
  get checkboxHorizontalMargin(): number | null { return this.values.checkboxHorizontalMargin; }
  get headingCellCursor(): WidgetStateProperty<MouseCursor | null> | null { return this.values.headingCellCursor; }
  get dataRowCursor(): WidgetStateProperty<MouseCursor | null> | null { return this.values.dataRowCursor; }
  get headingRowAlignment(): MainAxisAlignment | null { return this.values.headingRowAlignment; }
  /** @dartParam dataRowMinHeight double?
   * @dartParam dataRowMaxHeight double?
   * @dartParam headingRowHeight double?
   * @dartParam horizontalMargin double?
   * @dartParam columnSpacing double?
   * @dartParam dividerThickness double?
   * @dartParam checkboxHorizontalMargin double? */
  constructor(options: DataTableThemeDataOptions = {}) {
    super();
    if (Object.hasOwn(options, "dataRowHeight")) throw new TypeError("dataRowHeight has been removed; use dataRowMinHeight/dataRowMaxHeight");
    this.values = Object.freeze({
      decoration: options.decoration ?? null,
      dataRowColor: options.dataRowColor ?? null,
      dataRowMinHeight: options.dataRowMinHeight ?? null,
      dataRowMaxHeight: options.dataRowMaxHeight ?? null,
      dataTextStyle: options.dataTextStyle ?? null,
      headingRowColor: options.headingRowColor ?? null,
      headingRowHeight: options.headingRowHeight ?? null,
      headingTextStyle: options.headingTextStyle ?? null,
      horizontalMargin: options.horizontalMargin ?? null,
      columnSpacing: options.columnSpacing ?? null,
      dividerThickness: options.dividerThickness ?? null,
      checkboxHorizontalMargin: options.checkboxHorizontalMargin ?? null,
      headingCellCursor: options.headingCellCursor ?? null,
      dataRowCursor: options.dataRowCursor ?? null,
      headingRowAlignment: options.headingRowAlignment ?? null,
    });
    invariant(this.dataRowMinHeight === null || this.dataRowMaxHeight === null || this.dataRowMaxHeight >= this.dataRowMinHeight, "invalid-data-row-range", "Maximum row height must be at least the minimum");
    if (new.target === DataTableThemeData) Object.freeze(this);
  }
  /** @dartParam dataRowMinHeight double?
   * @dartParam dataRowMaxHeight double?
   * @dartParam headingRowHeight double?
   * @dartParam horizontalMargin double?
   * @dartParam columnSpacing double?
   * @dartParam dividerThickness double?
   * @dartParam checkboxHorizontalMargin double? */
  copyWith(options: DataTableThemeDataOptions = {}): DataTableThemeData {
    return new DataTableThemeData({
      decoration: options.decoration ?? this.decoration,
      dataRowColor: options.dataRowColor ?? this.dataRowColor,
      dataRowMinHeight: options.dataRowMinHeight ?? this.dataRowMinHeight,
      dataRowMaxHeight: options.dataRowMaxHeight ?? this.dataRowMaxHeight,
      dataTextStyle: options.dataTextStyle ?? this.dataTextStyle,
      headingRowColor: options.headingRowColor ?? this.headingRowColor,
      headingRowHeight: options.headingRowHeight ?? this.headingRowHeight,
      headingTextStyle: options.headingTextStyle ?? this.headingTextStyle,
      horizontalMargin: options.horizontalMargin ?? this.horizontalMargin,
      columnSpacing: options.columnSpacing ?? this.columnSpacing,
      dividerThickness: options.dividerThickness ?? this.dividerThickness,
      checkboxHorizontalMargin: options.checkboxHorizontalMargin ?? this.checkboxHorizontalMargin,
      headingCellCursor: options.headingCellCursor ?? this.headingCellCursor,
      dataRowCursor: options.dataRowCursor ?? this.dataRowCursor,
      headingRowAlignment: options.headingRowAlignment ?? this.headingRowAlignment,
    });
  }
  /** @dartParam t double */
  static lerp(a: DataTableThemeData, b: DataTableThemeData, t: number): DataTableThemeData {
    if ((a === b)) {
    return a;
  }
    return new DataTableThemeData({
      decoration: Decoration.lerp(a.decoration, b.decoration, t),
      dataRowColor: lerpColorProperty(a.dataRowColor, b.dataRowColor, t),
      dataRowMinHeight: lerpDouble(a.dataRowMinHeight, b.dataRowMinHeight, t),
      dataRowMaxHeight: lerpDouble(a.dataRowMaxHeight, b.dataRowMaxHeight, t),
      dataTextStyle: TextStyle.lerp(a.dataTextStyle, b.dataTextStyle, t),
      headingRowColor: lerpColorProperty(a.headingRowColor, b.headingRowColor, t),
      headingRowHeight: lerpDouble(a.headingRowHeight, b.headingRowHeight, t),
      headingTextStyle: TextStyle.lerp(a.headingTextStyle, b.headingTextStyle, t),
      horizontalMargin: lerpDouble(a.horizontalMargin, b.horizontalMargin, t),
      columnSpacing: lerpDouble(a.columnSpacing, b.columnSpacing, t),
      dividerThickness: lerpDouble(a.dividerThickness, b.dividerThickness, t),
      checkboxHorizontalMargin: lerpDouble(a.checkboxHorizontalMargin, b.checkboxHorizontalMargin, t),
      headingCellCursor: ((t < 0.5) ? a.headingCellCursor : b.headingCellCursor),
      dataRowCursor: ((t < 0.5) ? a.dataRowCursor : b.dataRowCursor),
      headingRowAlignment: ((t < 0.5) ? a.headingRowAlignment : b.headingRowAlignment),
    });
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof DataTableThemeData) || other.constructor !== this.constructor) return false;
    return valueEquals(this.decoration, other.decoration) &&
      valueEquals(this.dataRowColor, other.dataRowColor) &&
      valueEquals(this.dataRowMinHeight, other.dataRowMinHeight) &&
      valueEquals(this.dataRowMaxHeight, other.dataRowMaxHeight) &&
      valueEquals(this.dataTextStyle, other.dataTextStyle) &&
      valueEquals(this.headingRowColor, other.headingRowColor) &&
      valueEquals(this.headingRowHeight, other.headingRowHeight) &&
      valueEquals(this.headingTextStyle, other.headingTextStyle) &&
      valueEquals(this.horizontalMargin, other.horizontalMargin) &&
      valueEquals(this.columnSpacing, other.columnSpacing) &&
      valueEquals(this.dividerThickness, other.dividerThickness) &&
      valueEquals(this.checkboxHorizontalMargin, other.checkboxHorizontalMargin) &&
      valueEquals(this.headingCellCursor, other.headingCellCursor) &&
      valueEquals(this.dataRowCursor, other.dataRowCursor) &&
      valueEquals(this.headingRowAlignment, other.headingRowAlignment);
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.decoration,
      this.dataRowColor,
      this.dataRowMinHeight,
      this.dataRowMaxHeight,
      this.dataTextStyle,
      this.headingRowColor,
      this.headingRowHeight,
      this.headingTextStyle,
      this.horizontalMargin,
      this.columnSpacing,
      this.dividerThickness,
      this.checkboxHorizontalMargin,
      this.headingCellCursor,
      this.dataRowCursor,
      this.headingRowAlignment,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty("decoration", this.decoration, {defaultValue: null, typeName: "Decoration"}));
    properties.add(new DiagnosticsProperty("dataRowColor", this.dataRowColor, {defaultValue: null, typeName: "WidgetStateProperty<Color?>"}));
    properties.add(new DoubleProperty("dataRowMinHeight", this.dataRowMinHeight, {defaultValue: null}));
    properties.add(new DoubleProperty("dataRowMaxHeight", this.dataRowMaxHeight, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("dataTextStyle", this.dataTextStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new DiagnosticsProperty("headingRowColor", this.headingRowColor, {defaultValue: null, typeName: "WidgetStateProperty<Color?>"}));
    properties.add(new DoubleProperty("headingRowHeight", this.headingRowHeight, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("headingTextStyle", this.headingTextStyle, {defaultValue: null, typeName: "TextStyle"}));
    properties.add(new DoubleProperty("horizontalMargin", this.horizontalMargin, {defaultValue: null}));
    properties.add(new DoubleProperty("columnSpacing", this.columnSpacing, {defaultValue: null}));
    properties.add(new DoubleProperty("dividerThickness", this.dividerThickness, {defaultValue: null}));
    properties.add(new DoubleProperty("checkboxHorizontalMargin", this.checkboxHorizontalMargin, {defaultValue: null}));
    properties.add(new DiagnosticsProperty("headingCellCursor", this.headingCellCursor, {defaultValue: null, typeName: "WidgetStateProperty<MouseCursor?>?"}));
    properties.add(new DiagnosticsProperty("dataRowCursor", this.dataRowCursor, {defaultValue: null, typeName: "WidgetStateProperty<MouseCursor?>?"}));
    properties.add(new EnumProperty("headingRowAlignment", this.headingRowAlignment, {defaultValue: null, typeName: "MainAxisAlignment"}));
  }
}
