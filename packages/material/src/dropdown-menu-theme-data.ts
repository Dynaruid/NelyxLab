// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Color } from '@nelyx/core/ui/color';
import { InputDecorationThemeData } from './input-decoration-theme-data.ts';
import { MenuStyle } from './menu-style.ts';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import '@nelyx/core/foundation/diagnostic-properties';
import { ColorProperty } from '@nelyx/core/internal/framework/painting/color-property.generated';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
export interface DropdownMenuThemeDataOptions {
  readonly textStyle?: TextStyle | null;
  readonly inputDecorationTheme?: InputDecorationThemeData | null;
  readonly menuStyle?: MenuStyle | null;
  readonly disabledColor?: Color | null;
}
type Values = {
  readonly [K in keyof Required<DropdownMenuThemeDataOptions>]: Exclude<
    DropdownMenuThemeDataOptions[K],
    undefined
  >;
};
export class DropdownMenuThemeData extends Diagnosticable(class {}) {
  private readonly values: Values;
  get textStyle(): TextStyle | null {
    return this.values.textStyle;
  }
  get inputDecorationTheme(): InputDecorationThemeData | null {
    return this.values.inputDecorationTheme;
  }
  get menuStyle(): MenuStyle | null {
    return this.values.menuStyle;
  }
  get disabledColor(): Color | null {
    return this.values.disabledColor;
  }
  constructor(options: DropdownMenuThemeDataOptions = {}) {
    super();
    this.values = Object.freeze({
      textStyle: options.textStyle ?? null,
      inputDecorationTheme: options.inputDecorationTheme ?? null,
      menuStyle: options.menuStyle ?? null,
      disabledColor: options.disabledColor ?? null,
    });
    if (
      this.inputDecorationTheme !== null &&
      !(this.inputDecorationTheme instanceof InputDecorationThemeData)
    )
      throw new TypeError('Use modern InputDecorationThemeData values');
    if (new.target === DropdownMenuThemeData) Object.freeze(this);
  }
  copyWith(options: DropdownMenuThemeDataOptions = {}): DropdownMenuThemeData {
    return new DropdownMenuThemeData({
      textStyle: options.textStyle ?? this.textStyle,
      inputDecorationTheme: options.inputDecorationTheme ?? this.inputDecorationTheme,
      menuStyle: options.menuStyle ?? this.menuStyle,
      disabledColor: options.disabledColor ?? this.disabledColor,
    });
  }
  /** @dartParam t double */
  static lerp(
    a: DropdownMenuThemeData | null,
    b: DropdownMenuThemeData | null,
    t: number,
  ): DropdownMenuThemeData {
    if (a === b && a !== null) {
      return a;
    }
    return new DropdownMenuThemeData({
      textStyle: TextStyle.lerp(a?.textStyle ?? null, b?.textStyle ?? null, t),
      inputDecorationTheme:
        t < 0.5 ? (a?.inputDecorationTheme ?? null) : (b?.inputDecorationTheme ?? null),
      menuStyle: MenuStyle.lerp(a?.menuStyle ?? null, b?.menuStyle ?? null, t),
      disabledColor: Color.lerp(a?.disabledColor ?? null, b?.disabledColor ?? null, t),
    });
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    if (!(other instanceof DropdownMenuThemeData) || other.constructor !== this.constructor)
      return false;
    return (
      valueEquals(this.textStyle, other.textStyle) &&
      valueEquals(this.inputDecorationTheme, other.inputDecorationTheme) &&
      valueEquals(this.menuStyle, other.menuStyle) &&
      valueEquals(this.disabledColor, other.disabledColor)
    );
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.textStyle,
      this.inputDecorationTheme,
      this.menuStyle,
      this.disabledColor,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new DiagnosticsProperty('textStyle', this.textStyle, {
        defaultValue: null,
        typeName: 'TextStyle',
      }),
    );
    properties.add(
      new DiagnosticsProperty('inputDecorationThemeData', this.inputDecorationTheme, {
        defaultValue: null,
        typeName: 'InputDecorationThemeData',
      }),
    );
    properties.add(
      new DiagnosticsProperty('menuStyle', this.menuStyle, {
        defaultValue: null,
        typeName: 'MenuStyle',
      }),
    );
    properties.add(new ColorProperty('disabledColor', this.disabledColor, { defaultValue: null }));
  }
}
