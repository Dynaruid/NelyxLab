// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import type { AnimationStyle } from '@nelyx/core/framework/animation/animation-style';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import '@nelyx/core/foundation/diagnostic-properties';
import { ColorProperty } from '@nelyx/core/internal/framework/painting/color-property.generated';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
export interface ExpansionTileThemeDataOptions {
  readonly backgroundColor?: Color | null;
  readonly collapsedBackgroundColor?: Color | null;
  readonly tilePadding?: EdgeInsetsGeometry | null;
  readonly expandedAlignment?: AlignmentGeometry | null;
  readonly childrenPadding?: EdgeInsetsGeometry | null;
  readonly iconColor?: Color | null;
  readonly collapsedIconColor?: Color | null;
  readonly textColor?: Color | null;
  readonly collapsedTextColor?: Color | null;
  readonly shape?: ShapeBorder | null;
  readonly collapsedShape?: ShapeBorder | null;
  readonly clipBehavior?: Clip | null;
  readonly expansionAnimationStyle?: AnimationStyle | null;
}
export class ExpansionTileThemeData extends Diagnosticable(class {}) {
  readonly backgroundColor: Color | null;
  readonly collapsedBackgroundColor: Color | null;
  readonly tilePadding: EdgeInsetsGeometry | null;
  readonly expandedAlignment: AlignmentGeometry | null;
  readonly childrenPadding: EdgeInsetsGeometry | null;
  readonly iconColor: Color | null;
  readonly collapsedIconColor: Color | null;
  readonly textColor: Color | null;
  readonly collapsedTextColor: Color | null;
  readonly shape: ShapeBorder | null;
  readonly collapsedShape: ShapeBorder | null;
  readonly clipBehavior: Clip | null;
  readonly expansionAnimationStyle: AnimationStyle | null;
  constructor(options: ExpansionTileThemeDataOptions = {}) {
    super();
    this.backgroundColor = options.backgroundColor ?? null;
    this.collapsedBackgroundColor = options.collapsedBackgroundColor ?? null;
    this.tilePadding = options.tilePadding ?? null;
    this.expandedAlignment = options.expandedAlignment ?? null;
    this.childrenPadding = options.childrenPadding ?? null;
    this.iconColor = options.iconColor ?? null;
    this.collapsedIconColor = options.collapsedIconColor ?? null;
    this.textColor = options.textColor ?? null;
    this.collapsedTextColor = options.collapsedTextColor ?? null;
    this.shape = options.shape ?? null;
    this.collapsedShape = options.collapsedShape ?? null;
    this.clipBehavior = options.clipBehavior ?? null;
    this.expansionAnimationStyle = options.expansionAnimationStyle ?? null;
    if (new.target === ExpansionTileThemeData) Object.freeze(this);
  }
  copyWith(options: ExpansionTileThemeDataOptions = {}): ExpansionTileThemeData {
    return new ExpansionTileThemeData({
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      collapsedBackgroundColor: options.collapsedBackgroundColor ?? this.collapsedBackgroundColor,
      tilePadding: options.tilePadding ?? this.tilePadding,
      expandedAlignment: options.expandedAlignment ?? this.expandedAlignment,
      childrenPadding: options.childrenPadding ?? this.childrenPadding,
      iconColor: options.iconColor ?? this.iconColor,
      collapsedIconColor: options.collapsedIconColor ?? this.collapsedIconColor,
      textColor: options.textColor ?? this.textColor,
      collapsedTextColor: options.collapsedTextColor ?? this.collapsedTextColor,
      shape: options.shape ?? this.shape,
      collapsedShape: options.collapsedShape ?? this.collapsedShape,
      clipBehavior: options.clipBehavior ?? this.clipBehavior,
      expansionAnimationStyle: options.expansionAnimationStyle ?? this.expansionAnimationStyle,
    });
  }
  /** @dartParam t double */
  static lerp(
    a: ExpansionTileThemeData | null,
    b: ExpansionTileThemeData | null,
    t: number,
  ): ExpansionTileThemeData | null {
    if (a === b) {
      return a;
    }
    return new ExpansionTileThemeData({
      backgroundColor: Color.lerp(a?.backgroundColor ?? null, b?.backgroundColor ?? null, t),
      collapsedBackgroundColor: Color.lerp(
        a?.collapsedBackgroundColor ?? null,
        b?.collapsedBackgroundColor ?? null,
        t,
      ),
      tilePadding: EdgeInsetsGeometry.lerp(a?.tilePadding ?? null, b?.tilePadding ?? null, t),
      expandedAlignment: AlignmentGeometry.lerp(
        a?.expandedAlignment ?? null,
        b?.expandedAlignment ?? null,
        t,
      ),
      childrenPadding: EdgeInsetsGeometry.lerp(
        a?.childrenPadding ?? null,
        b?.childrenPadding ?? null,
        t,
      ),
      iconColor: Color.lerp(a?.iconColor ?? null, b?.iconColor ?? null, t),
      collapsedIconColor: Color.lerp(
        a?.collapsedIconColor ?? null,
        b?.collapsedIconColor ?? null,
        t,
      ),
      textColor: Color.lerp(a?.textColor ?? null, b?.textColor ?? null, t),
      collapsedTextColor: Color.lerp(
        a?.collapsedTextColor ?? null,
        b?.collapsedTextColor ?? null,
        t,
      ),
      shape: ShapeBorder.lerp(a?.shape ?? null, b?.shape ?? null, t),
      collapsedShape: ShapeBorder.lerp(a?.collapsedShape ?? null, b?.collapsedShape ?? null, t),
      clipBehavior: t < 0.5 ? (a?.clipBehavior ?? null) : (b?.clipBehavior ?? null),
      expansionAnimationStyle:
        t < 0.5 ? (a?.expansionAnimationStyle ?? null) : (b?.expansionAnimationStyle ?? null),
    });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof ExpansionTileThemeData &&
        other.constructor === this.constructor &&
        valueEquals(this.backgroundColor, other.backgroundColor) &&
        valueEquals(this.collapsedBackgroundColor, other.collapsedBackgroundColor) &&
        valueEquals(this.tilePadding, other.tilePadding) &&
        valueEquals(this.expandedAlignment, other.expandedAlignment) &&
        valueEquals(this.childrenPadding, other.childrenPadding) &&
        valueEquals(this.iconColor, other.iconColor) &&
        valueEquals(this.collapsedIconColor, other.collapsedIconColor) &&
        valueEquals(this.textColor, other.textColor) &&
        valueEquals(this.collapsedTextColor, other.collapsedTextColor) &&
        valueEquals(this.shape, other.shape) &&
        valueEquals(this.collapsedShape, other.collapsedShape) &&
        valueEquals(this.clipBehavior, other.clipBehavior) &&
        valueEquals(this.expansionAnimationStyle, other.expansionAnimationStyle))
    );
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.backgroundColor,
      this.collapsedBackgroundColor,
      this.tilePadding,
      this.expandedAlignment,
      this.childrenPadding,
      this.iconColor,
      this.collapsedIconColor,
      this.textColor,
      this.collapsedTextColor,
      this.shape,
      this.collapsedShape,
      this.clipBehavior,
      this.expansionAnimationStyle,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new ColorProperty('backgroundColor', this.backgroundColor, { defaultValue: null }),
    );
    properties.add(
      new ColorProperty('collapsedBackgroundColor', this.collapsedBackgroundColor, {
        defaultValue: null,
      }),
    );
    properties.add(
      new DiagnosticsProperty('tilePadding', this.tilePadding, {
        defaultValue: null,
        typeName: 'EdgeInsetsGeometry',
      }),
    );
    properties.add(
      new DiagnosticsProperty('expandedAlignment', this.expandedAlignment, {
        defaultValue: null,
        typeName: 'AlignmentGeometry',
      }),
    );
    properties.add(
      new DiagnosticsProperty('childrenPadding', this.childrenPadding, {
        defaultValue: null,
        typeName: 'EdgeInsetsGeometry',
      }),
    );
    properties.add(new ColorProperty('iconColor', this.iconColor, { defaultValue: null }));
    properties.add(
      new ColorProperty('collapsedIconColor', this.collapsedIconColor, { defaultValue: null }),
    );
    properties.add(new ColorProperty('textColor', this.textColor, { defaultValue: null }));
    properties.add(
      new ColorProperty('collapsedTextColor', this.collapsedTextColor, { defaultValue: null }),
    );
    properties.add(
      new DiagnosticsProperty('shape', this.shape, { defaultValue: null, typeName: 'ShapeBorder' }),
    );
    properties.add(
      new DiagnosticsProperty('collapsedShape', this.collapsedShape, {
        defaultValue: null,
        typeName: 'ShapeBorder',
      }),
    );
    properties.add(
      new DiagnosticsProperty('clipBehavior', this.clipBehavior, {
        defaultValue: null,
        typeName: 'Clip',
      }),
    );
    properties.add(
      new DiagnosticsProperty('expansionAnimationStyle', this.expansionAnimationStyle, {
        defaultValue: null,
        typeName: 'AnimationStyle',
      }),
    );
  }
}
