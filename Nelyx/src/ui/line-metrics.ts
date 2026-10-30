// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
import { number, checkedInteger, protect, hashDoubles } from './value-math.ts';
import { diagnosticDoubleString } from '../foundation/debug.ts';
export interface LineMetricsOptions {
  readonly hardBreak: boolean;
  readonly ascent: number;
  readonly descent: number;
  readonly unscaledAscent: number;
  readonly height: number;
  readonly width: number;
  readonly left: number;
  readonly baseline: number;
  readonly lineNumber: number;
}
export class LineMetrics {
  readonly hardBreak: boolean;
  readonly ascent: number;
  readonly descent: number;
  readonly unscaledAscent: number;
  readonly height: number;
  readonly width: number;
  readonly left: number;
  readonly baseline: number;
  readonly lineNumber: number;
  constructor(o: LineMetricsOptions) {
    this.hardBreak = o.hardBreak;
    this.ascent = number(o.ascent);
    this.descent = number(o.descent);
    this.unscaledAscent = number(o.unscaledAscent);
    this.height = number(o.height);
    this.width = number(o.width);
    this.left = number(o.left);
    this.baseline = number(o.baseline);
    this.lineNumber = checkedInteger(o.lineNumber);
    protect(this, Object.keys(this));
  }
  equals(other: unknown): boolean {
    return (
      other instanceof LineMetrics &&
      other.constructor === this.constructor &&
      this.hardBreak === other.hardBreak &&
      this.ascent === other.ascent &&
      this.descent === other.descent &&
      this.unscaledAscent === other.unscaledAscent &&
      this.height === other.height &&
      this.width === other.width &&
      this.left === other.left &&
      this.baseline === other.baseline &&
      this.lineNumber === other.lineNumber
    );
  }
  get hashCode(): number {
    return hashDoubles([
      this.hardBreak ? 1 : 0,
      this.ascent,
      this.descent,
      this.unscaledAscent,
      this.height,
      this.width,
      this.left,
      this.baseline,
      this.lineNumber,
    ]);
  }
  toString(): string {
    return `LineMetrics(hardBreak: ${this.hardBreak}, ascent: ${diagnosticDoubleString(this.ascent)}, descent: ${diagnosticDoubleString(this.descent)}, unscaledAscent: ${diagnosticDoubleString(this.unscaledAscent)}, height: ${diagnosticDoubleString(this.height)}, width: ${diagnosticDoubleString(this.width)}, left: ${diagnosticDoubleString(this.left)}, baseline: ${diagnosticDoubleString(this.baseline)}, lineNumber: ${this.lineNumber})`;
  }
}
