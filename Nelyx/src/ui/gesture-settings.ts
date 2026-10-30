// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
import { hashDoubles } from './value-math.ts';
import { diagnosticDoubleString } from '../foundation/debug.ts';
export interface GestureSettingsOptions {
  readonly physicalTouchSlop?: number | null;
  readonly physicalDoubleTapSlop?: number | null;
}
/** Pinned dart:ui physical-pixel settings; actual host observation is separate. */
export class GestureSettings {
  readonly physicalTouchSlop: number | null;
  readonly physicalDoubleTapSlop: number | null;
  constructor({
    physicalTouchSlop = null,
    physicalDoubleTapSlop = null,
  }: GestureSettingsOptions = {}) {
    this.physicalTouchSlop = physicalTouchSlop;
    this.physicalDoubleTapSlop = physicalDoubleTapSlop;
    if (new.target === GestureSettings) Object.freeze(this);
  }
  copyWith({
    physicalTouchSlop,
    physicalDoubleTapSlop,
  }: GestureSettingsOptions = {}): GestureSettings {
    return new GestureSettings({
      physicalTouchSlop: physicalTouchSlop ?? this.physicalTouchSlop,
      physicalDoubleTapSlop: physicalDoubleTapSlop ?? this.physicalDoubleTapSlop,
    });
  }
  equals(other: unknown): boolean {
    return (
      other instanceof GestureSettings &&
      Object.getPrototypeOf(other) === Object.getPrototypeOf(this) &&
      other.physicalTouchSlop === this.physicalTouchSlop &&
      other.physicalDoubleTapSlop === this.physicalDoubleTapSlop
    );
  }
  get hashCode(): number {
    return hashDoubles([this.physicalTouchSlop ?? -1, this.physicalDoubleTapSlop ?? -1]);
  }
  toString(): string {
    const show = (value: number | null) =>
      value === null ? 'null' : diagnosticDoubleString(value);
    return (
      'GestureSettings(physicalTouchSlop: ' +
      show(this.physicalTouchSlop) +
      ', physicalDoubleTapSlop: ' +
      show(this.physicalDoubleTapSlop) +
      ')'
    );
  }
}
