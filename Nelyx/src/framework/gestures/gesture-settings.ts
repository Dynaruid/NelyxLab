// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { hashDoubles } from '../../ui/value-math.ts';
import { diagnosticDoubleString } from '../../foundation/debug.ts';
export interface GestureSettingsView {
  readonly gestureSettings: { readonly physicalTouchSlop: number | null };
  readonly devicePixelRatio: number;
}
/** Logical-pixel settings. Native observation belongs to the embedding View. */
export class DeviceGestureSettings {
  readonly touchSlop: number | null;
  constructor({ touchSlop = null }: { readonly touchSlop?: number | null } = {}) {
    this.touchSlop = touchSlop;
    if (new.target === DeviceGestureSettings) Object.freeze(this);
  }
  static fromView(view: GestureSettingsView): DeviceGestureSettings {
    const value = view.gestureSettings.physicalTouchSlop;
    return new DeviceGestureSettings({
      touchSlop: value === null ? null : value / view.devicePixelRatio,
    });
  }
  get panSlop(): number | null {
    return this.touchSlop === null ? null : this.touchSlop * 2;
  }
  get hashCode(): number {
    return hashDoubles([this.touchSlop ?? -1, 23]);
  }
  equals(other: unknown): boolean {
    return (
      other instanceof DeviceGestureSettings &&
      Object.getPrototypeOf(other) === Object.getPrototypeOf(this) &&
      this.touchSlop === other.touchSlop
    );
  }
  toString(): string {
    return (
      'DeviceGestureSettings(touchSlop: ' +
      (this.touchSlop === null ? 'null' : diagnosticDoubleString(this.touchSlop)) +
      ')'
    );
  }
}
