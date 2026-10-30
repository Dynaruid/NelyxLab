// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Color } from '@nelyx/core/ui/color';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { BorderSide, OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { lerpToggleSides } from './internal/toggle/toggle-theme-values.ts';
import { nullableDartType } from '@nelyx/core/foundation/dart-type-witness';
import { sourceColorType, sourceColorLerp } from '@nelyx/core/ui/color-source';
import { valueEquals, hashValues } from '@nelyx/core/framework/painting/value-equality';
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { DoubleProperty, EnumProperty } from '@nelyx/core/foundation/diagnostic-properties';
import { ColorProperty } from '@nelyx/core/framework/painting/color-property';

export interface ChipThemeDataOptions {
  readonly color?: WidgetStateProperty<Color | null> | null;
  readonly backgroundColor?: Color | null;
  readonly deleteIconColor?: Color | null;
  readonly disabledColor?: Color | null;
  readonly selectedColor?: Color | null;
  readonly secondarySelectedColor?: Color | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly selectedShadowColor?: Color | null;
  readonly showCheckmark?: boolean | null;
  readonly checkmarkColor?: Color | null;
  readonly labelPadding?: EdgeInsetsGeometry | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly side?: BorderSide | null;
  readonly shape?: OutlinedBorder | null;
  readonly labelStyle?: TextStyle | null;
  readonly secondaryLabelStyle?: TextStyle | null;
  readonly brightness?: 'light' | 'dark' | null;
  readonly elevation?: number | null;
  readonly pressElevation?: number | null;
  readonly iconTheme?: IconThemeData | null;
  readonly avatarBoxConstraints?: BoxConstraints | null;
  readonly deleteIconBoxConstraints?: BoxConstraints | null;
}

const colorFields = [
    'backgroundColor',
    'deleteIconColor',
    'disabledColor',
    'selectedColor',
    'secondarySelectedColor',
    'shadowColor',
    'surfaceTintColor',
    'selectedShadowColor',
    'checkmarkColor',
  ] as const,
  fields = [
    'color',
    ...colorFields.slice(0, 8),
    'showCheckmark',
    'checkmarkColor',
    'labelPadding',
    'padding',
    'side',
    'shape',
    'labelStyle',
    'secondaryLabelStyle',
    'brightness',
    'elevation',
    'pressElevation',
    'iconTheme',
    'avatarBoxConstraints',
    'deleteIconBoxConstraints',
  ] as const;

export class ChipThemeData extends Diagnosticable(class {}) {
  readonly color: WidgetStateProperty<Color | null> | null;
  readonly backgroundColor: Color | null;
  readonly deleteIconColor: Color | null;
  readonly disabledColor: Color | null;
  readonly selectedColor: Color | null;
  readonly secondarySelectedColor: Color | null;
  readonly shadowColor: Color | null;
  readonly surfaceTintColor: Color | null;
  readonly selectedShadowColor: Color | null;
  readonly showCheckmark: boolean | null;
  readonly checkmarkColor: Color | null;
  readonly labelPadding: EdgeInsetsGeometry | null;
  readonly padding: EdgeInsetsGeometry | null;
  readonly side: BorderSide | null;
  readonly shape: OutlinedBorder | null;
  readonly labelStyle: TextStyle | null;
  readonly secondaryLabelStyle: TextStyle | null;
  readonly brightness: 'light' | 'dark' | null;
  readonly elevation: number | null;
  readonly pressElevation: number | null;
  readonly iconTheme: IconThemeData | null;
  readonly avatarBoxConstraints: BoxConstraints | null;
  readonly deleteIconBoxConstraints: BoxConstraints | null;
  constructor(o: ChipThemeDataOptions = {}) {
    super();
    this.color = o.color ?? null;
    this.backgroundColor = o.backgroundColor ?? null;
    this.deleteIconColor = o.deleteIconColor ?? null;
    this.disabledColor = o.disabledColor ?? null;
    this.selectedColor = o.selectedColor ?? null;
    this.secondarySelectedColor = o.secondarySelectedColor ?? null;
    this.shadowColor = o.shadowColor ?? null;
    this.surfaceTintColor = o.surfaceTintColor ?? null;
    this.selectedShadowColor = o.selectedShadowColor ?? null;
    this.showCheckmark = o.showCheckmark ?? null;
    this.checkmarkColor = o.checkmarkColor ?? null;
    this.labelPadding = o.labelPadding ?? null;
    this.padding = o.padding ?? null;
    this.side = o.side ?? null;
    this.shape = o.shape ?? null;
    this.labelStyle = o.labelStyle ?? null;
    this.secondaryLabelStyle = o.secondaryLabelStyle ?? null;
    this.brightness = o.brightness ?? null;
    this.elevation = o.elevation ?? null;
    this.pressElevation = o.pressElevation ?? null;
    this.iconTheme = o.iconTheme ?? null;
    this.avatarBoxConstraints = o.avatarBoxConstraints ?? null;
    this.deleteIconBoxConstraints = o.deleteIconBoxConstraints ?? null;
    if (new.target === ChipThemeData) Object.freeze(this);
  }
  copyWith(options: ChipThemeDataOptions = {}): ChipThemeData {
    return new ChipThemeData({
      ...Object.fromEntries(fields.map((f) => [f, this[f]])),
      ...Object.fromEntries(
        Object.entries(options).filter(([, v]) => v !== null && v !== undefined),
      ),
    });
  }
  static lerp(a: ChipThemeData | null, b: ChipThemeData | null, t: number): ChipThemeData | null {
    if (a === b) return a;
    const number = (x: number | null, y: number | null) =>
      x === y ? x : (x ?? 0) * (1 - t) + (y ?? 0) * t;
    const side = lerpToggleSides(a?.side ?? null, b?.side ?? null, t);
    return new ChipThemeData({
      ...Object.fromEntries(
        colorFields.map((f) => [f, Color.lerp(a?.[f] ?? null, b?.[f] ?? null, t)]),
      ),
      color: WidgetStateProperty.lerp<Color | null>(
        nullableDartType(sourceColorType),
        a?.color ?? null,
        b?.color ?? null,
        t,
        sourceColorLerp,
      ),
      showCheckmark: t < 0.5 ? (a?.showCheckmark ?? true) : (b?.showCheckmark ?? true),
      labelPadding: EdgeInsetsGeometry.lerp(a?.labelPadding ?? null, b?.labelPadding ?? null, t),
      padding: EdgeInsetsGeometry.lerp(a?.padding ?? null, b?.padding ?? null, t),
      side,
      shape: OutlinedBorder.lerp(a?.shape ?? null, b?.shape ?? null, t),
      labelStyle: TextStyle.lerp(a?.labelStyle ?? null, b?.labelStyle ?? null, t),
      secondaryLabelStyle: TextStyle.lerp(
        a?.secondaryLabelStyle ?? null,
        b?.secondaryLabelStyle ?? null,
        t,
      ),
      brightness: t < 0.5 ? (a?.brightness ?? 'light') : (b?.brightness ?? 'light'),
      elevation: number(a?.elevation ?? null, b?.elevation ?? null),
      pressElevation: number(a?.pressElevation ?? null, b?.pressElevation ?? null),
      iconTheme:
        (a?.iconTheme !== null && a?.iconTheme !== undefined) ||
        (b?.iconTheme !== null && b?.iconTheme !== undefined)
          ? IconThemeData.lerp(a?.iconTheme ?? null, b?.iconTheme ?? null, t)
          : null,
      avatarBoxConstraints: BoxConstraints.lerp(
        a?.avatarBoxConstraints,
        b?.avatarBoxConstraints,
        t,
      ),
      deleteIconBoxConstraints: BoxConstraints.lerp(
        a?.deleteIconBoxConstraints,
        b?.deleteIconBoxConstraints,
        t,
      ),
    });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof ChipThemeData &&
        other.constructor === this.constructor &&
        fields.every((f) => valueEquals(this[f], other[f])))
    );
  }
  get hashCode(): number {
    return hashValues(...fields.map((f) => this[f]));
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    for (const f of fields) {
      const value = this[f],
        name = f === 'checkmarkColor' ? 'checkMarkColor' : f;
      if (colorFields.includes(f as (typeof colorFields)[number]))
        properties.add(new ColorProperty(name, value as Color | null, { defaultValue: null }));
      else if (f === 'elevation' || f === 'pressElevation')
        properties.add(new DoubleProperty(f, this[f], { defaultValue: null }));
      else if (f === 'brightness')
        properties.add(
          new EnumProperty(f, this.brightness, { defaultValue: null, typeName: 'Brightness' }),
        );
      else
        properties.add(
          new DiagnosticsProperty(name, value, {
            defaultValue: null,
            typeName: (
              {
                color: 'WidgetStateProperty<Color?>',
                showCheckmark: 'bool',
                labelPadding: 'EdgeInsetsGeometry',
                padding: 'EdgeInsetsGeometry',
                side: 'BorderSide',
                shape: 'ShapeBorder',
                labelStyle: 'TextStyle',
                secondaryLabelStyle: 'TextStyle',
                iconTheme: 'IconThemeData',
                avatarBoxConstraints: 'BoxConstraints',
                deleteIconBoxConstraints: 'BoxConstraints',
              } as const
            )[f as 'color'],
          }),
        );
    }
  }
}
