// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Color } from '@nelyx/core/ui/color';
import type { StrokeCap } from '@nelyx/core/ui/paint';
import { BorderRadiusGeometry } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { DoubleProperty } from '@nelyx/core/foundation/diagnostic-properties';
import { ColorProperty } from '@nelyx/core/framework/painting/color-property';
export interface ProgressIndicatorThemeOptions {
  readonly color?: Color | null;
  readonly linearTrackColor?: Color | null;
  readonly circularTrackColor?: Color | null;
  readonly refreshBackgroundColor?: Color | null;
  readonly stopIndicatorColor?: Color | null;
  /** @dartType double? */ readonly linearMinHeight?: number | null;
  /** @dartType double? */ readonly stopIndicatorRadius?: number | null;
  /** @dartType double? */ readonly strokeWidth?: number | null;
  /** @dartType double? */ readonly strokeAlign?: number | null;
  /** @dartType double? */ readonly trackGap?: number | null;
  readonly borderRadius?: BorderRadiusGeometry | null;
  readonly strokeCap?: StrokeCap | null;
  readonly constraints?: BoxConstraints | null;
  readonly circularTrackPadding?: EdgeInsetsGeometry | null;
  readonly year2023?: boolean | null;
  readonly controller?: AnimationController | null;
}
const colorFields = [
    'color',
    'linearTrackColor',
    'circularTrackColor',
    'refreshBackgroundColor',
    'stopIndicatorColor',
  ] as const,
  numberFields = [
    'linearMinHeight',
    'stopIndicatorRadius',
    'strokeWidth',
    'strokeAlign',
    'trackGap',
  ] as const;
const themeFields = [
  'color',
  'linearTrackColor',
  'linearMinHeight',
  'circularTrackColor',
  'refreshBackgroundColor',
  'borderRadius',
  'stopIndicatorColor',
  'stopIndicatorRadius',
  'strokeAlign',
  'strokeWidth',
  'strokeCap',
  'constraints',
  'trackGap',
  'circularTrackPadding',
  'year2023',
  'controller',
] as const;
export class ProgressIndicatorThemeData extends Diagnosticable(class {}) {
  readonly color: Color | null;
  readonly linearTrackColor: Color | null;
  readonly circularTrackColor: Color | null;
  readonly refreshBackgroundColor: Color | null;
  readonly stopIndicatorColor: Color | null;
  /** @dartType double? */ readonly linearMinHeight: number | null;
  /** @dartType double? */ readonly stopIndicatorRadius: number | null;
  /** @dartType double? */ readonly strokeWidth: number | null;
  /** @dartType double? */ readonly strokeAlign: number | null;
  /** @dartType double? */ readonly trackGap: number | null;
  readonly borderRadius: BorderRadiusGeometry | null;
  readonly strokeCap: StrokeCap | null;
  readonly constraints: BoxConstraints | null;
  readonly circularTrackPadding: EdgeInsetsGeometry | null;
  readonly year2023: boolean | null;
  readonly controller: AnimationController | null;
  /** @dartParam linearMinHeight double?
   * @dartParam stopIndicatorRadius double?
   * @dartParam strokeWidth double?
   * @dartParam strokeAlign double?
   * @dartParam trackGap double? */
  constructor(options: ProgressIndicatorThemeOptions = {}) {
    super();
    this.color = options.color ?? null;
    this.linearTrackColor = options.linearTrackColor ?? null;
    this.circularTrackColor = options.circularTrackColor ?? null;
    this.refreshBackgroundColor = options.refreshBackgroundColor ?? null;
    this.stopIndicatorColor = options.stopIndicatorColor ?? null;
    this.linearMinHeight = options.linearMinHeight ?? null;
    this.stopIndicatorRadius = options.stopIndicatorRadius ?? null;
    this.strokeWidth = options.strokeWidth ?? null;
    this.strokeAlign = options.strokeAlign ?? null;
    this.trackGap = options.trackGap ?? null;
    this.borderRadius = options.borderRadius ?? null;
    this.strokeCap = options.strokeCap ?? null;
    this.constraints = options.constraints ?? null;
    this.circularTrackPadding = options.circularTrackPadding ?? null;
    this.year2023 = options.year2023 ?? null;
    this.controller = options.controller ?? null;
    if (new.target === ProgressIndicatorThemeData) Object.freeze(this);
  }
  /** @dartParam linearMinHeight double?
   * @dartParam stopIndicatorRadius double?
   * @dartParam strokeWidth double?
   * @dartParam strokeAlign double?
   * @dartParam trackGap double? */
  copyWith(options: ProgressIndicatorThemeOptions = {}): ProgressIndicatorThemeData {
    return new ProgressIndicatorThemeData({
      ...this,
      ...Object.fromEntries(Object.entries(options).filter(([, v]) => v != null)),
    });
  }
  equals(other: unknown): boolean {
    return (
      other instanceof ProgressIndicatorThemeData &&
      other.constructor === this.constructor &&
      themeFields.every((key) => valueEquals(this[key], other[key]))
    );
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.color,
      this.linearTrackColor,
      this.linearMinHeight,
      this.circularTrackColor,
      this.refreshBackgroundColor,
      this.borderRadius,
      this.stopIndicatorColor,
      this.stopIndicatorRadius,
      this.strokeAlign,
      this.strokeWidth,
      this.strokeCap,
      this.constraints,
      this.trackGap,
      this.circularTrackPadding,
      this.year2023,
      this.controller,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    const o = { defaultValue: null };
    properties.add(new ColorProperty('color', this.color, o));
    properties.add(new ColorProperty('linearTrackColor', this.linearTrackColor, o));
    properties.add(new DoubleProperty('linearMinHeight', this.linearMinHeight, o));
    properties.add(new ColorProperty('circularTrackColor', this.circularTrackColor, o));
    properties.add(new ColorProperty('refreshBackgroundColor', this.refreshBackgroundColor, o));
    properties.add(
      new DiagnosticsProperty('borderRadius', this.borderRadius, {
        ...o,
        typeName: 'BorderRadiusGeometry',
      }),
    );
    properties.add(new ColorProperty('stopIndicatorColor', this.stopIndicatorColor, o));
    properties.add(new DoubleProperty('stopIndicatorRadius', this.stopIndicatorRadius, o));
    properties.add(new DoubleProperty('strokeWidth', this.strokeWidth, o));
    properties.add(new DoubleProperty('strokeAlign', this.strokeAlign, o));
    properties.add(
      new DiagnosticsProperty('strokeCap', this.strokeCap, { ...o, typeName: 'StrokeCap' }),
    );
    properties.add(
      new DiagnosticsProperty('constraints', this.constraints, {
        ...o,
        typeName: 'BoxConstraints',
      }),
    );
    properties.add(new DoubleProperty('trackGap', this.trackGap, o));
    properties.add(
      new DiagnosticsProperty('circularTrackPadding', this.circularTrackPadding, {
        ...o,
        typeName: 'EdgeInsetsGeometry',
      }),
    );
    properties.add(new DiagnosticsProperty('year2023', this.year2023, { ...o, typeName: 'bool' }));
    properties.add(
      new DiagnosticsProperty('controller', this.controller, {
        ...o,
        typeName: 'AnimationController',
      }),
    );
  }
  /** @dartParam t double */
  static lerp(
    a: ProgressIndicatorThemeData | null,
    b: ProgressIndicatorThemeData | null,
    t: number,
  ): ProgressIndicatorThemeData | null {
    if (a === b) return a;
    const colors = Object.fromEntries(
        colorFields.map((f) => [f, Color.lerp(a?.[f] ?? null, b?.[f] ?? null, t)]),
      ),
      numbers = Object.fromEntries(
        numberFields.map((f) => {
          const x = a?.[f] ?? null,
            y = b?.[f] ?? null;
          return [f, x === null && y === null ? null : (x ?? 0) * (1 - t) + (y ?? 0) * t];
        }),
      );
    return new ProgressIndicatorThemeData({
      ...colors,
      ...numbers,
      borderRadius: BorderRadiusGeometry.lerp(a?.borderRadius ?? null, b?.borderRadius ?? null, t),
      constraints: BoxConstraints.lerp(a?.constraints, b?.constraints, t),
      circularTrackPadding: EdgeInsetsGeometry.lerp(
        a?.circularTrackPadding ?? null,
        b?.circularTrackPadding ?? null,
        t,
      ),
      strokeCap: t < 0.5 ? (a?.strokeCap ?? null) : (b?.strokeCap ?? null),
      year2023: t < 0.5 ? (a?.year2023 ?? null) : (b?.year2023 ?? null),
      controller: t < 0.5 ? (a?.controller ?? null) : (b?.controller ?? null),
    });
  }
}
