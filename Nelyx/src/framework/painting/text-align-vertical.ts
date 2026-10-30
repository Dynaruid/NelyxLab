// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '../../foundation/errors.ts';
import { valueHash } from './value-equality.ts';
/** Vertical placement within an input container: -1 top, 0 center, 1 bottom. */
export class TextAlignVertical {
  readonly y: number;
  constructor({ y }: { readonly y: number }) {
    invariant(
      Number.isFinite(y) && y >= -1 && y <= 1,
      'invalid-text-align-vertical',
      'Vertical alignment must be in -1..1',
    );
    this.y = y;
    Object.freeze(this);
  }
  static readonly top = new TextAlignVertical({ y: -1 });
  static readonly center = new TextAlignVertical({ y: 0 });
  static readonly bottom = new TextAlignVertical({ y: 1 });
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof TextAlignVertical &&
        other.constructor === this.constructor &&
        other.y === this.y)
    );
  }
  get hashCode(): number {
    return valueHash(this.y);
  }
  toString(): string {
    return `TextAlignVertical(y: ${this.y.toFixed(1)})`;
  }
}
