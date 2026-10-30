// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { Color } from '@nelyx/core/ui/color';
import { Decoration } from '@nelyx/core/framework/painting/decoration';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { InteractiveInkFeatureFactory } from './ink-feature.ts';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { TabAlignment } from './tab-alignment.ts';
import { TabBarIndicatorSize } from './tab-bar-indicator-size.ts';
import { TabIndicatorAnimation } from './tab-indicator-animation.ts';
import type { TextScaler } from '@nelyx/core/framework/painting/text-scaler';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { lerpColorProperty } from './internal/theme/value-interpolation.ts';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import '@nelyx/core/foundation/diagnostic-properties';
import '@nelyx/core/internal/framework/painting/color-property.generated';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
export interface TabBarThemeDataOptions {
  readonly indicator?: Decoration | null;
  readonly indicatorColor?: Color | null;
  readonly indicatorSize?: TabBarIndicatorSize | null;
  readonly dividerColor?: Color | null;
  /** @dartType double? */
  readonly dividerHeight?: number | null;
  readonly labelColor?: Color | null;
  readonly labelPadding?: EdgeInsetsGeometry | null;
  readonly labelStyle?: TextStyle | null;
  readonly unselectedLabelColor?: Color | null;
  readonly unselectedLabelStyle?: TextStyle | null;
  readonly overlayColor?: WidgetStateProperty<Color | null> | null;
  readonly splashFactory?: InteractiveInkFeatureFactory | null;
  readonly mouseCursor?: WidgetStateProperty<MouseCursor | null> | null;
  readonly tabAlignment?: TabAlignment | null;
  readonly textScaler?: TextScaler | null;
  readonly indicatorAnimation?: TabIndicatorAnimation | null;
  readonly splashBorderRadius?: BorderRadius | null;
}
type Values = {
  readonly [K in keyof Required<TabBarThemeDataOptions>]: Exclude<
    TabBarThemeDataOptions[K],
    undefined
  >;
};
export class TabBarThemeData extends Diagnosticable(class {}) {
  private readonly values: Values;
  get indicator(): Decoration | null {
    return this.values.indicator;
  }
  get indicatorColor(): Color | null {
    return this.values.indicatorColor;
  }
  get indicatorSize(): TabBarIndicatorSize | null {
    return this.values.indicatorSize;
  }
  get dividerColor(): Color | null {
    return this.values.dividerColor;
  }
  /** @dartType double? */
  get dividerHeight(): number | null {
    return this.values.dividerHeight;
  }
  get labelColor(): Color | null {
    return this.values.labelColor;
  }
  get labelPadding(): EdgeInsetsGeometry | null {
    return this.values.labelPadding;
  }
  get labelStyle(): TextStyle | null {
    return this.values.labelStyle;
  }
  get unselectedLabelColor(): Color | null {
    return this.values.unselectedLabelColor;
  }
  get unselectedLabelStyle(): TextStyle | null {
    return this.values.unselectedLabelStyle;
  }
  get overlayColor(): WidgetStateProperty<Color | null> | null {
    return this.values.overlayColor;
  }
  get splashFactory(): InteractiveInkFeatureFactory | null {
    return this.values.splashFactory;
  }
  get mouseCursor(): WidgetStateProperty<MouseCursor | null> | null {
    return this.values.mouseCursor;
  }
  get tabAlignment(): TabAlignment | null {
    return this.values.tabAlignment;
  }
  get textScaler(): TextScaler | null {
    return this.values.textScaler;
  }
  get indicatorAnimation(): TabIndicatorAnimation | null {
    return this.values.indicatorAnimation;
  }
  get splashBorderRadius(): BorderRadius | null {
    return this.values.splashBorderRadius;
  }
  /** @dartParam dividerHeight double? */
  constructor(options: TabBarThemeDataOptions = {}) {
    super();
    this.values = Object.freeze({
      indicator: options.indicator ?? null,
      indicatorColor: options.indicatorColor ?? null,
      indicatorSize: options.indicatorSize ?? null,
      dividerColor: options.dividerColor ?? null,
      dividerHeight: options.dividerHeight ?? null,
      labelColor: options.labelColor ?? null,
      labelPadding: options.labelPadding ?? null,
      labelStyle: options.labelStyle ?? null,
      unselectedLabelColor: options.unselectedLabelColor ?? null,
      unselectedLabelStyle: options.unselectedLabelStyle ?? null,
      overlayColor: options.overlayColor ?? null,
      splashFactory: options.splashFactory ?? null,
      mouseCursor: options.mouseCursor ?? null,
      tabAlignment: options.tabAlignment ?? null,
      textScaler: options.textScaler ?? null,
      indicatorAnimation: options.indicatorAnimation ?? null,
      splashBorderRadius: options.splashBorderRadius ?? null,
    });
    if (this.indicatorSize !== null && !TabBarIndicatorSize.values.includes(this.indicatorSize))
      throw new TypeError('Expected a canonical TabBarIndicatorSize');
    if (this.tabAlignment !== null && !TabAlignment.values.includes(this.tabAlignment))
      throw new TypeError('Expected a canonical TabAlignment');
    if (
      this.indicatorAnimation !== null &&
      !TabIndicatorAnimation.values.includes(this.indicatorAnimation)
    )
      throw new TypeError('Expected a canonical TabIndicatorAnimation');
    if (new.target === TabBarThemeData) Object.freeze(this);
  }
  /** @dartParam dividerHeight double? */
  copyWith(options: TabBarThemeDataOptions = {}): TabBarThemeData {
    return new TabBarThemeData({
      indicator: options.indicator ?? this.indicator,
      indicatorColor: options.indicatorColor ?? this.indicatorColor,
      indicatorSize: options.indicatorSize ?? this.indicatorSize,
      dividerColor: options.dividerColor ?? this.dividerColor,
      dividerHeight: options.dividerHeight ?? this.dividerHeight,
      labelColor: options.labelColor ?? this.labelColor,
      labelPadding: options.labelPadding ?? this.labelPadding,
      labelStyle: options.labelStyle ?? this.labelStyle,
      unselectedLabelColor: options.unselectedLabelColor ?? this.unselectedLabelColor,
      unselectedLabelStyle: options.unselectedLabelStyle ?? this.unselectedLabelStyle,
      overlayColor: options.overlayColor ?? this.overlayColor,
      splashFactory: options.splashFactory ?? this.splashFactory,
      mouseCursor: options.mouseCursor ?? this.mouseCursor,
      tabAlignment: options.tabAlignment ?? this.tabAlignment,
      textScaler: options.textScaler ?? this.textScaler,
      indicatorAnimation: options.indicatorAnimation ?? this.indicatorAnimation,
      splashBorderRadius: options.splashBorderRadius ?? this.splashBorderRadius,
    });
  }
  /** @dartParam t double */
  static lerp(a: TabBarThemeData, b: TabBarThemeData, t: number): TabBarThemeData {
    if (a === b) {
      return a;
    }
    return new TabBarThemeData({
      indicator: Decoration.lerp(a.indicator, b.indicator, t),
      indicatorColor: Color.lerp(a.indicatorColor, b.indicatorColor, t),
      indicatorSize: t < 0.5 ? a.indicatorSize : b.indicatorSize,
      dividerColor: Color.lerp(a.dividerColor, b.dividerColor, t),
      dividerHeight: t < 0.5 ? a.dividerHeight : b.dividerHeight,
      labelColor: Color.lerp(a.labelColor, b.labelColor, t),
      labelPadding: EdgeInsetsGeometry.lerp(a.labelPadding, b.labelPadding, t),
      labelStyle: TextStyle.lerp(a.labelStyle, b.labelStyle, t),
      unselectedLabelColor: Color.lerp(a.unselectedLabelColor, b.unselectedLabelColor, t),
      unselectedLabelStyle: TextStyle.lerp(a.unselectedLabelStyle, b.unselectedLabelStyle, t),
      overlayColor: lerpColorProperty(a.overlayColor, b.overlayColor, t),
      splashFactory: t < 0.5 ? a.splashFactory : b.splashFactory,
      mouseCursor: t < 0.5 ? a.mouseCursor : b.mouseCursor,
      tabAlignment: t < 0.5 ? a.tabAlignment : b.tabAlignment,
      textScaler: t < 0.5 ? a.textScaler : b.textScaler,
      indicatorAnimation: t < 0.5 ? a.indicatorAnimation : b.indicatorAnimation,
      splashBorderRadius: BorderRadius.lerp(a.splashBorderRadius, a.splashBorderRadius, t),
    });
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof TabBarThemeData) || other.constructor !== this.constructor) return false;
    return (
      valueEquals(this.indicator, other.indicator) &&
      valueEquals(this.indicatorColor, other.indicatorColor) &&
      valueEquals(this.indicatorSize, other.indicatorSize) &&
      valueEquals(this.dividerColor, other.dividerColor) &&
      valueEquals(this.dividerHeight, other.dividerHeight) &&
      valueEquals(this.labelColor, other.labelColor) &&
      valueEquals(this.labelPadding, other.labelPadding) &&
      valueEquals(this.labelStyle, other.labelStyle) &&
      valueEquals(this.unselectedLabelColor, other.unselectedLabelColor) &&
      valueEquals(this.unselectedLabelStyle, other.unselectedLabelStyle) &&
      valueEquals(this.overlayColor, other.overlayColor) &&
      valueEquals(this.splashFactory, other.splashFactory) &&
      valueEquals(this.mouseCursor, other.mouseCursor) &&
      valueEquals(this.tabAlignment, other.tabAlignment) &&
      valueEquals(this.textScaler, other.textScaler) &&
      valueEquals(this.indicatorAnimation, other.indicatorAnimation) &&
      valueEquals(this.splashBorderRadius, other.splashBorderRadius)
    );
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.indicator,
      this.indicatorColor,
      this.indicatorSize,
      this.dividerColor,
      this.dividerHeight,
      this.labelColor,
      this.labelPadding,
      this.labelStyle,
      this.unselectedLabelColor,
      this.unselectedLabelStyle,
      this.overlayColor,
      this.splashFactory,
      this.mouseCursor,
      this.tabAlignment,
      this.textScaler,
      this.indicatorAnimation,
      this.splashBorderRadius,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new DiagnosticsProperty('indicator', this.indicator, {
        defaultValue: null,
        typeName: 'Decoration?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('indicatorColor', this.indicatorColor, {
        defaultValue: null,
        typeName: 'Color?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('indicatorSize', this.indicatorSize, {
        defaultValue: null,
        typeName: 'TabBarIndicatorSize?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('dividerColor', this.dividerColor, {
        defaultValue: null,
        typeName: 'Color?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('dividerHeight', this.dividerHeight, {
        defaultValue: null,
        typeName: 'double?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('labelColor', this.labelColor, {
        defaultValue: null,
        typeName: 'Color?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('labelPadding', this.labelPadding, {
        defaultValue: null,
        typeName: 'EdgeInsetsGeometry?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('labelStyle', this.labelStyle, {
        defaultValue: null,
        typeName: 'TextStyle?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('unselectedLabelColor', this.unselectedLabelColor, {
        defaultValue: null,
        typeName: 'Color?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('unselectedLabelStyle', this.unselectedLabelStyle, {
        defaultValue: null,
        typeName: 'TextStyle?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('overlayColor', this.overlayColor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<Color?>?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('splashFactory', this.splashFactory, {
        defaultValue: null,
        typeName: 'InteractiveInkFeatureFactory?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('mouseCursor', this.mouseCursor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<MouseCursor?>?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('tabAlignment', this.tabAlignment, {
        defaultValue: null,
        typeName: 'TabAlignment?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('textScaler', this.textScaler, {
        defaultValue: null,
        typeName: 'TextScaler?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('indicatorAnimation', this.indicatorAnimation, {
        defaultValue: null,
        typeName: 'TabIndicatorAnimation?',
      }),
    );
    properties.add(
      new DiagnosticsProperty('splashBorderRadius', this.splashBorderRadius, {
        defaultValue: null,
        typeName: 'BorderRadius?',
      }),
    );
  }
}
