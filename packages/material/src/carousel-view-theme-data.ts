// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { checkedOutlinedBorder, lerpColorProperty } from './internal/theme/value-interpolation.ts';
import { lerpDouble } from '@nelyx/core/internal/ui/lerp-double.generated';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { DoubleProperty, EnumProperty } from '@nelyx/core/foundation/diagnostic-properties';
import { ColorProperty } from '@nelyx/core/internal/framework/painting/color-property.generated';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
export interface CarouselViewThemeDataOptions {
  readonly padding?: EdgeInsets | null;
  readonly backgroundColor?: Color | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly shape?: OutlinedBorder | null;
  readonly itemClipBehavior?: Clip | null;
  readonly overlayColor?: WidgetStateProperty<Color | null> | null;
}
export class CarouselViewThemeData extends Diagnosticable(class {}) {
  readonly padding: EdgeInsets | null;
  readonly backgroundColor: Color | null;
  /** @dartType double? */
  readonly elevation: number | null;
  readonly shape: OutlinedBorder | null;
  readonly itemClipBehavior: Clip | null;
  readonly overlayColor: WidgetStateProperty<Color | null> | null;
  /** @dartParam elevation double? */
  constructor(options: CarouselViewThemeDataOptions = {}) {
    super();
    this.padding = options.padding ?? null;
    this.backgroundColor = options.backgroundColor ?? null;
    this.elevation = options.elevation ?? null;
    this.shape = options.shape ?? null;
    this.itemClipBehavior = options.itemClipBehavior ?? null;
    this.overlayColor = options.overlayColor ?? null;
    if (new.target === CarouselViewThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double? */
  copyWith(options: CarouselViewThemeDataOptions = {}): CarouselViewThemeData {
    return new CarouselViewThemeData({
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      elevation: options.elevation ?? this.elevation,
      shape: options.shape ?? this.shape,
      overlayColor: options.overlayColor ?? this.overlayColor,
      padding: options.padding ?? this.padding,
      itemClipBehavior: options.itemClipBehavior ?? this.itemClipBehavior,
    });
  }
  /** @dartParam t double */
  static lerp(
    a: CarouselViewThemeData | null,
    b: CarouselViewThemeData | null,
    t: number,
  ): CarouselViewThemeData {
    if (a === b && a !== null) {
      return a;
    }
    return new CarouselViewThemeData({
      backgroundColor: Color.lerp(a?.backgroundColor ?? null, b?.backgroundColor ?? null, t),
      elevation: lerpDouble(a?.elevation ?? null, b?.elevation ?? null, t),
      shape: checkedOutlinedBorder(ShapeBorder.lerp(a?.shape ?? null, b?.shape ?? null, t)),
      overlayColor: lerpColorProperty(a?.overlayColor ?? null, b?.overlayColor ?? null, t),
      padding: EdgeInsets.lerp(a?.padding ?? null, b?.padding ?? null, t),
      itemClipBehavior: t < 0.5 ? (a?.itemClipBehavior ?? null) : (b?.itemClipBehavior ?? null),
    });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof CarouselViewThemeData &&
        other.constructor === this.constructor &&
        valueEquals(this.padding, other.padding) &&
        valueEquals(this.backgroundColor, other.backgroundColor) &&
        valueEquals(this.elevation, other.elevation) &&
        valueEquals(this.shape, other.shape) &&
        valueEquals(this.itemClipBehavior, other.itemClipBehavior) &&
        valueEquals(this.overlayColor, other.overlayColor))
    );
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.backgroundColor,
      this.elevation,
      this.shape,
      this.overlayColor,
      this.padding,
      this.itemClipBehavior,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new ColorProperty('backgroundColor', this.backgroundColor, { defaultValue: null }),
    );
    properties.add(new DoubleProperty('elevation', this.elevation, { defaultValue: null }));
    properties.add(
      new DiagnosticsProperty('shape', this.shape, {
        defaultValue: null,
        typeName: 'OutlinedBorder',
      }),
    );
    properties.add(
      new DiagnosticsProperty('overlayColor', this.overlayColor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<Color?>',
      }),
    );
    properties.add(
      new DiagnosticsProperty('padding', this.padding, {
        defaultValue: null,
        typeName: 'EdgeInsets',
      }),
    );
    properties.add(
      new EnumProperty('itemClipBehavior', this.itemClipBehavior, { defaultValue: null }),
    );
  }
}
