// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/button_theme.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { invariant } from '@nelyx/core/foundation/errors';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { hashValues, valueEquals } from '@nelyx/core/framework/painting/value-equality';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import { Color } from '@nelyx/core/ui/color';
import type { ColorScheme } from './color-scheme.ts';
import { Colors } from './colors.ts';
import { kThemeChangeDuration } from './constants.ts';
import { ThemeData, MaterialTapTargetSize } from './theme-data.ts';
import { Theme } from './theme.ts';

export class ButtonTextTheme {
  private constructor(
    readonly index: number,
    readonly name: 'normal' | 'accent' | 'primary',
  ) {
    Object.freeze(this);
  }
  static readonly normal = new ButtonTextTheme(0, 'normal');
  static readonly accent = new ButtonTextTheme(1, 'accent');
  static readonly primary = new ButtonTextTheme(2, 'primary');
  static readonly values = Object.freeze([this.normal, this.accent, this.primary]);
  toString(): string {
    return 'ButtonTextTheme.' + this.name;
  }
}

export class ButtonBarLayoutBehavior {
  private constructor(
    readonly index: number,
    readonly name: 'constrained' | 'padded',
  ) {
    Object.freeze(this);
  }
  static readonly constrained = new ButtonBarLayoutBehavior(0, 'constrained');
  static readonly padded = new ButtonBarLayoutBehavior(1, 'padded');
  static readonly values = Object.freeze([this.constrained, this.padded]);
  toString(): string {
    return 'ButtonBarLayoutBehavior.' + this.name;
  }
}

export interface ButtonThemeDataOptions {
  readonly textTheme?: ButtonTextTheme | null;
  readonly layoutBehavior?: ButtonBarLayoutBehavior | null;
  readonly minWidth?: number | null;
  readonly height?: number | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly shape?: ShapeBorder | null;
  readonly alignedDropdown?: boolean | null;
  readonly buttonColor?: Color | null;
  readonly disabledColor?: Color | null;
  readonly focusColor?: Color | null;
  readonly hoverColor?: Color | null;
  readonly highlightColor?: Color | null;
  readonly splashColor?: Color | null;
  readonly colorScheme?: ColorScheme | null;
  readonly materialTapTargetSize?: MaterialTapTargetSize | null;
}

export interface ButtonThemeButton {
  readonly enabled: boolean;
  readonly filled?: boolean;
  readonly colorBrightness?: 'light' | 'dark' | null;
  readonly textTheme?: ButtonTextTheme | null;
  readonly textColor?: Color | null;
  readonly disabledTextColor?: Color | null;
  readonly color?: Color | null;
  readonly disabledColor?: Color | null;
  readonly focusColor?: Color | null;
  readonly hoverColor?: Color | null;
  readonly highlightColor?: Color | null;
  readonly splashColor?: Color | null;
  readonly elevation?: number | null;
  readonly focusElevation?: number | null;
  readonly hoverElevation?: number | null;
  readonly highlightElevation?: number | null;
  readonly disabledElevation?: number | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly shape?: ShapeBorder | null;
  readonly animationDuration?: number | null;
  readonly materialTapTargetSize?: MaterialTapTargetSize | null;
}

const inset = EdgeInsets.symmetric({ horizontal: 16 });
const primaryInset = EdgeInsets.symmetric({ horizontal: 24 });
const shape = new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(2) });
const primaryShape = new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(4) });
const optionNames = [
  'textTheme',
  'layoutBehavior',
  'minWidth',
  'height',
  'padding',
  'shape',
  'alignedDropdown',
  'buttonColor',
  'disabledColor',
  'focusColor',
  'hoverColor',
  'highlightColor',
  'splashColor',
  'colorScheme',
  'materialTapTargetSize',
] as const;

export class ButtonThemeData extends Diagnosticable(class {}) {
  readonly textTheme: ButtonTextTheme;
  readonly layoutBehavior: ButtonBarLayoutBehavior;
  readonly minWidth: number;
  readonly height: number;
  readonly alignedDropdown: boolean;
  readonly colorScheme: ColorScheme | null;
  private readonly options: Readonly<ButtonThemeDataOptions>;

  constructor(options: ButtonThemeDataOptions = {}) {
    super();
    this.textTheme = options.textTheme ?? ButtonTextTheme.normal;
    this.layoutBehavior = options.layoutBehavior ?? ButtonBarLayoutBehavior.padded;
    this.minWidth = options.minWidth ?? 88;
    this.height = options.height ?? 36;
    this.alignedDropdown = options.alignedDropdown ?? false;
    this.colorScheme = options.colorScheme ?? null;
    invariant(
      this.minWidth >= 0 && this.height >= 0,
      'invalid-button-theme-size',
      'Button theme dimensions must be nonnegative',
    );
    this.options = Object.freeze({ ...options });
  }

  get constraints(): BoxConstraints {
    return new BoxConstraints(this.minWidth, Infinity, this.height);
  }
  get padding(): EdgeInsetsGeometry {
    return (
      this.options.padding ?? (this.textTheme === ButtonTextTheme.primary ? primaryInset : inset)
    );
  }
  get shape(): ShapeBorder {
    return (
      this.options.shape ?? (this.textTheme === ButtonTextTheme.primary ? primaryShape : shape)
    );
  }

  private get colors(): ColorScheme {
    invariant(
      this.colorScheme,
      'missing-button-color-scheme',
      'Use ButtonTheme.of or supply a color scheme',
    );
    return this.colorScheme;
  }
  getBrightness(button: ButtonThemeButton): 'light' | 'dark' {
    return button.colorBrightness ?? this.colors.brightness;
  }
  getTextTheme(button: ButtonThemeButton): ButtonTextTheme {
    return button.textTheme ?? this.textTheme;
  }
  getDisabledTextColor(button: ButtonThemeButton): Color {
    return (
      button.textColor ??
      button.disabledTextColor ??
      new Color(this.colors.onSurface).withOpacity(0.38)
    );
  }
  getDisabledFillColor(button: ButtonThemeButton): Color {
    return (
      button.disabledColor ??
      this.options.disabledColor ??
      new Color(this.colors.onSurface).withOpacity(0.38)
    );
  }
  getFillColor(button: ButtonThemeButton): Color | null {
    const explicit = button.enabled ? button.color : button.disabledColor;
    if (explicit != null) return explicit;
    if (button.filled === false) return null;
    if (button.enabled) return this.options.buttonColor ?? new Color(this.colors.primary);
    return this.getTextTheme(button) === ButtonTextTheme.primary
      ? new Color(this.colors.onSurface).withOpacity(0.12)
      : this.getDisabledFillColor(button);
  }
  getTextColor(button: ButtonThemeButton): Color {
    if (!button.enabled) return this.getDisabledTextColor(button);
    if (button.textColor != null) return button.textColor;
    const textTheme = this.getTextTheme(button);
    if (textTheme === ButtonTextTheme.accent) return new Color(this.colors.secondary);
    if (textTheme === ButtonTextTheme.primary) {
      const fill = this.getFillColor(button);
      const brightness = fill
        ? ThemeData.estimateBrightnessForColor(fill)
        : this.getBrightness(button);
      return brightness === 'dark' ? Colors.white : Colors.black;
    }
    return this.getBrightness(button) === 'dark' ? Colors.white : Colors.black.withOpacity(0.87);
  }
  getSplashColor(button: ButtonThemeButton): Color {
    return (
      button.splashColor ??
      (this.getTextTheme(button) === ButtonTextTheme.primary ? null : this.options.splashColor) ??
      this.getTextColor(button).withOpacity(0.12)
    );
  }
  getFocusColor(button: ButtonThemeButton): Color {
    return (
      button.focusColor ?? this.options.focusColor ?? this.getTextColor(button).withOpacity(0.12)
    );
  }
  getHoverColor(button: ButtonThemeButton): Color {
    return (
      button.hoverColor ?? this.options.hoverColor ?? this.getTextColor(button).withOpacity(0.04)
    );
  }
  getHighlightColor(button: ButtonThemeButton): Color {
    return (
      button.highlightColor ??
      (this.getTextTheme(button) === ButtonTextTheme.primary
        ? Colors.transparent
        : (this.options.highlightColor ?? this.getTextColor(button).withOpacity(0.16)))
    );
  }
  getElevation(button: ButtonThemeButton): number {
    return button.elevation ?? 2;
  }
  getFocusElevation(button: ButtonThemeButton): number {
    return button.focusElevation ?? 4;
  }
  getHoverElevation(button: ButtonThemeButton): number {
    return button.hoverElevation ?? 4;
  }
  getHighlightElevation(button: ButtonThemeButton): number {
    return button.highlightElevation ?? 8;
  }
  getDisabledElevation(button: ButtonThemeButton): number {
    return button.disabledElevation ?? 0;
  }
  getPadding(button: ButtonThemeButton): EdgeInsetsGeometry {
    return (
      button.padding ??
      this.options.padding ??
      (this.getTextTheme(button) === ButtonTextTheme.primary ? primaryInset : inset)
    );
  }
  getShape(button: ButtonThemeButton): ShapeBorder {
    return button.shape ?? this.shape;
  }
  getAnimationDuration(button: ButtonThemeButton): number {
    return button.animationDuration ?? kThemeChangeDuration;
  }
  getConstraints(_button: ButtonThemeButton): BoxConstraints {
    return this.constraints;
  }
  getMaterialTapTargetSize(button: ButtonThemeButton): MaterialTapTargetSize {
    return (
      button.materialTapTargetSize ??
      this.options.materialTapTargetSize ??
      MaterialTapTargetSize.padded
    );
  }
  private get resolvedOptions(): Readonly<ButtonThemeDataOptions> {
    return {
      ...this.options,
      textTheme: this.textTheme,
      layoutBehavior: this.layoutBehavior,
      minWidth: this.minWidth,
      height: this.height,
      alignedDropdown: this.alignedDropdown,
      colorScheme: this.colorScheme,
      shape: this.shape,
      padding: this.padding,
    };
  }
  copyWith(options: ButtonThemeDataOptions = {}): ButtonThemeData {
    const values = this.resolvedOptions;
    return new ButtonThemeData(
      Object.fromEntries(optionNames.map((name) => [name, options[name] ?? values[name] ?? null])),
    );
  }
  equals(other: unknown): boolean {
    if (
      !(other instanceof ButtonThemeData) ||
      Object.getPrototypeOf(other) !== Object.getPrototypeOf(this)
    )
      return false;
    const a = this.resolvedOptions;
    const b = other.resolvedOptions;
    return optionNames.every((name) => valueEquals(a[name] ?? null, b[name] ?? null));
  }
  get hashCode(): number {
    const values = this.resolvedOptions;
    return hashValues(...optionNames.map((name) => values[name] ?? null));
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    const values = this.resolvedOptions;
    const defaults = new ButtonThemeData().resolvedOptions;
    for (const name of optionNames)
      properties.add(
        new DiagnosticsProperty(name, values[name] ?? null, {
          defaultValue: defaults[name] ?? null,
        }),
      );
  }
}

export interface ButtonThemeOptions extends ButtonThemeDataOptions, WidgetOptions {
  readonly child: Widget;
}
export class ButtonTheme extends InheritedTheme {
  readonly data: ButtonThemeData;
  constructor(
    { child, key = null, ...options }: ButtonThemeOptions,
    data = new ButtonThemeData(options),
  ) {
    super(child, key);
    this.data = data;
  }
  static fromButtonThemeData(
    data: ButtonThemeData,
    child: Widget,
    options: WidgetOptions = {},
  ): ButtonTheme {
    return new ButtonTheme({ child, ...options }, data);
  }
  static of(context: BuildContext): ButtonThemeData {
    const local = context.maybeDependOn(ButtonTheme)?.data;
    if (local?.colorScheme) return local;
    const theme = Theme.of(context);
    const data = local ?? theme.buttonTheme;
    return data.colorScheme
      ? data
      : data.copyWith({ colorScheme: theme.buttonTheme.colorScheme ?? theme.colorScheme });
  }
  override wrap(_context: BuildContext, child: Widget): Widget {
    return ButtonTheme.fromButtonThemeData(this.data, child);
  }
  override updateShouldNotify(old: ButtonTheme): boolean {
    return !this.data.equals(old.data);
  }
}
