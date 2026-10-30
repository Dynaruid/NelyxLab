// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Resolved numeric API projection with explicit ports of HSV/HSL and their complete hue helpers.
import { Color } from '../../ui/color.ts';
import { clamp, modulo, roundInteger, protect } from '../../ui/value-math.ts';
import { lerpDouble } from '../../ui/lerp-double.generated.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { objectRuntimeType } from '../../foundation/object.ts';
import { diagnosticDoubleString } from '../../foundation/debug.ts';
import { hashValues } from './value-equality.ts';
import { applyDartType, captureDartType } from '../../foundation/dart-type-witness.ts';
import { registerDartValueSemantics } from '../../foundation/dart-value.ts';
import { canonicalDartObject } from '../../foundation/dart-const.ts';
export { ColorSwatch } from './color-swatch.ts';
/**
 * @dartParam red double
 * @dartParam green double
 * @dartParam blue double
 * @dartParam max double
 * @dartParam delta double
 * @dartReturn double
 */
function _getHue(red: number, green: number, blue: number, max: number, delta: number): number {
  let hue: number;
  if (max === 0) hue = 0;
  else if (max === red) hue = 60 * modulo((green - blue) / delta, 6);
  else if (max === green) hue = 60 * ((blue - red) / delta + 2);
  else if (max === blue) hue = 60 * ((red - green) / delta + 4);
  else throw new Error('Unreachable RGB maximum');
  return Number.isNaN(hue) ? 0 : hue;
}
/**
 * @dartParam a double
 * @dartParam b double
 * @dartParam t double
 * @dartReturn double
 */
function _lerpHue(a: number, b: number, t: number): number {
  let delta = b - a;
  if (delta > 180) delta -= 360;
  else if (delta < -180) delta += 360;
  return modulo(a + delta * t, 360);
}
/**
 * @dartParam alpha double
 * @dartParam hue double
 * @dartParam chroma double
 * @dartParam secondary double
 * @dartParam match double
 */
function _colorFromHue(
  alpha: number,
  hue: number,
  chroma: number,
  secondary: number,
  match: number,
): Color {
  const [red, green, blue] =
    hue < 60
      ? [chroma, secondary, 0]
      : hue < 120
        ? [secondary, chroma, 0]
        : hue < 180
          ? [0, chroma, secondary]
          : hue < 240
            ? [0, secondary, chroma]
            : hue < 300
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  return Color.fromARGB(
    roundInteger(alpha * 255),
    roundInteger((red! + match) * 255),
    roundInteger((green! + match) * 255),
    roundInteger((blue! + match) * 255),
  );
}
export class HSVColor {
  /** @dartType double */ readonly alpha: number;
  /** @dartType double */ readonly hue: number;
  /** @dartType double */ readonly saturation: number;
  /** @dartType double */ readonly value: number;
  /**
   * @dartParam alpha double
   * @dartParam hue double
   * @dartParam saturation double
   * @dartParam value double
   */
  constructor(alpha: number, hue: number, saturation: number, value: number) {
    if (FoundationBuildMode.debug)
      invariant(
        alpha >= 0 &&
          alpha <= 1 &&
          hue >= 0 &&
          hue <= 360 &&
          saturation >= 0 &&
          saturation <= 1 &&
          value >= 0 &&
          value <= 1,
        'invalid-hsx-color',
        'Color components are outside their source ranges',
      );
    this.alpha = alpha;
    this.hue = hue;
    this.saturation = saturation;
    this.value = value;
    captureDartType(this, sourceHSVColorType);
    protect(this, ['alpha', 'hue', 'saturation', 'value']);
    if (new.target === HSVColor) Object.freeze(this);
  }
  /**
   * @dartParam alpha double
   * @dartParam hue double
   * @dartParam saturation double
   * @dartParam value double
   */
  static fromAHSV(alpha: number, hue: number, saturation: number, value: number): HSVColor {
    return new HSVColor(alpha, hue, saturation, value);
  }
  static fromColor(color: Color): HSVColor {
    const red = color.red / 255,
      green = color.green / 255,
      blue = color.blue / 255,
      max = Math.max(red, Math.max(green, blue)),
      min = Math.min(red, Math.min(green, blue)),
      delta = max - min,
      alpha = color.alpha / 255,
      hue = _getHue(red, green, blue, max, delta);
    const saturation = max === 0 ? 0 : delta / max;
    return HSVColor.fromAHSV(alpha, hue, saturation, max);
  }
  /**
   * @dartParam alpha double
   */
  withAlpha(alpha: number): HSVColor {
    return HSVColor.fromAHSV(alpha, this.hue, this.saturation, this.value);
  }
  /**
   * @dartParam hue double
   */
  withHue(hue: number): HSVColor {
    return HSVColor.fromAHSV(this.alpha, hue, this.saturation, this.value);
  }
  /**
   * @dartParam saturation double
   */
  withSaturation(saturation: number): HSVColor {
    return HSVColor.fromAHSV(this.alpha, this.hue, saturation, this.value);
  }
  /**
   * @dartParam value double
   */
  withValue(value: number): HSVColor {
    return HSVColor.fromAHSV(this.alpha, this.hue, this.saturation, value);
  }
  toColor(): Color {
    const chroma = this.saturation * this.value,
      secondary = chroma * (1 - Math.abs(modulo(this.hue / 60, 2) - 1)),
      match = this.value - chroma;
    return _colorFromHue(this.alpha, this.hue, chroma, secondary, match);
  }
  /**
   * @dartParam factor double
   */
  private _scaleAlpha(factor: number): HSVColor {
    return this.withAlpha(this.alpha * factor);
  }
  /**
   * @dartParam t double
   */
  static lerp(a: HSVColor | null, b: HSVColor | null, t: number): HSVColor | null {
    if (a === b) return a;
    if (a === null) return b!._scaleAlpha(t);
    if (b === null) return a._scaleAlpha(1 - t);
    return HSVColor.fromAHSV(
      clamp(lerpDouble(a.alpha, b.alpha, t)!, 0, 1),
      _lerpHue(a.hue, b.hue, t),
      clamp(lerpDouble(a.saturation, b.saturation, t)!, 0, 1),
      clamp(lerpDouble(a.value, b.value, t)!, 0, 1),
    );
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof HSVColor &&
        other.alpha === this.alpha &&
        other.hue === this.hue &&
        other.saturation === this.saturation &&
        other.value === this.value)
    );
  }
  /**
   * @dartReturn int
   */
  get hashCode(): number {
    return hashValues(this.alpha, this.hue, this.saturation, this.value);
  }
  toString(): string {
    return (
      objectRuntimeType(this, 'HSVColor') +
      '(' +
      [this.alpha, this.hue, this.saturation, this.value].map(diagnosticDoubleString).join(', ') +
      ')'
    );
  }
}
export class HSLColor {
  /** @dartType double */ readonly alpha: number;
  /** @dartType double */ readonly hue: number;
  /** @dartType double */ readonly saturation: number;
  /** @dartType double */ readonly lightness: number;
  /**
   * @dartParam alpha double
   * @dartParam hue double
   * @dartParam saturation double
   * @dartParam lightness double
   */
  constructor(alpha: number, hue: number, saturation: number, lightness: number) {
    if (FoundationBuildMode.debug)
      invariant(
        alpha >= 0 &&
          alpha <= 1 &&
          hue >= 0 &&
          hue <= 360 &&
          saturation >= 0 &&
          saturation <= 1 &&
          lightness >= 0 &&
          lightness <= 1,
        'invalid-hsx-color',
        'Color components are outside their source ranges',
      );
    this.alpha = alpha;
    this.hue = hue;
    this.saturation = saturation;
    this.lightness = lightness;
    captureDartType(this, sourceHSLColorType);
    protect(this, ['alpha', 'hue', 'saturation', 'lightness']);
    if (new.target === HSLColor) Object.freeze(this);
  }
  /**
   * @dartParam alpha double
   * @dartParam hue double
   * @dartParam saturation double
   * @dartParam lightness double
   */
  static fromAHSL(alpha: number, hue: number, saturation: number, lightness: number): HSLColor {
    return new HSLColor(alpha, hue, saturation, lightness);
  }
  static fromColor(color: Color): HSLColor {
    const red = color.red / 255,
      green = color.green / 255,
      blue = color.blue / 255,
      max = Math.max(red, Math.max(green, blue)),
      min = Math.min(red, Math.min(green, blue)),
      delta = max - min,
      alpha = color.alpha / 255,
      hue = _getHue(red, green, blue, max, delta);
    const lightness = (max + min) / 2,
      saturation = min === max ? 0 : clamp(delta / (1 - Math.abs(2 * lightness - 1)), 0, 1);
    return HSLColor.fromAHSL(alpha, hue, saturation, lightness);
  }
  /**
   * @dartParam alpha double
   */
  withAlpha(alpha: number): HSLColor {
    return HSLColor.fromAHSL(alpha, this.hue, this.saturation, this.lightness);
  }
  /**
   * @dartParam hue double
   */
  withHue(hue: number): HSLColor {
    return HSLColor.fromAHSL(this.alpha, hue, this.saturation, this.lightness);
  }
  /**
   * @dartParam saturation double
   */
  withSaturation(saturation: number): HSLColor {
    return HSLColor.fromAHSL(this.alpha, this.hue, saturation, this.lightness);
  }
  /**
   * @dartParam lightness double
   */
  withLightness(lightness: number): HSLColor {
    return HSLColor.fromAHSL(this.alpha, this.hue, this.saturation, lightness);
  }
  toColor(): Color {
    const chroma = (1 - Math.abs(2 * this.lightness - 1)) * this.saturation,
      secondary = chroma * (1 - Math.abs(modulo(this.hue / 60, 2) - 1)),
      match = this.lightness - chroma / 2;
    return _colorFromHue(this.alpha, this.hue, chroma, secondary, match);
  }
  /**
   * @dartParam factor double
   */
  private _scaleAlpha(factor: number): HSLColor {
    return this.withAlpha(this.alpha * factor);
  }
  /**
   * @dartParam t double
   */
  static lerp(a: HSLColor | null, b: HSLColor | null, t: number): HSLColor | null {
    if (a === b) return a;
    if (a === null) return b!._scaleAlpha(t);
    if (b === null) return a._scaleAlpha(1 - t);
    return HSLColor.fromAHSL(
      clamp(lerpDouble(a.alpha, b.alpha, t)!, 0, 1),
      _lerpHue(a.hue, b.hue, t),
      clamp(lerpDouble(a.saturation, b.saturation, t)!, 0, 1),
      clamp(lerpDouble(a.lightness, b.lightness, t)!, 0, 1),
    );
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof HSLColor &&
        other.alpha === this.alpha &&
        other.hue === this.hue &&
        other.saturation === this.saturation &&
        other.lightness === this.lightness)
    );
  }
  /**
   * @dartReturn int
   */
  get hashCode(): number {
    return hashValues(this.alpha, this.hue, this.saturation, this.lightness);
  }
  toString(): string {
    return (
      objectRuntimeType(this, 'HSLColor') +
      '(' +
      [this.alpha, this.hue, this.saturation, this.lightness]
        .map(diagnosticDoubleString)
        .join(', ') +
      ')'
    );
  }
}
export const sourceHSVColorType = applyDartType<HSVColor>(HSVColor, 'HSVColor', [], []);
registerDartValueSemantics(HSVColor, {
  accepts: (value: unknown): value is HSVColor => value instanceof HSVColor,
  equals: (value, other) => value.equals(other),
  hash: (value) => value.hashCode,
  string: (value) => value.toString(),
});
/**
 * @dartParam alpha double
 * @dartParam hue double
 * @dartParam saturation double
 * @dartParam value double
 */
export function constHSVColor(
  alpha: number,
  hue: number,
  saturation: number,
  value: number,
): HSVColor {
  invariant(
    alpha >= 0 &&
      alpha <= 1 &&
      hue >= 0 &&
      hue <= 360 &&
      saturation >= 0 &&
      saturation <= 1 &&
      value >= 0 &&
      value <= 1,
    'invalid-hsx-const',
    'Const color components are outside their source ranges',
  );
  return canonicalDartObject(
    HSVColor,
    sourceHSVColorType,
    [
      ['alpha', 'double'],
      ['hue', 'double'],
      ['saturation', 'double'],
      ['value', 'double'],
    ],
    () => new HSVColor(alpha, hue, saturation, value),
    false,
  );
}
export const sourceHSLColorType = applyDartType<HSLColor>(HSLColor, 'HSLColor', [], []);
registerDartValueSemantics(HSLColor, {
  accepts: (value: unknown): value is HSLColor => value instanceof HSLColor,
  equals: (value, other) => value.equals(other),
  hash: (value) => value.hashCode,
  string: (value) => value.toString(),
});
/**
 * @dartParam alpha double
 * @dartParam hue double
 * @dartParam saturation double
 * @dartParam lightness double
 */
export function constHSLColor(
  alpha: number,
  hue: number,
  saturation: number,
  lightness: number,
): HSLColor {
  invariant(
    alpha >= 0 &&
      alpha <= 1 &&
      hue >= 0 &&
      hue <= 360 &&
      saturation >= 0 &&
      saturation <= 1 &&
      lightness >= 0 &&
      lightness <= 1,
    'invalid-hsx-const',
    'Const color components are outside their source ranges',
  );
  return canonicalDartObject(
    HSLColor,
    sourceHSLColorType,
    [
      ['alpha', 'double'],
      ['hue', 'double'],
      ['saturation', 'double'],
      ['lightness', 'double'],
    ],
    () => new HSLColor(alpha, hue, saturation, lightness),
    false,
  );
}
