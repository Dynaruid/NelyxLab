// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from dart:ui ColorFilter.
import { ImageFilter } from './image-filter.ts';
import type { BlendMode } from './paint.ts';
import { freezeColorFilter, effectColor } from './paint-effects-data.ts';
import type { ColorFilterSnapshot } from './paint-effects-data.ts';
import { blendModeValues as blendModes } from './blend-mode-data.ts';
import { invariant } from '../foundation/errors.ts';
import { hashDoubles } from './value-math.ts';
export class ColorFilter extends ImageFilter {
  private static readonly _kTypeMode = 1;
  private static readonly _kTypeMatrix = 2;
  private static readonly _kTypeLinearToSrgbGamma = 3;
  private static readonly _kTypeSrgbToLinearGamma = 4;
  private constructor(
    private readonly _type: number,
    private readonly _color: number | null,
    private readonly _blendMode: BlendMode | null,
    private readonly _matrix: ArrayLike<number> | null,
  ) {
    super();
  }
  static mode(color: number, blendMode: BlendMode): ColorFilter {
    effectColor(color);
    invariant(blendModes.includes(blendMode), 'invalid-color-filter', 'Unknown blend mode');
    return new ColorFilter(this._kTypeMode, color, blendMode, null);
  }
  /** Like the source const constructor, retain the supplied list. Recording
   * captures its current values into an immutable float32 frame snapshot. */
  static matrix(matrix: ArrayLike<number>): ColorFilter {
    invariant(matrix?.length === 20, 'invalid-color-filter', 'Color Matrix must have 20 entries.');
    return new ColorFilter(this._kTypeMatrix, null, null, matrix);
  }
  static linearToSrgbGamma(): ColorFilter {
    return new ColorFilter(this._kTypeLinearToSrgbGamma, null, null, null);
  }
  static srgbToLinearGamma(): ColorFilter {
    return new ColorFilter(this._kTypeSrgbToLinearGamma, null, null, null);
  }
  static saturation(saturation: number): ColorFilter {
    invariant(Number.isFinite(saturation), 'invalid-color-filter', 'Saturation must be finite');
    const inv = 1 - saturation,
      r = inv * 0.2126,
      g = inv * 0.7152,
      b = inv * 0.0722;
    return ColorFilter.matrix([
      r + saturation,
      g,
      b,
      0,
      0,
      r,
      g + saturation,
      b,
      0,
      0,
      r,
      g,
      b + saturation,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
    ]);
  }
  private _toNativeColorFilter(): ColorFilterSnapshot {
    switch (this._type) {
      case ColorFilter._kTypeMode:
        return freezeColorFilter({
          kind: 'colorMode',
          color: this._color!,
          blendMode: this._blendMode!,
        });
      case ColorFilter._kTypeMatrix:
        return freezeColorFilter({ kind: 'colorMatrix', matrix: Array.from(this._matrix!) });
      case ColorFilter._kTypeLinearToSrgbGamma:
        return Object.freeze({ kind: 'linearToSrgb' });
      case ColorFilter._kTypeSrgbToLinearGamma:
        return Object.freeze({ kind: 'srgbToLinear' });
      default:
        throw new Error('Unknown ColorFilter type.');
    }
  }
  private _toNativeImageFilter(): ColorFilterSnapshot {
    return this._toNativeColorFilter();
  }
  snapshot(): ColorFilterSnapshot {
    return this._toNativeImageFilter();
  }
  equals(other: unknown): boolean {
    if (
      !(other instanceof ColorFilter) ||
      other.constructor !== this.constructor ||
      other._type !== this._type ||
      other._color !== this._color ||
      other._blendMode !== this._blendMode
    )
      return false;
    if (other._matrix === this._matrix) return true;
    if (
      other._matrix === null ||
      this._matrix === null ||
      other._matrix.length !== this._matrix.length
    )
      return false;
    return Array.from(this._matrix).every((value, index) => value === other._matrix![index]);
  }
  get hashCode(): number {
    return hashDoubles([
      this._color ?? 0,
      this._blendMode === null ? -1 : blendModes.indexOf(this._blendMode),
      this._matrix === null ? -1 : hashDoubles(Array.from(this._matrix)),
      this._type,
    ]);
  }
  override get debugShortDescription(): string {
    return this.toString();
  }
  toString(): string {
    switch (this._type) {
      case ColorFilter._kTypeMode:
        return `ColorFilter.mode(0x${this._color!.toString(16).padStart(8, '0')}, BlendMode.${this._blendMode})`;
      case ColorFilter._kTypeMatrix:
        return `ColorFilter.matrix([${Array.from(this._matrix!).join(', ')}])`;
      case ColorFilter._kTypeLinearToSrgbGamma:
        return 'ColorFilter.linearToSrgbGamma()';
      case ColorFilter._kTypeSrgbToLinearGamma:
        return 'ColorFilter.srgbToLinearGamma()';
      default:
        return 'Unknown ColorFilter type.';
    }
  }
}
