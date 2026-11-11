// SPDX-License-Identifier: BSD-3-Clause
// Host representation for the dart:core DateTime operations used by the pinned
// calendar sources. Local dates use civil components, never UTC-day arithmetic.
import { checkedInteger, hashDoubles } from '@nelyx/core/internal/ui/value-math';
import { applyDartType, captureDartType } from '@nelyx/core/foundation/dart-type-witness';
import { registerDartValueSemantics } from '@nelyx/core/internal/foundation/dart-value';

export class DateArgumentError extends RangeError {}
export function isDateArgumentError(value: unknown): value is DateArgumentError {
  return value instanceof DateArgumentError;
}
export function castDateArgumentError(value: unknown): DateArgumentError {
  if (!isDateArgumentError(value)) throw new TypeError('Expected date ArgumentError');
  return value;
}
// DateTime owns one civil-date reader. Never expose it: toDate() still returns
// an independent mutable copy. Date getters continue consulting the host time
// zone, including a zone change after this immutable value was constructed.
const civilDates = new WeakMap<DateTime, Date>();
export class DateTime {
  static readonly january = 1;
  static readonly february = 2;
  static readonly december = 12;
  static readonly monday = 1;
  static readonly sunday = 7;
  static readonly daysPerWeek = 7;
  static readonly monthsPerYear = 12;
  private readonly epoch: number;
  constructor(year: number, month = 1, day = 1, hour = 0, minute = 0, second = 0, millisecond = 0) {
    for (const component of [year, month, day, hour, minute, second, millisecond])
      checkedInteger(component);
    const value = new Date(0);
    value.setFullYear(year, month - 1, day);
    value.setHours(hour, minute, second, millisecond);
    if (!Number.isFinite(value.getTime()))
      throw new DateArgumentError('DateTime is outside the host date range');
    this.epoch = value.getTime();
    civilDates.set(this, value);
    captureDartType(this, dateTimeType);
    Object.freeze(this);
  }
  static fromDate(value: Date): DateTime {
    return DateTime.fromMillisecondsSinceEpoch(value.getTime());
  }
  static fromMillisecondsSinceEpoch(value: number): DateTime {
    checkedInteger(value);
    const civil = new Date(value);
    if (!Number.isFinite(civil.getTime())) throw new DateArgumentError('Invalid DateTime epoch');
    const date = Object.create(DateTime.prototype) as DateTime;
    Object.defineProperty(date, 'epoch', { value, enumerable: false });
    civilDates.set(date, civil);
    captureDartType(date, dateTimeType);
    Object.freeze(date);
    return date;
  }
  static now(): DateTime {
    return DateTime.fromMillisecondsSinceEpoch(Date.now());
  }
  toDate(): Date {
    return new Date(this.epoch);
  }
  get year(): number {
    return civilDates.get(this)!.getFullYear();
  }
  get month(): number {
    return civilDates.get(this)!.getMonth() + 1;
  }
  get day(): number {
    return civilDates.get(this)!.getDate();
  }
  get weekday(): number {
    return civilDates.get(this)!.getDay() || 7;
  }
  get millisecondsSinceEpoch(): number {
    return this.epoch;
  }
  isBefore(other: DateTime): boolean {
    return this.epoch < other.epoch;
  }
  isAfter(other: DateTime): boolean {
    return this.epoch > other.epoch;
  }
  compareTo(other: DateTime): number {
    return Math.sign(this.epoch - other.epoch);
  }
  difference(other: DateTime): number {
    return this.epoch - other.epoch;
  }
  equals(other: unknown): boolean {
    return other instanceof DateTime && this.epoch === other.epoch;
  }
  get hashCode(): number {
    return hashDoubles([this.epoch]);
  }
  toString(): string {
    const value = this.toDate();
    const pad = (n: number, width = 2) => String(n).padStart(width, '0');
    const year = this.year < 0 ? '-' + pad(-this.year, 4) : pad(this.year, 4);
    return `${year}-${pad(this.month)}-${pad(this.day)} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}.${pad(value.getMilliseconds(), 3)}`;
  }
}
export const dateTimeType = applyDartType<DateTime>(DateTime, 'DateTime', [], []);
export function isDateTime(value: unknown): value is DateTime {
  return value instanceof DateTime;
}
export function castDateTime(value: unknown): DateTime {
  if (!isDateTime(value)) throw new TypeError('Expected DateTime');
  return value;
}
registerDartValueSemantics(DateTime, {
  accepts: (value: unknown): value is DateTime => value instanceof DateTime,
  equals: (value, other) => value.equals(other),
  hash: (value) => value.hashCode,
  string: (value) => value.toString(),
});
