// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { valueHash } from '@nelyx/core/framework/painting/value-equality';
import { registerFloatingLabelAlignment } from './internal/input/floating-label-values.ts';
const token = Symbol('FloatingLabelAlignment');
export class FloatingLabelAlignment {
  /** @dartType double */
  private readonly x: number;
  /** @dartParam x double */
  private constructor(x: number, own: typeof token) {
    if (own !== token || x < -1 || x > 1)
      throw new TypeError('Expected a canonical FloatingLabelAlignment');
    this.x = x;
    registerFloatingLabelAlignment(this, x);
    Object.freeze(this);
  }
  static readonly start = new FloatingLabelAlignment(-1, token);
  static readonly center = new FloatingLabelAlignment(0, token);
  /** @dartReturn int */
  get hashCode(): number {
    return valueHash(this.x);
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof FloatingLabelAlignment &&
        other.constructor === this.constructor &&
        other.x === this.x)
    );
  }
  /** @dartParam x double */
  private static stringify(x: number): string {
    return x === -1
      ? 'FloatingLabelAlignment.start'
      : x === 0
        ? 'FloatingLabelAlignment.center'
        : `FloatingLabelAlignment(x: ${x.toFixed(1)})`;
  }
  toString(): string {
    return FloatingLabelAlignment.stringify(this.x);
  }
}
Object.freeze(FloatingLabelAlignment.prototype);
Object.freeze(FloatingLabelAlignment);
