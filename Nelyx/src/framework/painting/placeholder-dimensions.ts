// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Size } from '../../ui/size.ts';
import type { PlaceholderAlignment, TextBaseline } from '../../ui/typography.ts';
import { protect } from '../../ui/value-math.ts';
import { hashValues } from './value-equality.ts';
import { diagnosticDoubleString } from '../../foundation/debug.ts';
export class PlaceholderDimensions {
  static readonly empty = new PlaceholderDimensions({ size: Size.zero, alignment: 'bottom' });
  readonly size: Size;
  readonly alignment: PlaceholderAlignment;
  readonly baseline: TextBaseline | null;
  readonly baselineOffset: number | null;
  constructor({
    size,
    alignment,
    baseline = null,
    baselineOffset = null,
  }: {
    readonly size: Size;
    readonly alignment: PlaceholderAlignment;
    readonly baseline?: TextBaseline | null;
    readonly baselineOffset?: number | null;
  }) {
    this.size = size;
    this.alignment = alignment;
    this.baseline = baseline;
    this.baselineOffset = baselineOffset;
    protect(this, ['size', 'alignment', 'baseline', 'baselineOffset']);
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof PlaceholderDimensions &&
        this.size.equals(other.size) &&
        this.alignment === other.alignment &&
        this.baseline === other.baseline &&
        this.baselineOffset === other.baselineOffset)
    );
  }
  get hashCode(): number {
    return hashValues(this.size, this.alignment, this.baseline, this.baselineOffset);
  }
  toString(): string {
    return `PlaceholderDimensions(${this.size}, PlaceholderAlignment.${this.alignment}${this.alignment === 'baseline' ? `(${this.baselineOffset === null ? 'null' : diagnosticDoubleString(this.baselineOffset)} from top)` : ''})`;
  }
}
