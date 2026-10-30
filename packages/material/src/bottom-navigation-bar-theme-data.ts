// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { BottomNavigationBarLandscapeLayout } from './bottom-navigation-bar-landscape-layout.ts';
import { BottomNavigationBarType } from './bottom-navigation-bar-type.ts';
import { Color } from '@nelyx/core/ui/color';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { lerpDouble } from '@nelyx/core/internal/ui/lerp-double.generated';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { DoubleProperty } from '@nelyx/core/foundation/diagnostic-properties';
import { ColorProperty } from '@nelyx/core/internal/framework/painting/color-property.generated';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
export interface BottomNavigationBarThemeDataOptions {
  readonly backgroundColor?: Color | null;
  /** @dartType double? */
  readonly elevation?: number | null;
  readonly selectedIconTheme?: IconThemeData | null;
  readonly unselectedIconTheme?: IconThemeData | null;
  readonly selectedItemColor?: Color | null;
  readonly unselectedItemColor?: Color | null;
  readonly selectedLabelStyle?: TextStyle | null;
  readonly unselectedLabelStyle?: TextStyle | null;
  readonly showSelectedLabels?: boolean | null;
  readonly showUnselectedLabels?: boolean | null;
  readonly type?: BottomNavigationBarType | null;
  readonly enableFeedback?: boolean | null;
  readonly landscapeLayout?: BottomNavigationBarLandscapeLayout | null;
  readonly mouseCursor?: WidgetStateProperty<MouseCursor | null> | null;
}
type Values = {
  readonly [K in keyof Required<BottomNavigationBarThemeDataOptions>]: Exclude<
    BottomNavigationBarThemeDataOptions[K],
    undefined
  >;
};
export class BottomNavigationBarThemeData extends Diagnosticable(class {}) {
  private readonly values: Values;
  get backgroundColor(): Color | null {
    return this.values.backgroundColor;
  }
  /** @dartType double? */
  get elevation(): number | null {
    return this.values.elevation;
  }
  get selectedIconTheme(): IconThemeData | null {
    return this.values.selectedIconTheme;
  }
  get unselectedIconTheme(): IconThemeData | null {
    return this.values.unselectedIconTheme;
  }
  get selectedItemColor(): Color | null {
    return this.values.selectedItemColor;
  }
  get unselectedItemColor(): Color | null {
    return this.values.unselectedItemColor;
  }
  get selectedLabelStyle(): TextStyle | null {
    return this.values.selectedLabelStyle;
  }
  get unselectedLabelStyle(): TextStyle | null {
    return this.values.unselectedLabelStyle;
  }
  get showSelectedLabels(): boolean | null {
    return this.values.showSelectedLabels;
  }
  get showUnselectedLabels(): boolean | null {
    return this.values.showUnselectedLabels;
  }
  get type(): BottomNavigationBarType | null {
    return this.values.type;
  }
  get enableFeedback(): boolean | null {
    return this.values.enableFeedback;
  }
  get landscapeLayout(): BottomNavigationBarLandscapeLayout | null {
    return this.values.landscapeLayout;
  }
  get mouseCursor(): WidgetStateProperty<MouseCursor | null> | null {
    return this.values.mouseCursor;
  }
  /** @dartParam elevation double? */
  constructor(options: BottomNavigationBarThemeDataOptions = {}) {
    super();
    this.values = Object.freeze({
      backgroundColor: options.backgroundColor ?? null,
      elevation: options.elevation ?? null,
      selectedIconTheme: options.selectedIconTheme ?? null,
      unselectedIconTheme: options.unselectedIconTheme ?? null,
      selectedItemColor: options.selectedItemColor ?? null,
      unselectedItemColor: options.unselectedItemColor ?? null,
      selectedLabelStyle: options.selectedLabelStyle ?? null,
      unselectedLabelStyle: options.unselectedLabelStyle ?? null,
      showSelectedLabels: options.showSelectedLabels ?? null,
      showUnselectedLabels: options.showUnselectedLabels ?? null,
      type: options.type ?? null,
      enableFeedback: options.enableFeedback ?? null,
      landscapeLayout: options.landscapeLayout ?? null,
      mouseCursor: options.mouseCursor ?? null,
    });
    if (this.type !== null && !BottomNavigationBarType.values.includes(this.type))
      throw new TypeError('Expected a canonical BottomNavigationBarType');
    if (
      this.landscapeLayout !== null &&
      !BottomNavigationBarLandscapeLayout.values.includes(this.landscapeLayout)
    )
      throw new TypeError('Expected a canonical BottomNavigationBarLandscapeLayout');
    if (new.target === BottomNavigationBarThemeData) Object.freeze(this);
  }
  /** @dartParam elevation double? */
  copyWith(options: BottomNavigationBarThemeDataOptions = {}): BottomNavigationBarThemeData {
    return new BottomNavigationBarThemeData({
      backgroundColor: options.backgroundColor ?? this.backgroundColor,
      elevation: options.elevation ?? this.elevation,
      selectedIconTheme: options.selectedIconTheme ?? this.selectedIconTheme,
      unselectedIconTheme: options.unselectedIconTheme ?? this.unselectedIconTheme,
      selectedItemColor: options.selectedItemColor ?? this.selectedItemColor,
      unselectedItemColor: options.unselectedItemColor ?? this.unselectedItemColor,
      selectedLabelStyle: options.selectedLabelStyle ?? this.selectedLabelStyle,
      unselectedLabelStyle: options.unselectedLabelStyle ?? this.unselectedLabelStyle,
      showSelectedLabels: options.showSelectedLabels ?? this.showSelectedLabels,
      showUnselectedLabels: options.showUnselectedLabels ?? this.showUnselectedLabels,
      type: options.type ?? this.type,
      enableFeedback: options.enableFeedback ?? this.enableFeedback,
      landscapeLayout: options.landscapeLayout ?? this.landscapeLayout,
      mouseCursor: options.mouseCursor ?? this.mouseCursor,
    });
  }
  /** @dartParam t double */
  static lerp(
    a: BottomNavigationBarThemeData | null,
    b: BottomNavigationBarThemeData | null,
    t: number,
  ): BottomNavigationBarThemeData {
    if (a === b && a !== null) {
      return a;
    }
    return new BottomNavigationBarThemeData({
      backgroundColor: Color.lerp(a?.backgroundColor ?? null, b?.backgroundColor ?? null, t),
      elevation: lerpDouble(a?.elevation ?? null, b?.elevation ?? null, t),
      selectedIconTheme: IconThemeData.lerp(
        a?.selectedIconTheme ?? null,
        b?.selectedIconTheme ?? null,
        t,
      ),
      unselectedIconTheme: IconThemeData.lerp(
        a?.unselectedIconTheme ?? null,
        b?.unselectedIconTheme ?? null,
        t,
      ),
      selectedItemColor: Color.lerp(a?.selectedItemColor ?? null, b?.selectedItemColor ?? null, t),
      unselectedItemColor: Color.lerp(
        a?.unselectedItemColor ?? null,
        b?.unselectedItemColor ?? null,
        t,
      ),
      selectedLabelStyle: TextStyle.lerp(
        a?.selectedLabelStyle ?? null,
        b?.selectedLabelStyle ?? null,
        t,
      ),
      unselectedLabelStyle: TextStyle.lerp(
        a?.unselectedLabelStyle ?? null,
        b?.unselectedLabelStyle ?? null,
        t,
      ),
      showSelectedLabels:
        t < 0.5 ? (a?.showSelectedLabels ?? null) : (b?.showSelectedLabels ?? null),
      showUnselectedLabels:
        t < 0.5 ? (a?.showUnselectedLabels ?? null) : (b?.showUnselectedLabels ?? null),
      type: t < 0.5 ? (a?.type ?? null) : (b?.type ?? null),
      enableFeedback: t < 0.5 ? (a?.enableFeedback ?? null) : (b?.enableFeedback ?? null),
      landscapeLayout: t < 0.5 ? (a?.landscapeLayout ?? null) : (b?.landscapeLayout ?? null),
      mouseCursor: t < 0.5 ? (a?.mouseCursor ?? null) : (b?.mouseCursor ?? null),
    });
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof BottomNavigationBarThemeData) || other.constructor !== this.constructor)
      return false;
    return (
      valueEquals(this.backgroundColor, other.backgroundColor) &&
      valueEquals(this.elevation, other.elevation) &&
      valueEquals(this.selectedIconTheme, other.selectedIconTheme) &&
      valueEquals(this.unselectedIconTheme, other.unselectedIconTheme) &&
      valueEquals(this.selectedItemColor, other.selectedItemColor) &&
      valueEquals(this.unselectedItemColor, other.unselectedItemColor) &&
      valueEquals(this.selectedLabelStyle, other.selectedLabelStyle) &&
      valueEquals(this.unselectedLabelStyle, other.unselectedLabelStyle) &&
      valueEquals(this.showSelectedLabels, other.showSelectedLabels) &&
      valueEquals(this.showUnselectedLabels, other.showUnselectedLabels) &&
      valueEquals(this.type, other.type) &&
      valueEquals(this.enableFeedback, other.enableFeedback) &&
      valueEquals(this.landscapeLayout, other.landscapeLayout) &&
      valueEquals(this.mouseCursor, other.mouseCursor)
    );
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.backgroundColor,
      this.elevation,
      this.selectedIconTheme,
      this.unselectedIconTheme,
      this.selectedItemColor,
      this.unselectedItemColor,
      this.selectedLabelStyle,
      this.unselectedLabelStyle,
      this.showSelectedLabels,
      this.showUnselectedLabels,
      this.type,
      this.enableFeedback,
      this.landscapeLayout,
      this.mouseCursor,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new ColorProperty('backgroundColor', this.backgroundColor, { defaultValue: null }),
    );
    properties.add(new DoubleProperty('elevation', this.elevation, { defaultValue: null }));
    properties.add(
      new DiagnosticsProperty('selectedIconTheme', this.selectedIconTheme, {
        defaultValue: null,
        typeName: 'IconThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('unselectedIconTheme', this.unselectedIconTheme, {
        defaultValue: null,
        typeName: 'IconThemeData',
      }),
    );
    properties.add(
      new ColorProperty('selectedItemColor', this.selectedItemColor, { defaultValue: null }),
    );
    properties.add(
      new ColorProperty('unselectedItemColor', this.unselectedItemColor, { defaultValue: null }),
    );
    properties.add(
      new DiagnosticsProperty('selectedLabelStyle', this.selectedLabelStyle, {
        defaultValue: null,
        typeName: 'TextStyle',
      }),
    );
    properties.add(
      new DiagnosticsProperty('unselectedLabelStyle', this.unselectedLabelStyle, {
        defaultValue: null,
        typeName: 'TextStyle',
      }),
    );
    properties.add(
      new DiagnosticsProperty('showSelectedLabels', this.showSelectedLabels, {
        defaultValue: null,
        typeName: 'bool',
      }),
    );
    properties.add(
      new DiagnosticsProperty('showUnselectedLabels', this.showUnselectedLabels, {
        defaultValue: null,
        typeName: 'bool',
      }),
    );
    properties.add(
      new DiagnosticsProperty('type', this.type, {
        defaultValue: null,
        typeName: 'BottomNavigationBarType',
      }),
    );
    properties.add(
      new DiagnosticsProperty('enableFeedback', this.enableFeedback, {
        defaultValue: null,
        typeName: 'bool',
      }),
    );
    properties.add(
      new DiagnosticsProperty('landscapeLayout', this.landscapeLayout, {
        defaultValue: null,
        typeName: 'BottomNavigationBarLandscapeLayout',
      }),
    );
    properties.add(
      new DiagnosticsProperty('mouseCursor', this.mouseCursor, {
        defaultValue: null,
        typeName: 'WidgetStateProperty<MouseCursor?>',
      }),
    );
  }
}
