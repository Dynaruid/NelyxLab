// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { DateTime } from '@nelyx/core/foundation/date-time';
import { invariant } from '@nelyx/core/foundation/errors';
import { hashValues } from '@nelyx/core/framework/painting/value-equality';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { RestorableValue } from '@nelyx/core/framework/widgets/restoration';
import { MaterialLocalizations } from './material-localizations.ts';

export enum DayPeriod {
  am = 'am',
  pm = 'pm',
}

export interface TimeOfDayOptions {
  readonly hour: number;
  readonly minute: number;
}

export class TimeOfDay {
  static readonly hoursPerDay = 24;
  static readonly hoursPerPeriod = 12;
  static readonly minutesPerHour = 60;
  readonly hour: number;
  readonly minute: number;

  constructor({ hour, minute }: TimeOfDayOptions) {
    invariant(
      Number.isSafeInteger(hour) &&
        hour >= 0 &&
        hour < TimeOfDay.hoursPerDay &&
        Number.isSafeInteger(minute) &&
        minute >= 0 &&
        minute < TimeOfDay.minutesPerHour,
      'invalid-time-of-day',
      'TimeOfDay requires an integer hour in 0–23 and minute in 0–59',
    );
    this.hour = hour;
    this.minute = minute;
    if (new.target === TimeOfDay) Object.freeze(this);
  }

  static fromDateTime(time: DateTime): TimeOfDay {
    return new TimeOfDay({ hour: time.hour, minute: time.minute });
  }

  static now(): TimeOfDay {
    return TimeOfDay.fromDateTime(DateTime.now());
  }

  replacing({
    hour,
    minute,
  }: { readonly hour?: number | null; readonly minute?: number | null } = {}): TimeOfDay {
    return new TimeOfDay({ hour: hour ?? this.hour, minute: minute ?? this.minute });
  }

  get period(): DayPeriod {
    return this.hour < TimeOfDay.hoursPerPeriod ? DayPeriod.am : DayPeriod.pm;
  }
  get periodOffset(): number {
    return this.period === DayPeriod.am ? 0 : TimeOfDay.hoursPerPeriod;
  }
  get hourOfPeriod(): number {
    return this.hour - this.periodOffset || TimeOfDay.hoursPerPeriod;
  }

  format(context: BuildContext): string {
    return MaterialLocalizations.of(context).formatTimeOfDay(this, {
      alwaysUse24HourFormat: MediaQuery.alwaysUse24HourFormatOf(context),
    });
  }

  compareTo(other: TimeOfDay): number {
    return Math.sign(this.hour - other.hour || this.minute - other.minute);
  }
  isBefore(other: TimeOfDay): boolean {
    return this.compareTo(other) < 0;
  }
  isAfter(other: TimeOfDay): boolean {
    return this.compareTo(other) > 0;
  }
  isAtSameTimeAs(other: TimeOfDay): boolean {
    return this.compareTo(other) === 0;
  }
  equals(other: unknown): boolean {
    return other instanceof TimeOfDay && this.hour === other.hour && this.minute === other.minute;
  }
  get hashCode(): number {
    return hashValues(this.hour, this.minute);
  }
  toString(): string {
    return `TimeOfDay(${String(this.hour).padStart(2, '0')}:${String(this.minute).padStart(2, '0')})`;
  }
}

export class RestorableTimeOfDay extends RestorableValue<TimeOfDay> {
  constructor(defaultValue: TimeOfDay) {
    super(defaultValue, (value) => {
      invariant(value instanceof TimeOfDay, 'invalid-restored-time', 'Expected a TimeOfDay');
      return value;
    });
  }

  override get value(): TimeOfDay {
    return super.value;
  }
  override set value(value: TimeOfDay) {
    this.ensureAlive();
    if (!super.value.equals(value)) super.value = value;
  }

  override toPrimitives(): readonly [minute: number, hour: number] {
    return [this.value.minute, this.value.hour];
  }

  override restore(value: unknown): void {
    invariant(
      Array.isArray(value) && value.length === 2,
      'invalid-restored-time',
      'Time restoration requires minute and hour',
    );
    const [minute, hour] = value as readonly unknown[];
    invariant(
      typeof minute === 'number' && typeof hour === 'number',
      'invalid-restored-time',
      'Time restoration requires numeric fields',
    );
    this.value = new TimeOfDay({ minute, hour });
  }
}

export enum TimeOfDayFormat {
  HH_colon_mm = 'HH_colon_mm',
  HH_dot_mm = 'HH_dot_mm',
  frenchCanadian = 'frenchCanadian',
  H_colon_mm = 'H_colon_mm',
  h_colon_mm_space_a = 'h_colon_mm_space_a',
  a_space_h_colon_mm = 'a_space_h_colon_mm',
}

export enum HourFormat {
  HH = 'HH',
  H = 'H',
  h = 'h',
}

export function hourFormat({ of }: { readonly of: TimeOfDayFormat }): HourFormat {
  if (of === TimeOfDayFormat.h_colon_mm_space_a || of === TimeOfDayFormat.a_space_h_colon_mm)
    return HourFormat.h;
  return of === TimeOfDayFormat.H_colon_mm ? HourFormat.H : HourFormat.HH;
}
