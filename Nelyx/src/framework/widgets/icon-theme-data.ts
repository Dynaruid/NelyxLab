// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned widgets/icon_theme_data.dart on existing Core Color/Shadow/diagnostic owners.
import { Color } from '../../ui/color.ts';
import { Shadow } from '../../ui/shadow.ts';
import { clampDouble } from '../../ui/math.ts';
import { Diagnosticable } from '../../foundation/diagnosticable.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import { DoubleProperty, IterableProperty } from '../../foundation/diagnostic-properties.ts';
import { ColorProperty } from '../painting/color-property.generated.ts';
import { valueEquals, listEquals, hashValues } from '../painting/value-equality.ts';
import type { BuildContext } from './framework.ts';
import { invariant } from '../../foundation/errors.ts';
export interface IconThemeDataOptions {
  readonly size?: number | null;
  readonly fill?: number | null;
  readonly weight?: number | null;
  readonly grade?: number | null;
  readonly opticalSize?: number | null;
  readonly color?: Color | null;
  readonly opacity?: number | null;
  readonly shadows?: readonly Shadow[] | null;
  readonly applyTextScaling?: boolean | null;
}
const numericFields = ['size', 'fill', 'weight', 'grade', 'opticalSize'] as const;
export class IconThemeData extends Diagnosticable(class {}) {
  readonly size: number | null;
  readonly fill: number | null;
  readonly weight: number | null;
  readonly grade: number | null;
  readonly opticalSize: number | null;
  readonly color: Color | null;
  private readonly rawOpacity: number | null;
  readonly shadows: readonly Shadow[] | null;
  readonly applyTextScaling: boolean | null;
  constructor({
    size = null,
    fill = null,
    weight = null,
    grade = null,
    opticalSize = null,
    color = null,
    opacity = null,
    shadows = null,
    applyTextScaling = null,
  }: IconThemeDataOptions = {}) {
    super();
    invariant(
      fill === null || (fill >= 0 && fill <= 1),
      'invalid-icon-fill',
      'Icon fill must be within [0,1]',
    );
    invariant(weight === null || weight > 0, 'invalid-icon-weight', 'Icon weight must be positive');
    invariant(
      opticalSize === null || opticalSize > 0,
      'invalid-icon-optical-size',
      'Icon optical size must be positive',
    );
    this.size = size;
    this.fill = fill;
    this.weight = weight;
    this.grade = grade;
    this.opticalSize = opticalSize;
    this.color = color;
    this.rawOpacity = opacity;
    this.shadows = shadows;
    this.applyTextScaling = applyTextScaling;
    if (new.target === IconThemeData) Object.freeze(this);
  }
  static fallback(): IconThemeData {
    return new IconThemeData({
      size: 24,
      fill: 0,
      weight: 400,
      grade: 0,
      opticalSize: 48,
      color: new Color(0xff000000),
      opacity: 1,
      applyTextScaling: false,
    });
  }
  get opacity(): number | null {
    return this.rawOpacity === null ? null : clampDouble(this.rawOpacity, 0, 1);
  }
  get isConcrete(): boolean {
    return (
      numericFields.every((f) => this[f] !== null) &&
      this.color !== null &&
      this.opacity !== null &&
      this.applyTextScaling !== null
    );
  }
  copyWith(options: IconThemeDataOptions = {}): IconThemeData {
    return new IconThemeData({
      ...Object.fromEntries(numericFields.map((f) => [f, options[f] ?? this[f]])),
      color: options.color ?? this.color,
      opacity: options.opacity ?? this.opacity,
      shadows: options.shadows ?? this.shadows,
      applyTextScaling: options.applyTextScaling ?? this.applyTextScaling,
    });
  }
  merge(other: IconThemeData | null): IconThemeData {
    return other === null ? this : this.copyWith(other);
  }
  resolve(_context: BuildContext): IconThemeData {
    return this;
  }
  static lerp(a: IconThemeData | null, b: IconThemeData | null, t: number): IconThemeData {
    if (a === b && a !== null) return a;
    const number = (x: number | null, y: number | null) =>
      x === y
        ? x
        : x === null
          ? y === null
            ? null
            : y * t
          : y === null
            ? x * (1 - t)
            : x * (1 - t) + y * t;
    return new IconThemeData({
      ...Object.fromEntries(numericFields.map((f) => [f, number(a?.[f] ?? null, b?.[f] ?? null)])),
      color: Color.lerp(a?.color ?? null, b?.color ?? null, t),
      opacity: number(a?.opacity ?? null, b?.opacity ?? null),
      shadows: Shadow.lerpList(a?.shadows ?? null, b?.shadows ?? null, t),
      applyTextScaling: t < 0.5 ? (a?.applyTextScaling ?? null) : (b?.applyTextScaling ?? null),
    });
  }
  equals(other: unknown): boolean {
    return (
      other instanceof IconThemeData &&
      other.constructor === this.constructor &&
      numericFields.every((f) => other[f] === this[f]) &&
      valueEquals(other.color, this.color) &&
      other.opacity === this.opacity &&
      listEquals(other.shadows, this.shadows) &&
      other.applyTextScaling === this.applyTextScaling
    );
  }
  get hashCode(): number {
    return hashValues(
      ...numericFields.map((f) => this[f]),
      this.color,
      this.opacity,
      this.shadows === null ? null : hashValues(...this.shadows),
      this.applyTextScaling,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    for (const f of numericFields)
      properties.add(new DoubleProperty(f, this[f], { defaultValue: null }));
    properties.add(new ColorProperty('color', this.color, { defaultValue: null }));
    properties.add(new DoubleProperty('opacity', this.opacity, { defaultValue: null }));
    properties.add(
      new IterableProperty('shadows', this.shadows, { defaultValue: null, elementType: 'Shadow' }),
    );
    properties.add(
      new DiagnosticsProperty('applyTextScaling', this.applyTextScaling, {
        defaultValue: null,
        typeName: 'bool',
      }),
    );
  }
}
