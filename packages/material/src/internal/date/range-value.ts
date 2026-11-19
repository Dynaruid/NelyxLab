// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/date.dart and date_picker.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { hashValues } from '@nelyx/core/framework/painting/value-equality';
import type { DateTime } from './date-time.ts';

export type SelectableDayForRangePredicate = (
  day: DateTime,
  selectedStartDay: DateTime | null,
  selectedEndDay: DateTime | null,
) => boolean;

export class DateTimeRange<T extends DateTime = DateTime> {
  readonly start: T;
  readonly end: T;

  constructor({ start, end }: { readonly start: T; readonly end: T }) {
    invariant(
      !start.isAfter(end),
      'reversed-date-range',
      'Date range start must be on or before its end',
    );
    this.start = start;
    this.end = end;
  }

  /** Elapsed time in milliseconds, using the Core DateTime duration convention. */
  get duration(): number {
    return this.end.difference(this.start);
  }

  equals(other: unknown): boolean {
    return (
      other instanceof DateTimeRange &&
      other.constructor === this.constructor &&
      this.start.equals(other.start) &&
      this.end.equals(other.end)
    );
  }

  get hashCode(): number {
    return hashValues(this.start, this.end);
  }

  toString(): string {
    return `${this.start} - ${this.end}`;
  }
}
