// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
import { protect, hashDoubles, checkedInteger } from './value-math.ts';
import { FoundationBuildMode } from '../foundation/constants.ts';
import { invariant } from '../foundation/errors.ts';
export class TextRange {
  readonly start: number;
  readonly end: number;
  constructor({ start, end }: { readonly start: number; readonly end: number }) {
    if (FoundationBuildMode.debug)
      invariant(
        start >= -1 && end >= -1,
        'invalid-text-range',
        'Text range offsets must be at least -1',
      );
    this.start = checkedInteger(start);
    this.end = checkedInteger(end);
    protect(this, ['start', 'end']);
  }
  static collapsed(offset: number): TextRange {
    return new TextRange({ start: offset, end: offset });
  }
  static readonly empty = new TextRange({ start: -1, end: -1 });
  get isValid(): boolean {
    return this.start >= 0 && this.end >= 0;
  }
  get isCollapsed(): boolean {
    return this.start === this.end;
  }
  get isNormalized(): boolean {
    return this.end >= this.start;
  }
  private substring(text: string, start: number, end: number = text.length): string {
    if (FoundationBuildMode.debug)
      invariant(
        this.isNormalized,
        'unnormalized-text-range',
        'TextRange substring requires a normalized range',
      );
    // JavaScript slice silently clamps invalid UTF-16 indices; Dart substring throws.
    invariant(
      Number.isInteger(start) &&
        Number.isInteger(end) &&
        start >= 0 &&
        end >= start &&
        end <= text.length,
      'text-range-out-of-bounds',
      'TextRange is outside the supplied text',
    );
    return text.slice(start, end);
  }
  textBefore(text: string): string {
    return this.substring(text, 0, this.start);
  }
  textAfter(text: string): string {
    return this.substring(text, this.end);
  }
  textInside(text: string): string {
    return this.substring(text, this.start, this.end);
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof TextRange && other.start === this.start && other.end === this.end)
    );
  }
  get hashCode(): number {
    return hashDoubles([this.start, this.end]);
  }
  toString(): string {
    return `TextRange(start: ${this.start}, end: ${this.end})`;
  }
}
