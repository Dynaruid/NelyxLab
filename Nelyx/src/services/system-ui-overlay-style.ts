// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Color } from '../ui/color.ts';
import { Diagnosticable } from '../foundation/diagnosticable.ts';
import { DiagnosticsProperty } from '../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../foundation/diagnostics.ts';
import { valueEquals, hashValues } from '../framework/painting/value-equality.ts';
export interface SystemUiOverlayStyleOptions {
  readonly systemNavigationBarColor?: Color | null;
  readonly systemNavigationBarDividerColor?: Color | null;
  readonly systemNavigationBarIconBrightness?: 'light' | 'dark' | null;
  readonly systemNavigationBarContrastEnforced?: boolean | null;
  readonly statusBarColor?: Color | null;
  readonly statusBarBrightness?: 'light' | 'dark' | null;
  readonly statusBarIconBrightness?: 'light' | 'dark' | null;
  readonly systemStatusBarContrastEnforced?: boolean | null;
}
type Values = {
  readonly [K in keyof Required<SystemUiOverlayStyleOptions>]: Exclude<
    SystemUiOverlayStyleOptions[K],
    undefined
  >;
};
export class SystemUiOverlayStyle extends Diagnosticable(class {}) {
  private readonly values: Values;
  get systemNavigationBarColor(): Color | null {
    return this.values.systemNavigationBarColor;
  }
  get systemNavigationBarDividerColor(): Color | null {
    return this.values.systemNavigationBarDividerColor;
  }
  get systemNavigationBarIconBrightness(): 'light' | 'dark' | null {
    return this.values.systemNavigationBarIconBrightness;
  }
  get systemNavigationBarContrastEnforced(): boolean | null {
    return this.values.systemNavigationBarContrastEnforced;
  }
  get statusBarColor(): Color | null {
    return this.values.statusBarColor;
  }
  get statusBarBrightness(): 'light' | 'dark' | null {
    return this.values.statusBarBrightness;
  }
  get statusBarIconBrightness(): 'light' | 'dark' | null {
    return this.values.statusBarIconBrightness;
  }
  get systemStatusBarContrastEnforced(): boolean | null {
    return this.values.systemStatusBarContrastEnforced;
  }
  constructor(options: SystemUiOverlayStyleOptions = {}) {
    super();
    this.values = Object.freeze({
      systemNavigationBarColor: options.systemNavigationBarColor ?? null,
      systemNavigationBarDividerColor: options.systemNavigationBarDividerColor ?? null,
      systemNavigationBarIconBrightness: options.systemNavigationBarIconBrightness ?? null,
      systemNavigationBarContrastEnforced: options.systemNavigationBarContrastEnforced ?? null,
      statusBarColor: options.statusBarColor ?? null,
      statusBarBrightness: options.statusBarBrightness ?? null,
      statusBarIconBrightness: options.statusBarIconBrightness ?? null,
      systemStatusBarContrastEnforced: options.systemStatusBarContrastEnforced ?? null,
    });
    for (const value of [
      this.systemNavigationBarIconBrightness,
      this.statusBarBrightness,
      this.statusBarIconBrightness,
    ])
      if (value !== null && value !== 'light' && value !== 'dark')
        throw new TypeError('Expected a canonical brightness');
    if (new.target === SystemUiOverlayStyle) Object.freeze(this);
  }
  static readonly light = new SystemUiOverlayStyle({
    systemNavigationBarColor: new Color(4278190080),
    systemNavigationBarIconBrightness: 'light',
    statusBarIconBrightness: 'light',
    statusBarBrightness: 'dark',
  });
  static readonly dark = new SystemUiOverlayStyle({
    systemNavigationBarColor: new Color(4278190080),
    systemNavigationBarIconBrightness: 'light',
    statusBarIconBrightness: 'dark',
    statusBarBrightness: 'light',
  });
  copyWith(options: SystemUiOverlayStyleOptions = {}): SystemUiOverlayStyle {
    return new SystemUiOverlayStyle({
      systemNavigationBarColor: options.systemNavigationBarColor ?? this.systemNavigationBarColor,
      systemNavigationBarDividerColor:
        options.systemNavigationBarDividerColor ?? this.systemNavigationBarDividerColor,
      systemNavigationBarIconBrightness:
        options.systemNavigationBarIconBrightness ?? this.systemNavigationBarIconBrightness,
      systemNavigationBarContrastEnforced:
        options.systemNavigationBarContrastEnforced ?? this.systemNavigationBarContrastEnforced,
      statusBarColor: options.statusBarColor ?? this.statusBarColor,
      statusBarBrightness: options.statusBarBrightness ?? this.statusBarBrightness,
      statusBarIconBrightness: options.statusBarIconBrightness ?? this.statusBarIconBrightness,
      systemStatusBarContrastEnforced:
        options.systemStatusBarContrastEnforced ?? this.systemStatusBarContrastEnforced,
    });
  }
  equals(other: unknown): boolean {
    return (
      other instanceof SystemUiOverlayStyle &&
      other.constructor === this.constructor &&
      valueEquals(this.systemNavigationBarColor, other.systemNavigationBarColor) &&
      valueEquals(this.systemNavigationBarDividerColor, other.systemNavigationBarDividerColor) &&
      valueEquals(
        this.systemNavigationBarIconBrightness,
        other.systemNavigationBarIconBrightness,
      ) &&
      valueEquals(
        this.systemNavigationBarContrastEnforced,
        other.systemNavigationBarContrastEnforced,
      ) &&
      valueEquals(this.statusBarColor, other.statusBarColor) &&
      valueEquals(this.statusBarBrightness, other.statusBarBrightness) &&
      valueEquals(this.statusBarIconBrightness, other.statusBarIconBrightness) &&
      valueEquals(this.systemStatusBarContrastEnforced, other.systemStatusBarContrastEnforced)
    );
  }
  /** @dartReturn int */
  get hashCode(): number {
    return hashValues(
      this.systemNavigationBarColor,
      this.systemNavigationBarDividerColor,
      this.systemNavigationBarContrastEnforced,
      this.statusBarColor,
      this.statusBarBrightness,
      this.statusBarIconBrightness,
      this.systemStatusBarContrastEnforced,
      this.systemNavigationBarIconBrightness,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new DiagnosticsProperty('systemNavigationBarColor', this.systemNavigationBarColor, {
        typeName: 'Color',
      }),
    );
    properties.add(
      new DiagnosticsProperty(
        'systemNavigationBarDividerColor',
        this.systemNavigationBarDividerColor,
        { typeName: 'Color' },
      ),
    );
    properties.add(
      new DiagnosticsProperty(
        'systemNavigationBarIconBrightness',
        this.systemNavigationBarIconBrightness,
        { typeName: 'Brightness' },
      ),
    );
    properties.add(
      new DiagnosticsProperty(
        'systemNavigationBarContrastEnforced',
        this.systemNavigationBarContrastEnforced,
        { typeName: 'bool' },
      ),
    );
    properties.add(
      new DiagnosticsProperty('statusBarColor', this.statusBarColor, { typeName: 'Color' }),
    );
    properties.add(
      new DiagnosticsProperty('statusBarBrightness', this.statusBarBrightness, {
        typeName: 'Brightness',
      }),
    );
    properties.add(
      new DiagnosticsProperty('statusBarIconBrightness', this.statusBarIconBrightness, {
        typeName: 'Brightness',
      }),
    );
    properties.add(
      new DiagnosticsProperty(
        'systemStatusBarContrastEnforced',
        this.systemStatusBarContrastEnforced,
        { typeName: 'bool' },
      ),
    );
  }
}
