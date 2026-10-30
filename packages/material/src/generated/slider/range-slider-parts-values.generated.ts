// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/range_slider_parts.dart; SHA256 40edf0ec91169c78111e2cfb226456f056e9bb3d418b33bcb5e99d660308056e
import { protect } from '@nelyx/core/internal/ui/value-math';
import { checkedInteger } from '@nelyx/core/internal/ui/value-math';
import { boxSourceDartDouble } from '@nelyx/core/internal/foundation/dart-numeric';
import { sliderValueDoubleString } from '../../internal/slider/slider-values-source-adapter.ts';
import { sliderValueRuntimeType } from '../../internal/slider/slider-values-source-adapter.ts';
import { sliderValueHash } from '../../internal/slider/slider-values-source-adapter.ts';
import { sliderValueObjectRuntimeType } from '../../internal/slider/slider-values-source-adapter.ts';
export class RangeValues {
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  readonly start: number;
  /**
   * @dartType double
   * @dartTypeOrigin explicit
   */
  readonly end: number;
  /**
   * @dartParam start double
   * @dartParamOrigin start inferred
   * @dartParam end double
   * @dartParamOrigin end inferred
   */
  constructor(start: number, end: number) {
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField0 = start;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField1 = end;
    this.start = _initialField0;
    this.end = _initialField1;
    protect(this, ['start', 'end']);
  }
  equals(other: {}): boolean {
    if (!(sliderValueRuntimeType(other) === sliderValueRuntimeType(this))) {
      return false;
    }
    return (
      other instanceof RangeValues &&
      (other as RangeValues).start === this.start &&
      (other as RangeValues).end === this.end
    );
  }
  /**
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  get hashCode(): number {
    return checkedInteger(
      sliderValueHash(boxSourceDartDouble(this.start), boxSourceDartDouble(this.end)),
    );
  }
  toString(): string {
    return `${sliderValueObjectRuntimeType(this, 'RangeValues')}(${sliderValueDoubleString(this.start)}, ${sliderValueDoubleString(this.end)})`;
  }
}
export class RangeLabels {
  readonly start: string;
  readonly end: string;
  constructor(start: string, end: string) {
    const _initialField0 = start;
    const _initialField1 = end;
    this.start = _initialField0;
    this.end = _initialField1;
    protect(this, ['start', 'end']);
  }
  equals(other: {}): boolean {
    if (!(sliderValueRuntimeType(other) === sliderValueRuntimeType(this))) {
      return false;
    }
    return (
      other instanceof RangeLabels &&
      (other as RangeLabels).start === this.start &&
      (other as RangeLabels).end === this.end
    );
  }
  /**
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  get hashCode(): number {
    return checkedInteger(sliderValueHash(this.start, this.end));
  }
  toString(): string {
    return `${sliderValueObjectRuntimeType(this, 'RangeLabels')}(${this.start}, ${this.end})`;
  }
}
