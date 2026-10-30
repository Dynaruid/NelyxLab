// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
import { number, protect, hashDoubles } from './value-math.ts';
import { diagnosticDoubleString } from '../foundation/debug.ts';
export class ParagraphConstraints {
  readonly width: number;
  constructor({ width }: { readonly width: number }) {
    this.width = number(width);
    protect(this, ['width']);
  }
  equals(other: unknown): boolean {
    return (
      other instanceof ParagraphConstraints &&
      other.constructor === this.constructor &&
      other.width === this.width
    );
  }
  get hashCode(): number {
    return hashDoubles([this.width]);
  }
  toString(): string {
    return `ParagraphConstraints(width: ${diagnosticDoubleString(this.width)})`;
  }
}
