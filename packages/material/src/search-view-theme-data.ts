// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { Color } from '@nelyx/core/ui/color';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { lerpSearchSides } from './internal/theme/value-interpolation.ts';
import { lerpDouble } from '@nelyx/core/internal/ui/lerp-double.generated';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import '@nelyx/core/foundation/diagnostic-properties';
import '@nelyx/core/internal/framework/painting/color-property.generated';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
export interface SearchViewThemeDataOptions {
  readonly backgroundColor?: Color | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly surfaceTintColor?: Color | null;
  readonly side?: BorderSide | null;
  readonly shape?: OutlinedBorder | null;
  /** @dartType double? */
  readonly headerHeight?: number | null;
  readonly headerTextStyle?: TextStyle | null;
  readonly headerHintStyle?: TextStyle | null;
  readonly constraints?: BoxConstraints | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly barPadding?: EdgeInsetsGeometry | null;
  readonly shrinkWrap?: boolean | null;
  readonly dividerColor?: Color | null;
}
export class SearchViewThemeData extends Diagnosticable(class {}) {
  readonly backgroundColor: Color | null;
  /** @dartType double? */
  readonly elevation: number | null;
  readonly surfaceTintColor: Color | null;
  readonly side: BorderSide | null;
  readonly shape: OutlinedBorder | null;
  /** @dartType double? */
  readonly headerHeight: number | null;
  readonly headerTextStyle: TextStyle | null;
  readonly headerHintStyle: TextStyle | null;
  readonly constraints: BoxConstraints | null;
  readonly padding: EdgeInsetsGeometry | null;
  readonly barPadding: EdgeInsetsGeometry | null;
  readonly shrinkWrap: boolean | null;
  readonly dividerColor: Color | null;
  /** @dartParam elevation double?
   * @dartParam headerHeight double? */
  constructor(options: SearchViewThemeDataOptions = {}) {
    super();
    this.backgroundColor = options.backgroundColor ?? null;
    this.elevation = options.elevation ?? null;
    this.surfaceTintColor = options.surfaceTintColor ?? null;
    this.side = options.side ?? null;
    this.shape = options.shape ?? null;
    this.headerHeight = options.headerHeight ?? null;
    this.headerTextStyle = options.headerTextStyle ?? null;
    this.headerHintStyle = options.headerHintStyle ?? null;
    this.constraints = options.constraints ?? null;
    this.padding = options.padding ?? null;
    this.barPadding = options.barPadding ?? null;
    this.shrinkWrap = options.shrinkWrap ?? null;
    this.dividerColor = options.dividerColor ?? null;
    if (new.target === SearchViewThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double?
   * @dartParam headerHeight double? */
  copyWith(options: SearchViewThemeDataOptions = {}): SearchViewThemeData {
    return new SearchViewThemeData({
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      elevation: options.elevation ?? this.elevation,
      surfaceTintColor: options.surfaceTintColor ?? this.surfaceTintColor,
      side: options.side ?? this.side,
      shape: options.shape ?? this.shape,
      headerHeight: options.headerHeight ?? this.headerHeight,
      headerTextStyle: options.headerTextStyle ?? this.headerTextStyle,
      headerHintStyle: options.headerHintStyle ?? this.headerHintStyle,
      constraints: options.constraints ?? this.constraints,
      padding: options.padding ?? this.padding,
      barPadding: options.barPadding ?? this.barPadding,
      shrinkWrap: options.shrinkWrap ?? this.shrinkWrap,
      dividerColor: options.dividerColor ?? this.dividerColor,
    });
  }
  /** @dartParam t double */
  static lerp(
    a: SearchViewThemeData | null,
    b: SearchViewThemeData | null,
    t: number,
  ): SearchViewThemeData | null {
    if (a === b) {
      return a;
    }
    return new SearchViewThemeData({
      backgroundColor: Color.lerp(a?.backgroundColor ?? null, b?.backgroundColor ?? null, t),
      elevation: lerpDouble(a?.elevation ?? null, b?.elevation ?? null, t),
      surfaceTintColor: Color.lerp(a?.surfaceTintColor ?? null, b?.surfaceTintColor ?? null, t),
      side: lerpSearchSides(a?.side ?? null, b?.side ?? null, t),
      shape: OutlinedBorder.lerp(a?.shape ?? null, b?.shape ?? null, t),
      headerHeight: lerpDouble(a?.headerHeight ?? null, b?.headerHeight ?? null, t),
      headerTextStyle: TextStyle.lerp(a?.headerTextStyle ?? null, b?.headerTextStyle ?? null, t),
      headerHintStyle: TextStyle.lerp(a?.headerTextStyle ?? null, b?.headerTextStyle ?? null, t),
      constraints: BoxConstraints.lerp(a?.constraints ?? null, b?.constraints ?? null, t),
      padding: EdgeInsetsGeometry.lerp(a?.padding ?? null, b?.padding ?? null, t),
      barPadding: EdgeInsetsGeometry.lerp(a?.barPadding ?? null, b?.barPadding ?? null, t),
      shrinkWrap: t < 0.5 ? (a?.shrinkWrap ?? null) : (b?.shrinkWrap ?? null),
      dividerColor: Color.lerp(a?.dividerColor ?? null, b?.dividerColor ?? null, t),
    });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof SearchViewThemeData &&
        other.constructor === this.constructor &&
        valueEquals(this.backgroundColor, other.backgroundColor) &&
        valueEquals(this.elevation, other.elevation) &&
        valueEquals(this.surfaceTintColor, other.surfaceTintColor) &&
        valueEquals(this.side, other.side) &&
        valueEquals(this.shape, other.shape) &&
        valueEquals(this.headerHeight, other.headerHeight) &&
        valueEquals(this.headerTextStyle, other.headerTextStyle) &&
        valueEquals(this.headerHintStyle, other.headerHintStyle) &&
        valueEquals(this.constraints, other.constraints) &&
        valueEquals(this.padding, other.padding) &&
        valueEquals(this.barPadding, other.barPadding) &&
        valueEquals(this.shrinkWrap, other.shrinkWrap) &&
        valueEquals(this.dividerColor, other.dividerColor))
    );
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.backgroundColor,
      this.elevation,
      this.surfaceTintColor,
      this.side,
      this.shape,
      this.headerHeight,
      this.headerTextStyle,
      this.headerHintStyle,
      this.constraints,
      this.padding,
      this.barPadding,
      this.shrinkWrap,
      this.dividerColor,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new DiagnosticsProperty('backgroundColor', this.backgroundColor, {
        defaultValue: null,
        typeName: 'Color?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('elevation', this.elevation, {
        defaultValue: null,
        typeName: 'double?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('surfaceTintColor', this.surfaceTintColor, {
        defaultValue: null,
        typeName: 'Color?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('side', this.side, { defaultValue: null, typeName: 'BorderSide?' }),
    );
    properties.add(
      new DiagnosticsProperty('shape', this.shape, {
        defaultValue: null,
        typeName: 'OutlinedBorder?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('headerHeight', this.headerHeight, {
        defaultValue: null,
        typeName: 'double?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('headerTextStyle', this.headerTextStyle, {
        defaultValue: null,
        typeName: 'TextStyle?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('headerHintStyle', this.headerHintStyle, {
        defaultValue: null,
        typeName: 'TextStyle?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('constraints', this.constraints, {
        defaultValue: null,
        typeName: 'BoxConstraints',
      }),
    );
    properties.add(
      new DiagnosticsProperty('padding', this.padding, {
        defaultValue: null,
        typeName: 'EdgeInsetsGeometry?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('barPadding', this.barPadding, {
        defaultValue: null,
        typeName: 'EdgeInsetsGeometry?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('shrinkWrap', this.shrinkWrap, {
        defaultValue: null,
        typeName: 'bool?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('dividerColor', this.dividerColor, {
        defaultValue: null,
        typeName: 'Color?',
      }),
    );
  }
}
