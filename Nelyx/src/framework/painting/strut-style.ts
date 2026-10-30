// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { FontWeight, FontStyle, TextLeadingDistribution } from '../../ui/typography.ts';
import type { TextStrutStyle } from '../../ui/text-styles.ts';
import { freezeStrutStyle } from '../../ui/text-style-validation.ts';
import { TextScaler } from './text-scaler.ts';
import type { TextStyle } from './text-style.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { protect } from '../../ui/value-math.ts';
import { RenderComparison } from './basic-types.ts';
import { valueEquals, listEquals, hashValues } from './value-equality.ts';
import { Diagnosticable } from '../../foundation/diagnosticable.ts';
import { DiagnosticsProperty, StringProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder, DiagnosticsNode } from '../../foundation/diagnostics.ts';
import {
  DoubleProperty,
  EnumProperty,
  FlagProperty,
  IterableProperty,
  MessageProperty,
} from '../../foundation/diagnostic-properties.ts';
import { objectRuntimeType } from '../../foundation/object.ts';
export interface StrutStyleOptions {
  readonly fontFamily?: string | null;
  readonly fontFamilyFallback?: readonly string[] | null;
  readonly fontSize?: number | null;
  readonly fontWeight?: FontWeight | null;
  readonly fontStyle?: FontStyle | null;
  readonly height?: number | null;
  readonly leading?: number | null;
  readonly leadingDistribution?: TextLeadingDistribution | null;
  readonly forceStrutHeight?: boolean | null;
  readonly debugLabel?: string | null;
  readonly package?: string | null;
}
export class StrutStyle extends Diagnosticable(class {}) {
  static readonly disabled = new StrutStyle({ height: 0, leading: 0 });
  readonly fontFamily: string | null;
  readonly fontSize: number | null;
  readonly fontWeight: FontWeight | null;
  readonly fontStyle: FontStyle | null;
  readonly height: number | null;
  readonly leading: number | null;
  readonly leadingDistribution: TextLeadingDistribution | null;
  readonly forceStrutHeight: boolean | null;
  readonly debugLabel: string | null;
  private readonly fallback: readonly string[] | null;
  private readonly packageName: string | null;
  readonly options: Readonly<StrutStyleOptions>;
  constructor(o: StrutStyleOptions = {}) {
    super();
    if (FoundationBuildMode.debug) {
      invariant(
        o.fontSize == null || o.fontSize > 0,
        'invalid-strut-font-size',
        'Strut font size must be positive',
      );
      invariant(
        o.leading == null || o.leading >= 0,
        'invalid-strut-leading',
        'Strut leading must be nonnegative',
      );
      invariant(
        o.package == null || o.fontFamily != null || o.fontFamilyFallback != null,
        'missing-package-font',
        'A package requires font families',
      );
    }
    this.packageName = o.package ?? null;
    this.fontFamily =
      this.packageName === null
        ? (o.fontFamily ?? null)
        : `packages/${this.packageName}/${o.fontFamily ?? 'null'}`;
    this.fallback = o.fontFamilyFallback == null ? null : Object.freeze([...o.fontFamilyFallback]);
    this.fontSize = o.fontSize ?? null;
    this.fontWeight = o.fontWeight ?? null;
    this.fontStyle = o.fontStyle ?? null;
    this.height = o.height ?? null;
    this.leading = o.leading ?? null;
    this.leadingDistribution = o.leadingDistribution ?? null;
    this.forceStrutHeight = o.forceStrutHeight ?? null;
    this.debugLabel = o.debugLabel ?? null;
    this.options = Object.freeze({
      ...o,
      ...(this.fallback ? { fontFamilyFallback: this.fallback } : {}),
    });
    if (new.target === StrutStyle) Object.freeze(this);
    else protect(this, Object.keys(this));
  }
  get fontFamilyFallback(): readonly string[] | null {
    return this.packageName !== null && this.fallback !== null
      ? Object.freeze(this.fallback.map((f) => `packages/${this.packageName}/${f}`))
      : this.fallback;
  }
  static fromTextStyle(style: TextStyle, o: StrutStyleOptions = {}): StrutStyle {
    return new StrutStyle({
      fontFamily:
        o.fontFamily != null
          ? o.package == null
            ? o.fontFamily
            : `packages/${o.package}/${o.fontFamily}`
          : style.fontFamily,
      fontFamilyFallback: o.fontFamilyFallback ?? style.fontFamilyFallback,
      fontSize: o.fontSize ?? style.fontSize,
      height: o.height ?? style.height,
      leadingDistribution: o.leadingDistribution ?? style.leadingDistribution,
      leading: o.leading ?? null,
      fontWeight: o.fontWeight ?? style.fontWeight,
      fontStyle: o.fontStyle ?? style.fontStyle,
      forceStrutHeight: o.forceStrutHeight ?? null,
      debugLabel: o.debugLabel ?? style.debugLabel,
      package: o.package ?? null,
    });
  }
  compareTo(other: StrutStyle): RenderComparison {
    if (this === other) return RenderComparison.identical;
    return this.fontFamily !== other.fontFamily ||
      this.fontSize !== other.fontSize ||
      !valueEquals(this.fontWeight, other.fontWeight) ||
      this.fontStyle !== other.fontStyle ||
      this.height !== other.height ||
      this.leading !== other.leading ||
      this.forceStrutHeight !== other.forceStrutHeight ||
      !listEquals(this.fontFamilyFallback, other.fontFamilyFallback) ||
      (this.height !== null && this.leadingDistribution !== other.leadingDistribution)
      ? RenderComparison.layout
      : RenderComparison.identical;
  }
  inheritFromTextStyle(other: TextStyle | null): StrutStyle {
    if (other === null) return this;
    const height = this.height ?? other.height;
    return new StrutStyle({
      fontFamily: this.fontFamily ?? other.fontFamily,
      fontFamilyFallback: this.fontFamilyFallback ?? other.fontFamilyFallback,
      fontSize: this.fontSize ?? other.fontSize,
      height,
      leading: this.leading,
      fontWeight: this.fontWeight ?? other.fontWeight,
      fontStyle: this.fontStyle ?? other.fontStyle,
      forceStrutHeight: this.forceStrutHeight,
      debugLabel: this.debugLabel ?? other.debugLabel,
      leadingDistribution:
        height !== null ? (this.leadingDistribution ?? other.leadingDistribution) : null,
    });
  }
  merge(other: StrutStyle | null): StrutStyle {
    if (other === null) return this;
    return new StrutStyle({
      fontFamily: other.fontFamily ?? this.fontFamily,
      fontFamilyFallback: other.fontFamilyFallback ?? this.fontFamilyFallback,
      fontSize: other.fontSize ?? this.fontSize,
      height: other.height ?? this.height,
      leadingDistribution: other.leadingDistribution ?? this.leadingDistribution,
      leading: other.leading ?? this.leading,
      fontWeight: other.fontWeight ?? this.fontWeight,
      fontStyle: other.fontStyle ?? this.fontStyle,
      forceStrutHeight: other.forceStrutHeight ?? this.forceStrutHeight,
      debugLabel: other.debugLabel ?? this.debugLabel,
      package: other.packageName ?? this.packageName,
    });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof StrutStyle &&
        other.constructor === this.constructor &&
        this.compareTo(other) === RenderComparison.identical)
    );
  }
  get hashCode(): number {
    return hashValues(
      this.fontFamily,
      this.fontSize,
      this.fontWeight?.value ?? null,
      this.fontStyle,
      this.height,
      this.leading,
      this.forceStrutHeight,
    );
  }
  override toStringShort(): string {
    return objectRuntimeType(this, 'StrutStyle');
  }
  override debugFillProperties(
    properties: DiagnosticPropertiesBuilder,
    { prefix = '' }: { readonly prefix?: string } = {},
  ): void {
    super.debugFillProperties(properties);
    if (this.debugLabel !== null)
      properties.add(new MessageProperty(prefix + 'debugLabel', this.debugLabel));
    const styles: DiagnosticsNode[] = [
      new StringProperty(prefix + 'family', this.fontFamily, { defaultValue: null, quoted: false }),
      new IterableProperty(prefix + 'familyFallback', this.fontFamilyFallback, {
        defaultValue: null,
        elementType: 'String',
      }),
      new DoubleProperty(prefix + 'size', this.fontSize, { defaultValue: null }),
      new DiagnosticsProperty(prefix + 'weight', this.fontWeight, {
        description: this.fontWeight ? `w${this.fontWeight.index + 1}00` : null,
        defaultValue: null,
      }),
      new EnumProperty(prefix + 'style', this.fontStyle, { defaultValue: null }),
      new DoubleProperty(prefix + 'height', this.height, { unit: 'x', defaultValue: null }),
      new FlagProperty(prefix + 'forceStrutHeight', this.forceStrutHeight, {
        ifTrue: prefix + '<strut height forced>',
        ifFalse: prefix + '<strut height normal>',
      }),
    ];
    if (this.height !== null)
      styles.push(
        new EnumProperty(prefix + 'leadingDistribution', this.leadingDistribution, {
          defaultValue: null,
        }),
      );
    const specified = styles.some((node) => !node.isFiltered('info'));
    for (const node of styles) properties.add(node);
    if (!specified)
      properties.add(
        new FlagProperty('forceStrutHeight', this.forceStrutHeight, {
          ifTrue: prefix + '<strut height forced>',
          ifFalse: prefix + '<strut height normal>',
        }),
      );
  }
  /** Engine DTO conversion is the admission boundary for backend numeric budgets. */
  toStyle(scaler: TextScaler = TextScaler.noScaling): TextStrutStyle {
    return freezeStrutStyle({
      ...(this.fontFamily || this.fontFamilyFallback
        ? {
            fontFamilies: [
              ...(this.fontFamily ? [this.fontFamily] : []),
              ...(this.fontFamilyFallback ?? []),
            ],
          }
        : {}),
      ...(this.fontSize !== null ? { fontSize: scaler.scale(this.fontSize) } : {}),
      ...(this.fontWeight ? { fontWeight: this.fontWeight.value } : {}),
      ...(this.fontStyle ? { fontStyle: this.fontStyle } : {}),
      ...(this.height !== null ? { height: this.height } : {}),
      ...(this.leading !== null ? { leading: this.leading } : {}),
      ...(this.leadingDistribution ? { leadingDistribution: this.leadingDistribution } : {}),
      ...(this.forceStrutHeight !== null ? { forceStrutHeight: this.forceStrutHeight } : {}),
    });
  }
}
