// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
import { Rect } from './rect.ts';
import { number, protect, hashDoubles, fixed } from './value-math.ts';
export const BoxHeightStyle = Object.freeze({
  tight: 'tight',
  max: 'max',
  includeLineSpacingMiddle: 'includeLineSpacingMiddle',
  includeLineSpacingTop: 'includeLineSpacingTop',
  includeLineSpacingBottom: 'includeLineSpacingBottom',
  strut: 'strut',
} as const);
export type BoxHeightStyle = (typeof BoxHeightStyle)[keyof typeof BoxHeightStyle];
export const BoxWidthStyle = Object.freeze({ tight: 'tight', max: 'max' } as const);
export type BoxWidthStyle = (typeof BoxWidthStyle)[keyof typeof BoxWidthStyle];
export class TextBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly direction: 'ltr' | 'rtl';
  constructor(left: number, top: number, right: number, bottom: number, direction: 'ltr' | 'rtl') {
    this.left = number(left);
    this.top = number(top);
    this.right = number(right);
    this.bottom = number(bottom);
    this.direction = direction;
    protect(this, ['left', 'top', 'right', 'bottom', 'direction']);
  }
  static fromLTRBD(
    left: number,
    top: number,
    right: number,
    bottom: number,
    direction: 'ltr' | 'rtl',
  ): TextBox {
    return new TextBox(left, top, right, bottom, direction);
  }
  toRect(): Rect {
    return Rect.fromLTRB(this.left, this.top, this.right, this.bottom);
  }
  get start(): number {
    return this.direction === 'ltr' ? this.left : this.right;
  }
  get end(): number {
    return this.direction === 'ltr' ? this.right : this.left;
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof TextBox &&
        other.constructor === this.constructor &&
        other.left === this.left &&
        other.top === this.top &&
        other.right === this.right &&
        other.bottom === this.bottom &&
        other.direction === this.direction)
    );
  }
  get hashCode(): number {
    return hashDoubles([
      this.left,
      this.top,
      this.right,
      this.bottom,
      this.direction === 'ltr' ? 0 : 1,
    ]);
  }
  toString(): string {
    return `TextBox.fromLTRBD(${[this.left, this.top, this.right, this.bottom].map(fixed).join(', ')}, TextDirection.${this.direction})`;
  }
}
