// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Color } from '@nelyx/core/ui/color';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { PopupMenuPosition } from './popup-menu-position.ts';
import { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { lerpTextStyleProperty } from './internal/theme/value-interpolation.ts';
import { lerpDouble } from '@nelyx/core/internal/ui/lerp-double.generated';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { DoubleProperty, EnumProperty } from '@nelyx/core/foundation/diagnostic-properties';
import { ColorProperty } from '@nelyx/core/internal/framework/painting/color-property.generated';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
export interface PopupMenuThemeDataOptions {
  readonly color?: Color | null;
  readonly shape?: ShapeBorder | null;
  readonly menuPadding?: EdgeInsetsGeometry | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly textStyle?: TextStyle | null;
  readonly labelTextStyle?: WidgetStateProperty<TextStyle | null> | null;
  readonly enableFeedback?: boolean | null;
  readonly mouseCursor?: WidgetStateProperty<MouseCursor | null> | null;
  readonly position?: PopupMenuPosition | null;
  readonly iconColor?: Color | null;
  /** @dartType double? */
  readonly iconSize?: number | null;
}
type Values = {
  readonly [K in keyof Required<PopupMenuThemeDataOptions>]: Exclude<
    PopupMenuThemeDataOptions[K],
    undefined
  >;
};
export class PopupMenuThemeData extends Diagnosticable(class {}) {
  private readonly values: Values;
  get color(): Color | null {
    return this.values.color;
  }
  get shape(): ShapeBorder | null {
    return this.values.shape;
  }
  get menuPadding(): EdgeInsetsGeometry | null {
    return this.values.menuPadding;
  }
  /** @dartType double? */
  get elevation(): number | null {
    return this.values.elevation;
  }
  get shadowColor(): Color | null {
    return this.values.shadowColor;
  }
  get surfaceTintColor(): Color | null {
    return this.values.surfaceTintColor;
  }
  get textStyle(): TextStyle | null {
    return this.values.textStyle;
  }
  get labelTextStyle(): WidgetStateProperty<TextStyle | null> | null {
    return this.values.labelTextStyle;
  }
  get enableFeedback(): boolean | null {
    return this.values.enableFeedback;
  }
  get mouseCursor(): WidgetStateProperty<MouseCursor | null> | null {
    return this.values.mouseCursor;
  }
  get position(): PopupMenuPosition | null {
    return this.values.position;
  }
  get iconColor(): Color | null {
    return this.values.iconColor;
  }
  /** @dartType double? */
  get iconSize(): number | null {
    return this.values.iconSize;
  }
  /** @dartParam elevation double?
   * @dartParam iconSize double? */
  constructor(options: PopupMenuThemeDataOptions = {}) {
    super();
    this.values = Object.freeze({
      color: options.color ?? null,
      shape: options.shape ?? null,
      menuPadding: options.menuPadding ?? null,
      elevation: options.elevation ?? null,
      shadowColor: options.shadowColor ?? null,
      surfaceTintColor: options.surfaceTintColor ?? null,
      textStyle: options.textStyle ?? null,
      labelTextStyle: options.labelTextStyle ?? null,
      enableFeedback: options.enableFeedback ?? null,
      mouseCursor: options.mouseCursor ?? null,
      position: options.position ?? null,
      iconColor: options.iconColor ?? null,
      iconSize: options.iconSize ?? null,
    });
    if (this.position !== null && !PopupMenuPosition.values.includes(this.position))
      throw new TypeError('Expected a canonical PopupMenuPosition');
    if (new.target === PopupMenuThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double?
   * @dartParam iconSize double? */
  copyWith(options: PopupMenuThemeDataOptions = {}): PopupMenuThemeData {
    return new PopupMenuThemeData({
      color: options.color ?? this.color,
      shape: options.shape ?? this.shape,
      menuPadding: options.menuPadding ?? this.menuPadding,
      elevation: options.elevation ?? this.elevation,
      shadowColor: options.shadowColor ?? this.shadowColor,
      surfaceTintColor: options.surfaceTintColor ?? this.surfaceTintColor,
      textStyle: options.textStyle ?? this.textStyle,
      labelTextStyle: options.labelTextStyle ?? this.labelTextStyle,
      enableFeedback: options.enableFeedback ?? this.enableFeedback,
      mouseCursor: options.mouseCursor ?? this.mouseCursor,
      position: options.position ?? this.position,
      iconColor: options.iconColor ?? this.iconColor,
      iconSize: options.iconSize ?? this.iconSize,
    });
  }
  /** @dartParam t double */
  static lerp(
    a: PopupMenuThemeData | null,
    b: PopupMenuThemeData | null,
    t: number,
  ): PopupMenuThemeData | null {
    if (a === b) {
      return a;
    }
    return new PopupMenuThemeData({
      color: Color.lerp(a?.color ?? null, b?.color ?? null, t),
      shape: ShapeBorder.lerp(a?.shape ?? null, b?.shape ?? null, t),
      menuPadding: EdgeInsetsGeometry.lerp(a?.menuPadding ?? null, b?.menuPadding ?? null, t),
      elevation: lerpDouble(a?.elevation ?? null, b?.elevation ?? null, t),
      shadowColor: Color.lerp(a?.shadowColor ?? null, b?.shadowColor ?? null, t),
      surfaceTintColor: Color.lerp(a?.surfaceTintColor ?? null, b?.surfaceTintColor ?? null, t),
      textStyle: TextStyle.lerp(a?.textStyle ?? null, b?.textStyle ?? null, t),
      labelTextStyle: lerpTextStyleProperty(
        a?.labelTextStyle ?? null,
        b?.labelTextStyle ?? null,
        t,
      ),
      enableFeedback: t < 0.5 ? (a?.enableFeedback ?? null) : (b?.enableFeedback ?? null),
      mouseCursor: t < 0.5 ? (a?.mouseCursor ?? null) : (b?.mouseCursor ?? null),
      position: t < 0.5 ? (a?.position ?? null) : (b?.position ?? null),
      iconColor: Color.lerp(a?.iconColor ?? null, b?.iconColor ?? null, t),
      iconSize: lerpDouble(a?.iconSize ?? null, b?.iconSize ?? null, t),
    });
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof PopupMenuThemeData) || other.constructor !== this.constructor)
      return false;
    return (
      valueEquals(this.color, other.color) &&
      valueEquals(this.shape, other.shape) &&
      valueEquals(this.menuPadding, other.menuPadding) &&
      valueEquals(this.elevation, other.elevation) &&
      valueEquals(this.shadowColor, other.shadowColor) &&
      valueEquals(this.surfaceTintColor, other.surfaceTintColor) &&
      valueEquals(this.textStyle, other.textStyle) &&
      valueEquals(this.labelTextStyle, other.labelTextStyle) &&
      valueEquals(this.enableFeedback, other.enableFeedback) &&
      valueEquals(this.mouseCursor, other.mouseCursor) &&
      valueEquals(this.position, other.position) &&
      valueEquals(this.iconColor, other.iconColor) &&
      valueEquals(this.iconSize, other.iconSize)
    );
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.color,
      this.shape,
      this.menuPadding,
      this.elevation,
      this.shadowColor,
      this.surfaceTintColor,
      this.textStyle,
      this.labelTextStyle,
      this.enableFeedback,
      this.mouseCursor,
      this.position,
      this.iconColor,
      this.iconSize,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new ColorProperty('color', this.color, { defaultValue: null }));
    properties.add(
      new DiagnosticsProperty('shape', this.shape, { defaultValue: null, typeName: 'ShapeBorder' }),
    );
    properties.add(
      new DiagnosticsProperty('menuPadding', this.menuPadding, {
        defaultValue: null,
        typeName: 'EdgeInsetsGeometry',
      }),
    );
    properties.add(new DoubleProperty('elevation', this.elevation, { defaultValue: null }));
    properties.add(new ColorProperty('shadowColor', this.shadowColor, { defaultValue: null }));
    properties.add(
      new ColorProperty('surfaceTintColor', this.surfaceTintColor, { defaultValue: null }),
    );
    properties.add(
      new DiagnosticsProperty('text style', this.textStyle, {
        defaultValue: null,
        typeName: 'TextStyle',
      }),
    );
    properties.add(
      new DiagnosticsProperty('labelTextStyle', this.labelTextStyle, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<TextStyle?>',
      }),
    );
    properties.add(
      new DiagnosticsProperty('enableFeedback', this.enableFeedback, {
        defaultValue: null,
        typeName: 'bool',
      }),
    );
    properties.add(
      new DiagnosticsProperty('mouseCursor', this.mouseCursor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<MouseCursor?>',
      }),
    );
    properties.add(
      new EnumProperty('position', this.position, {
        defaultValue: null,
        typeName: 'PopupMenuPosition?',
      }),
    );
    properties.add(new ColorProperty('iconColor', this.iconColor, { defaultValue: null }));
    properties.add(new DoubleProperty('iconSize', this.iconSize, { defaultValue: null }));
  }
}
