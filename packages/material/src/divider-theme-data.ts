// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional port of pinned Flutter divider_theme.dart on canonical Core values.
import { Color } from '@nelyx/core/ui/color';
import { BorderRadiusGeometry } from '@nelyx/core/framework/painting/border-radius';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { DoubleProperty } from '@nelyx/core/foundation/diagnostic-properties';
import { ColorProperty } from '@nelyx/core/framework/painting/color-property';

export interface DividerThemeDataOptions {
  readonly color?: Color | null;
  /** @dartType double? */ readonly space?: number | null;
  /** @dartType double? */ readonly thickness?: number | null;
  /** @dartType double? */ readonly indent?: number | null;
  /** @dartType double? */ readonly endIndent?: number | null;
  readonly radius?: BorderRadiusGeometry | null;
}

const numericFields = ['space', 'thickness', 'indent', 'endIndent'] as const;

const fields = ['color', ...numericFields, 'radius'] as const;

export class DividerThemeData extends Diagnosticable(class {}) {
  readonly color: Color | null;
  /** @dartType double? */ readonly space: number | null;
  /** @dartType double? */ readonly thickness: number | null;
  /** @dartType double? */ readonly indent: number | null;
  /** @dartType double? */ readonly endIndent: number | null;
  readonly radius: BorderRadiusGeometry | null;
  /**
   * @dartParam space double?
   * @dartParam thickness double?
   * @dartParam indent double?
   * @dartParam endIndent double?
   */
  constructor(o: DividerThemeDataOptions = {}) {
    super();
    this.color = o.color ?? null;
    this.space = o.space ?? null;
    this.thickness = o.thickness ?? null;
    this.indent = o.indent ?? null;
    this.endIndent = o.endIndent ?? null;
    this.radius = o.radius ?? null;
    if (new.target === DividerThemeData) Object.freeze(this);
  }
  /**
   * @dartParam space double?
   * @dartParam thickness double?
   * @dartParam indent double?
   * @dartParam endIndent double?
   */
  copyWith(o: DividerThemeDataOptions = {}): DividerThemeData {
    return new DividerThemeData({
      color: o.color ?? this.color,
      space: o.space ?? this.space,
      thickness: o.thickness ?? this.thickness,
      indent: o.indent ?? this.indent,
      endIndent: o.endIndent ?? this.endIndent,
      radius: o.radius ?? this.radius,
    });
  }
  /** @dartParam t double */
  static lerp(a: DividerThemeData | null, b: DividerThemeData | null, t: number): DividerThemeData {
    if (a === b && a !== null) return a;
    const number = (x: number | null, y: number | null): number | null =>
      x === y ? x : (x ?? 0) * (1 - t) + (y ?? 0) * t;
    return new DividerThemeData({
      color: Color.lerp(a?.color ?? null, b?.color ?? null, t),
      space: number(a?.space ?? null, b?.space ?? null),
      thickness: number(a?.thickness ?? null, b?.thickness ?? null),
      indent: number(a?.indent ?? null, b?.indent ?? null),
      endIndent: number(a?.endIndent ?? null, b?.endIndent ?? null),
      radius: BorderRadiusGeometry.lerp(a?.radius ?? null, b?.radius ?? null, t),
    });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof DividerThemeData &&
        other.constructor === this.constructor &&
        fields.every((f) => valueEquals(this[f], other[f])))
    );
  }
  /** @dartType int */ get hashCode(): number {
    return hashValues(...fields.map((f) => this[f]));
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new ColorProperty('color', this.color, { defaultValue: null }));
    for (const f of numericFields)
      properties.add(new DoubleProperty(f, this[f], { defaultValue: null }));
    properties.add(
      new DiagnosticsProperty('radius', this.radius, {
        defaultValue: null,
        typeName: 'BorderRadiusGeometry',
      }),
    );
  }
}
