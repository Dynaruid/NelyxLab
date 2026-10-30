// SPDX-License-Identifier: BSD-3-Clause
// Adapted from Flutter dart:ui geometry.dart at the recorded upstream pin.
import { number, hashDoubles, fixed, protect } from './value-math.ts';

/** Common immutable components and partial ordering for Offset and Size. */
export abstract class OffsetBase {
  protected readonly horizontal: number;
  protected readonly vertical: number;

  constructor(horizontal: number, vertical: number) {
    this.horizontal = number(horizontal);
    this.vertical = number(vertical);
    protect(this, ['horizontal', 'vertical']);
  }
  /** Positive infinity only, matching dart:ui even for negative infinity/NaN. */
  get isInfinite(): boolean {
    return this.horizontal >= Infinity || this.vertical >= Infinity;
  }
  get isFinite(): boolean {
    return Number.isFinite(this.horizontal) && Number.isFinite(this.vertical);
  }
  lessThan(other: OffsetBase): boolean {
    return this.horizontal < other.horizontal && this.vertical < other.vertical;
  }
  lessThanOrEqual(other: OffsetBase): boolean {
    return this.horizontal <= other.horizontal && this.vertical <= other.vertical;
  }
  greaterThan(other: OffsetBase): boolean {
    return this.horizontal > other.horizontal && this.vertical > other.vertical;
  }
  greaterThanOrEqual(other: OffsetBase): boolean {
    return this.horizontal >= other.horizontal && this.vertical >= other.vertical;
  }
  equals(other: unknown): boolean {
    return (
      other instanceof OffsetBase &&
      other.horizontal === this.horizontal &&
      other.vertical === this.vertical
    );
  }
  get hashCode(): number {
    return hashDoubles([this.horizontal, this.vertical]);
  }
  toString(): string {
    return `OffsetBase(${fixed(this.horizontal)}, ${fixed(this.vertical)})`;
  }
}
