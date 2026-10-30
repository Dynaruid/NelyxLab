// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Explicit specifications and source defaults from cupertino/theme.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a; public color getters use Nelyx ARGB.
import { Color } from '@nelyx/core/ui/color';
import { constSourceColor } from '@nelyx/core/internal/ui/color-source-adapter';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import {
  CupertinoColors,
  constCupertinoDynamicColorWithBrightness,
  createCupertinoColorProperty,
} from './colors.ts';
import { CupertinoTextThemeData, defaultCupertinoTextTheme } from './text-theme.ts';
import type { CupertinoTextDefaults } from './text-theme.ts';
import {
  cupertinoColorValue,
  cupertinoColorEquals,
  coreCupertinoColor,
  resolveCupertinoColor,
  registerThemePrimaryColor,
} from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import { cupertinoThemeBrightness } from './internal/theme/theme-brightness.ts';
const colorFields = [
  'primaryColor',
  'primaryContrastingColor',
  'barBackgroundColor',
  'scaffoldBackgroundColor',
  'selectionHandleColor',
] as const;
type ColorField = (typeof colorFields)[number];
export interface CupertinoThemeDataOptions {
  readonly brightness?: 'light' | 'dark' | null;
  readonly primaryColor?: CupertinoColor | null;
  readonly primaryContrastingColor?: CupertinoColor | null;
  readonly selectionHandleColor?: CupertinoColor | null;
  readonly barBackgroundColor?: CupertinoColor | null;
  readonly scaffoldBackgroundColor?: CupertinoColor | null;
  readonly textTheme?: CupertinoTextThemeData | null;
  readonly applyThemeToAll?: boolean | null;
}
type Specifications = {
  readonly [K in keyof Required<CupertinoThemeDataOptions>]: Exclude<
    CupertinoThemeDataOptions[K],
    undefined
  >;
};
function specifications(options: CupertinoThemeDataOptions): Specifications {
  return Object.freeze({
    brightness: options.brightness ?? null,
    primaryColor: options.primaryColor ?? null,
    primaryContrastingColor: options.primaryContrastingColor ?? null,
    textTheme: options.textTheme ?? null,
    barBackgroundColor: options.barBackgroundColor ?? null,
    scaffoldBackgroundColor: options.scaffoldBackgroundColor ?? null,
    selectionHandleColor: options.selectionHandleColor ?? null,
    applyThemeToAll: options.applyThemeToAll ?? null,
  });
}
function copied(spec: Specifications, options: CupertinoThemeDataOptions): Specifications {
  return specifications({
    brightness: options.brightness ?? spec.brightness,
    primaryColor: options.primaryColor ?? spec.primaryColor,
    primaryContrastingColor: options.primaryContrastingColor ?? spec.primaryContrastingColor,
    textTheme: options.textTheme ?? spec.textTheme,
    barBackgroundColor: options.barBackgroundColor ?? spec.barBackgroundColor,
    scaffoldBackgroundColor: options.scaffoldBackgroundColor ?? spec.scaffoldBackgroundColor,
    selectionHandleColor: options.selectionHandleColor ?? spec.selectionHandleColor,
    applyThemeToAll: options.applyThemeToAll ?? spec.applyThemeToAll,
  });
}
function resolved(spec: Specifications, context: BuildContext): Specifications {
  const color = (value: CupertinoColor | null) =>
    value === null ? null : resolveCupertinoColor(value, context);
  return specifications({
    ...spec,
    primaryColor: color(spec.primaryColor),
    primaryContrastingColor: color(spec.primaryContrastingColor),
    barBackgroundColor: color(spec.barBackgroundColor),
    scaffoldBackgroundColor: color(spec.scaffoldBackgroundColor),
    selectionHandleColor: color(spec.selectionHandleColor),
    textTheme: spec.textTheme?.resolveFrom(context) ?? null,
  });
}
export class NoDefaultCupertinoThemeData {
  protected readonly specified: Specifications;
  /** @internal Shared raw specification access for design theme subclasses. */
  protected static specificationsOf(value: NoDefaultCupertinoThemeData): Specifications {
    return value.specified;
  }
  constructor(options: CupertinoThemeDataOptions = {}) {
    this.specified = specifications(options);
    if (new.target === NoDefaultCupertinoThemeData) Object.freeze(this);
  }
  protected color(field: ColorField): CupertinoColor | null {
    return this.specified[field];
  }
  protected value(field: ColorField): number | null {
    const color = this.color(field);
    return color === null ? null : cupertinoColorValue(color);
  }
  get brightness(): 'light' | 'dark' | null {
    return this.specified.brightness;
  }
  get specifiedBrightness(): 'light' | 'dark' | null {
    return this.specified.brightness;
  }
  get primaryColor(): number | null {
    return this.value('primaryColor');
  }
  get primaryContrastingColor(): number | null {
    return this.value('primaryContrastingColor');
  }
  get selectionHandleColor(): number | null {
    return this.value('selectionHandleColor');
  }
  get barBackgroundColor(): number | null {
    return this.value('barBackgroundColor');
  }
  get scaffoldBackgroundColor(): number | null {
    return this.value('scaffoldBackgroundColor');
  }
  get textTheme(): CupertinoTextThemeData | null {
    return this.specified.textTheme;
  }
  get applyThemeToAll(): boolean | null {
    return this.specified.applyThemeToAll;
  }
  noDefault(): NoDefaultCupertinoThemeData {
    return this;
  }
  copyWith(options: CupertinoThemeDataOptions = {}): NoDefaultCupertinoThemeData {
    return new NoDefaultCupertinoThemeData(copied(this.specified, options));
  }
  resolveFrom(context: BuildContext): NoDefaultCupertinoThemeData {
    return new NoDefaultCupertinoThemeData(resolved(this.specified, context));
  }
  equals(other: unknown): boolean {
    if (this === other) return true;
    return (
      other instanceof NoDefaultCupertinoThemeData &&
      other.constructor === this.constructor &&
      other.specifiedBrightness === this.specifiedBrightness &&
      colorFields
        .filter((field) => field !== 'selectionHandleColor')
        .every((field) => cupertinoColorEquals(this.color(field), other.color(field))) &&
      (this.textTheme === other.textTheme || this.textTheme?.equals(other.textTheme) === true) &&
      this.applyThemeToAll === other.applyThemeToAll
    );
  }
  get hashCode(): number {
    return colorFields
      .filter((field) => field !== 'selectionHandleColor')
      .reduce(
        (hash, field) => (Math.imul(hash, 31) + (this.value(field) ?? 0)) | 0,
        (this.specifiedBrightness === 'dark' ? 2 : this.specifiedBrightness === 'light' ? 1 : 0) ^
          (this.textTheme?.hashCode ?? 0) ^
          (this.applyThemeToAll ? 1 : 0),
      );
  }
}
interface ThemeDefaults extends Readonly<Record<ColorField, CupertinoColor>> {
  readonly text: CupertinoTextDefaults;
  readonly applyThemeToAll: boolean;
  readonly effectiveBrightness?: 'light' | 'dark';
}
const defaults: ThemeDefaults = Object.freeze({
  primaryColor: CupertinoColors.systemBlue,
  primaryContrastingColor: CupertinoColors.white,
  barBackgroundColor: constCupertinoDynamicColorWithBrightness({
    color: constSourceColor(Color, 0xf0f9f9f9),
    darkColor: constSourceColor(Color, 0xf01d1d1d),
  }),
  scaffoldBackgroundColor: CupertinoColors.systemBackground,
  selectionHandleColor: CupertinoColors.systemBlue,
  applyThemeToAll: false,
  text: Object.freeze({ label: CupertinoColors.label, inactive: CupertinoColors.inactiveGray }),
});
export class CupertinoThemeData extends Diagnosticable(NoDefaultCupertinoThemeData) {
  /** @internal Preserve the protected adapter across the diagnostics mixin type. */
  protected static specificationsOf(value: NoDefaultCupertinoThemeData): Specifications {
    return NoDefaultCupertinoThemeData.specificationsOf(value);
  }
  private readonly defaults: ThemeDefaults;
  constructor(options: CupertinoThemeDataOptions = {}, sourceDefaults: ThemeDefaults = defaults) {
    super(options);
    this.defaults = sourceDefaults;
    registerThemePrimaryColor(this, () => this.color('primaryColor'));
    if (new.target === CupertinoThemeData) Object.freeze(this);
  }
  protected override color(field: ColorField): CupertinoColor {
    return this.specified[field] ?? this.defaults[field];
  }
  /** Effective Nelyx brightness. specifiedBrightness/noDefault retain source null. */
  override get brightness(): 'light' | 'dark' {
    return this.specifiedBrightness ?? this.defaults.effectiveBrightness ?? 'light';
  }
  override get primaryColor(): number {
    return this.value('primaryColor')!;
  }
  override get primaryContrastingColor(): number {
    return this.value('primaryContrastingColor')!;
  }
  override get selectionHandleColor(): number {
    return this.value('selectionHandleColor')!;
  }
  override get barBackgroundColor(): number {
    return this.value('barBackgroundColor')!;
  }
  override get scaffoldBackgroundColor(): number {
    return this.value('scaffoldBackgroundColor')!;
  }
  override get textTheme(): CupertinoTextThemeData {
    return (
      this.specified.textTheme ??
      defaultCupertinoTextTheme(this.color('primaryColor'), this.defaults.text)
    );
  }
  override get applyThemeToAll(): boolean {
    return this.specified.applyThemeToAll ?? this.defaults.applyThemeToAll;
  }
  override noDefault(): NoDefaultCupertinoThemeData {
    return new NoDefaultCupertinoThemeData(this.specified);
  }
  override copyWith(options: CupertinoThemeDataOptions = {}): CupertinoThemeData {
    return new CupertinoThemeData(copied(this.specified, options), this.defaults);
  }
  override resolveFrom(context: BuildContext): CupertinoThemeData {
    return new CupertinoThemeData(
      { ...resolved(this.specified, context), applyThemeToAll: this.applyThemeToAll },
      this.resolveDefaults(context),
    );
  }
  /** @internal Resolve default colors without baking them into specified overrides. */
  protected resolveDefaults(context: BuildContext): ThemeDefaults {
    const colors = Object.fromEntries(
      colorFields.map((field) => [field, resolveCupertinoColor(this.defaults[field], context)]),
    ) as Record<ColorField, CupertinoColor>;
    const text =
      this.specified.textTheme === null
        ? {
            label: resolveCupertinoColor(this.defaults.text.label, context),
            inactive: resolveCupertinoColor(this.defaults.text.inactive, context),
          }
        : this.defaults.text;
    return {
      ...colors,
      text,
      applyThemeToAll: this.defaults.applyThemeToAll,
      effectiveBrightness: cupertinoThemeBrightness(context) ?? 'light',
    };
  }
  override equals(other: unknown): boolean {
    return (
      super.equals(other) &&
      other instanceof CupertinoThemeData &&
      cupertinoColorEquals(this.color('selectionHandleColor'), other.color('selectionHandleColor'))
    );
  }
  override get hashCode(): number {
    return (Math.imul(super.hashCode, 31) + this.selectionHandleColor) | 0;
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    const standard = new CupertinoThemeData();
    properties.add(
      new DiagnosticsProperty('brightness', this.specifiedBrightness, { defaultValue: null }),
    );
    for (const field of colorFields)
      properties.add(
        createCupertinoColorProperty(field, coreCupertinoColor(this.color(field)), {
          defaultValue: coreCupertinoColor(standard.color(field)),
        }),
      );
    properties.add(
      new DiagnosticsProperty('applyThemeToAll', this.applyThemeToAll, {
        defaultValue: standard.applyThemeToAll,
      }),
    );
    this.textTheme.debugFillProperties(properties);
  }
}
