// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { lerpDouble } from '@nelyx/core/internal/ui/lerp-double.generated';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { DoubleProperty } from '@nelyx/core/foundation/diagnostic-properties';
import { ColorProperty } from '@nelyx/core/internal/framework/painting/color-property.generated';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
export interface DialogThemeDataOptions {
  readonly backgroundColor?: Color | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly shape?: ShapeBorder | null;
  readonly alignment?: AlignmentGeometry | null;
  readonly titleTextStyle?: TextStyle | null;
  readonly contentTextStyle?: TextStyle | null;
  readonly actionsPadding?: EdgeInsetsGeometry | null;
  readonly iconColor?: Color | null;
  readonly barrierColor?: Color | null;
  readonly insetPadding?: EdgeInsets | null;
  readonly clipBehavior?: Clip | null;
  readonly constraints?: BoxConstraints | null;
}
export class DialogThemeData extends Diagnosticable(class {}) {
  readonly backgroundColor: Color | null;
  /** @dartType double? */
  readonly elevation: number | null;
  readonly shadowColor: Color | null;
  readonly surfaceTintColor: Color | null;
  readonly shape: ShapeBorder | null;
  readonly alignment: AlignmentGeometry | null;
  readonly titleTextStyle: TextStyle | null;
  readonly contentTextStyle: TextStyle | null;
  readonly actionsPadding: EdgeInsetsGeometry | null;
  readonly iconColor: Color | null;
  readonly barrierColor: Color | null;
  readonly insetPadding: EdgeInsets | null;
  readonly clipBehavior: Clip | null;
  readonly constraints: BoxConstraints | null;
  /** @dartParam elevation double? */
  constructor(options: DialogThemeDataOptions = {}) {
    super();
    this.backgroundColor = options.backgroundColor ?? null;
    this.elevation = options.elevation ?? null;
    this.shadowColor = options.shadowColor ?? null;
    this.surfaceTintColor = options.surfaceTintColor ?? null;
    this.shape = options.shape ?? null;
    this.alignment = options.alignment ?? null;
    this.titleTextStyle = options.titleTextStyle ?? null;
    this.contentTextStyle = options.contentTextStyle ?? null;
    this.actionsPadding = options.actionsPadding ?? null;
    this.iconColor = options.iconColor ?? null;
    this.barrierColor = options.barrierColor ?? null;
    this.insetPadding = options.insetPadding ?? null;
    this.clipBehavior = options.clipBehavior ?? null;
    this.constraints = options.constraints ?? null;
    if (new.target === DialogThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double? */
  copyWith(options: DialogThemeDataOptions = {}): DialogThemeData {
    return new DialogThemeData({
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      elevation: options.elevation ?? this.elevation,
      shadowColor: options.shadowColor ?? this.shadowColor,
      surfaceTintColor: options.surfaceTintColor ?? this.surfaceTintColor,
      shape: options.shape ?? this.shape,
      alignment: options.alignment ?? this.alignment,
      iconColor: options.iconColor ?? this.iconColor,
      titleTextStyle: options.titleTextStyle ?? this.titleTextStyle,
      contentTextStyle: options.contentTextStyle ?? this.contentTextStyle,
      actionsPadding: options.actionsPadding ?? this.actionsPadding,
      barrierColor: options.barrierColor ?? this.barrierColor,
      insetPadding: options.insetPadding ?? this.insetPadding,
      clipBehavior: options.clipBehavior ?? this.clipBehavior,
      constraints: options.constraints ?? this.constraints,
    });
  }
  /** @dartParam t double */
  static lerp(a: DialogThemeData | null, b: DialogThemeData | null, t: number): DialogThemeData {
    if (a === b && a !== null) {
      return a;
    }
    return new DialogThemeData({
      backgroundColor: Color.lerp(a?.backgroundColor ?? null, b?.backgroundColor ?? null, t),
      elevation: lerpDouble(a?.elevation ?? null, b?.elevation ?? null, t),
      shadowColor: Color.lerp(a?.shadowColor ?? null, b?.shadowColor ?? null, t),
      surfaceTintColor: Color.lerp(a?.surfaceTintColor ?? null, b?.surfaceTintColor ?? null, t),
      shape: ShapeBorder.lerp(a?.shape ?? null, b?.shape ?? null, t),
      alignment: AlignmentGeometry.lerp(a?.alignment ?? null, b?.alignment ?? null, t),
      iconColor: Color.lerp(a?.iconColor ?? null, b?.iconColor ?? null, t),
      titleTextStyle: TextStyle.lerp(a?.titleTextStyle ?? null, b?.titleTextStyle ?? null, t),
      contentTextStyle: TextStyle.lerp(a?.contentTextStyle ?? null, b?.contentTextStyle ?? null, t),
      actionsPadding: EdgeInsetsGeometry.lerp(
        a?.actionsPadding ?? null,
        b?.actionsPadding ?? null,
        t,
      ),
      barrierColor: Color.lerp(a?.barrierColor ?? null, b?.barrierColor ?? null, t),
      insetPadding: EdgeInsets.lerp(a?.insetPadding ?? null, b?.insetPadding ?? null, t),
      clipBehavior: t < 0.5 ? (a?.clipBehavior ?? null) : (b?.clipBehavior ?? null),
      constraints: BoxConstraints.lerp(a?.constraints ?? null, b?.constraints ?? null, t),
    });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof DialogThemeData &&
        other.constructor === this.constructor &&
        valueEquals(this.backgroundColor, other.backgroundColor) &&
        valueEquals(this.elevation, other.elevation) &&
        valueEquals(this.shadowColor, other.shadowColor) &&
        valueEquals(this.surfaceTintColor, other.surfaceTintColor) &&
        valueEquals(this.shape, other.shape) &&
        valueEquals(this.alignment, other.alignment) &&
        valueEquals(this.titleTextStyle, other.titleTextStyle) &&
        valueEquals(this.contentTextStyle, other.contentTextStyle) &&
        valueEquals(this.actionsPadding, other.actionsPadding) &&
        valueEquals(this.iconColor, other.iconColor) &&
        valueEquals(this.barrierColor, other.barrierColor) &&
        valueEquals(this.insetPadding, other.insetPadding) &&
        valueEquals(this.clipBehavior, other.clipBehavior) &&
        valueEquals(this.constraints, other.constraints))
    );
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.backgroundColor,
      this.elevation,
      this.shadowColor,
      this.surfaceTintColor,
      this.shape,
      this.alignment,
      this.iconColor,
      this.titleTextStyle,
      this.contentTextStyle,
      this.actionsPadding,
      this.barrierColor,
      this.insetPadding,
      this.clipBehavior,
      this.constraints,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new ColorProperty('backgroundColor', this.backgroundColor, { defaultValue: null }),
    );
    properties.add(new DoubleProperty('elevation', this.elevation, { defaultValue: null }));
    properties.add(new ColorProperty('shadowColor', this.shadowColor, { defaultValue: null }));
    properties.add(
      new ColorProperty('surfaceTintColor', this.surfaceTintColor, { defaultValue: null }),
    );
    properties.add(
      new DiagnosticsProperty('shape', this.shape, { defaultValue: null, typeName: 'ShapeBorder' }),
    );
    properties.add(
      new DiagnosticsProperty('alignment', this.alignment, {
        defaultValue: null,
        typeName: 'AlignmentGeometry',
      }),
    );
    properties.add(new ColorProperty('iconColor', this.iconColor, { defaultValue: null }));
    properties.add(
      new DiagnosticsProperty('titleTextStyle', this.titleTextStyle, {
        defaultValue: null,
        typeName: 'TextStyle',
      }),
    );
    properties.add(
      new DiagnosticsProperty('contentTextStyle', this.contentTextStyle, {
        defaultValue: null,
        typeName: 'TextStyle',
      }),
    );
    properties.add(
      new DiagnosticsProperty('actionsPadding', this.actionsPadding, {
        defaultValue: null,
        typeName: 'EdgeInsetsGeometry',
      }),
    );
    properties.add(new ColorProperty('barrierColor', this.barrierColor, { defaultValue: null }));
    properties.add(
      new DiagnosticsProperty('insetPadding', this.insetPadding, {
        defaultValue: null,
        typeName: 'EdgeInsets',
      }),
    );
    properties.add(
      new DiagnosticsProperty('clipBehavior', this.clipBehavior, {
        defaultValue: null,
        typeName: 'Clip',
      }),
    );
    properties.add(
      new DiagnosticsProperty('constraints', this.constraints, {
        defaultValue: null,
        typeName: 'BoxConstraints',
      }),
    );
  }
}
