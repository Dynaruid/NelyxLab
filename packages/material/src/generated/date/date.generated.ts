// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/date.dart; SHA256 faea33901237c660f53eca16aec94d97073f375176329eac8521fbe4b5726eb6
import { protect } from '@nelyx/core/internal/ui/value-math';
import { checkedInteger } from '@nelyx/core/internal/ui/value-math';
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { applyDartType } from '@nelyx/core/internal/foundation/dart-type-witness';
import { captureDartType } from '@nelyx/core/internal/foundation/dart-type-witness';
import { readDartType } from '@nelyx/core/internal/foundation/dart-type-witness';
import { isDartType } from '@nelyx/core/internal/foundation/dart-type-witness';
import { castDartType } from '@nelyx/core/internal/foundation/dart-type-witness';
import { nullableDartType } from '@nelyx/core/internal/foundation/dart-type-witness';
import { boxSourceDartInt } from '@nelyx/core/internal/foundation/dart-numeric';
import { castSourceDartInt } from '@nelyx/core/internal/foundation/dart-numeric';
import { sourceStyleRuntimeType } from '../../internal/date/source-values.ts';
import { sourceStyleHash } from '../../internal/date/source-values.ts';
import { MaterialLocalizations } from '../../material-localizations.ts';
import { modulo } from '@nelyx/core/internal/ui/value-math';
import { dartValueString } from '@nelyx/core/internal/foundation/dart-value';
import { DateTime } from '../../internal/date/date-time.ts';
import { dateTimeType } from '../../internal/date/date-time.ts';
import { dateListAt } from '../../internal/date/source-values.ts';
import type { ScrollbarSourceList } from '@nelyx/core/internal/framework/widgets/scrollbar-painter-source-adapter';
import type { DartTypeWitness } from '@nelyx/core/internal/foundation/dart-type-witness';
import type { DartInt } from '@nelyx/core/internal/foundation/dart-numeric';
const _dartTemporary0 = Symbol();
export class DatePickerEntryMode {
  /**
   * @dartType int
   * @dartTypeOrigin explicit
   */
  readonly index: number;
  private readonly _dartTemporary1!: void;
  /**
   * @dartParam index int
   * @dartParamOrigin index explicit
   */
  private constructor(
    index: number,
    readonly name: string,
    token: typeof _dartTemporary0,
  ) {
    if (token !== _dartTemporary0) throw new TypeError('Enum values cannot be constructed');
    this.index = index;
    Object.freeze(this);
  }
  static readonly calendar: DatePickerEntryMode = new DatePickerEntryMode(
    0,
    'calendar',
    _dartTemporary0,
  );
  static readonly input: DatePickerEntryMode = new DatePickerEntryMode(1, 'input', _dartTemporary0);
  static readonly calendarOnly: DatePickerEntryMode = new DatePickerEntryMode(
    2,
    'calendarOnly',
    _dartTemporary0,
  );
  static readonly inputOnly: DatePickerEntryMode = new DatePickerEntryMode(
    3,
    'inputOnly',
    _dartTemporary0,
  );
  static readonly values: ReadonlyArray<DatePickerEntryMode> = Object.freeze([
    DatePickerEntryMode.calendar,
    DatePickerEntryMode.input,
    DatePickerEntryMode.calendarOnly,
    DatePickerEntryMode.inputOnly,
  ]);
  toString(): string {
    return 'DatePickerEntryMode.' + this.name;
  }
}
Object.freeze(DatePickerEntryMode.prototype);
Object.freeze(DatePickerEntryMode);
const _dartTemporary2 = Symbol();
export class DatePickerMode {
  /**
   * @dartType int
   * @dartTypeOrigin explicit
   */
  readonly index: number;
  private readonly _dartTemporary3!: void;
  /**
   * @dartParam index int
   * @dartParamOrigin index explicit
   */
  private constructor(
    index: number,
    readonly name: string,
    token: typeof _dartTemporary2,
  ) {
    if (token !== _dartTemporary2) throw new TypeError('Enum values cannot be constructed');
    this.index = index;
    Object.freeze(this);
  }
  static readonly day: DatePickerMode = new DatePickerMode(0, 'day', _dartTemporary2);
  static readonly year: DatePickerMode = new DatePickerMode(1, 'year', _dartTemporary2);
  static readonly values: ReadonlyArray<DatePickerMode> = Object.freeze([
    DatePickerMode.day,
    DatePickerMode.year,
  ]);
  toString(): string {
    return 'DatePickerMode.' + this.name;
  }
}
Object.freeze(DatePickerMode.prototype);
Object.freeze(DatePickerMode);
export abstract class CalendarDelegate<T extends DateTime> {
  constructor(_dartTemporary4: DartTypeWitness<T>) {
    captureDartType(
      this,
      applyDartType<CalendarDelegate<T>>(
        CalendarDelegate,
        'CalendarDelegate',
        [_dartTemporary4],
        [],
      ),
    );
  }
  abstract now(): T;
  abstract dateOnly(date: T): T;
  datesOnly(range: DateTimeRange<T>): DateTimeRange<T> {
    return new DateTimeRange<T>(readDartType<T>(this, CalendarDelegate, 0), {
      start: this.dateOnly(range.start),
      end: this.dateOnly(range.end),
    });
  }
  isSameDay(dateA: T | null, dateB: T | null): boolean {
    castDartType<T | null>(dateA, nullableDartType<T>(readDartType<T>(this, CalendarDelegate, 0)));
    castDartType<T | null>(dateB, nullableDartType<T>(readDartType<T>(this, CalendarDelegate, 0)));
    return (
      (() => {
        const _dartTemporary5 = dateA;
        return _dartTemporary5 === null ? null : _dartTemporary5.year;
      })() ===
        (() => {
          const _dartTemporary6 = dateB;
          return _dartTemporary6 === null ? null : _dartTemporary6.year;
        })() &&
      (() => {
        const _dartTemporary7 = dateA;
        return _dartTemporary7 === null ? null : _dartTemporary7.month;
      })() ===
        (() => {
          const _dartTemporary8 = dateB;
          return _dartTemporary8 === null ? null : _dartTemporary8.month;
        })() &&
      (() => {
        const _dartTemporary9 = dateA;
        return _dartTemporary9 === null ? null : _dartTemporary9.day;
      })() ===
        (() => {
          const _dartTemporary10 = dateB;
          return _dartTemporary10 === null ? null : _dartTemporary10.day;
        })()
    );
  }
  isSameMonth(dateA: T | null, dateB: T | null): boolean {
    castDartType<T | null>(dateA, nullableDartType<T>(readDartType<T>(this, CalendarDelegate, 0)));
    castDartType<T | null>(dateB, nullableDartType<T>(readDartType<T>(this, CalendarDelegate, 0)));
    return (
      (() => {
        const _dartTemporary11 = dateA;
        return _dartTemporary11 === null ? null : _dartTemporary11.year;
      })() ===
        (() => {
          const _dartTemporary12 = dateB;
          return _dartTemporary12 === null ? null : _dartTemporary12.year;
        })() &&
      (() => {
        const _dartTemporary13 = dateA;
        return _dartTemporary13 === null ? null : _dartTemporary13.month;
      })() ===
        (() => {
          const _dartTemporary14 = dateB;
          return _dartTemporary14 === null ? null : _dartTemporary14.month;
        })()
    );
  }
  /**
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  abstract monthDelta(startDate: T, endDate: T): number;
  /**
   * @dartParam monthsToAdd int
   * @dartParamOrigin monthsToAdd explicit
   */
  abstract addMonthsToMonthDate(monthDate: T, monthsToAdd: number): T;
  /**
   * @dartParam days int
   * @dartParamOrigin days explicit
   */
  abstract addDaysToDate(date: T, days: number): T;
  /**
   * @dartParam year int
   * @dartParamOrigin year explicit
   * @dartParam month int
   * @dartParamOrigin month explicit
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  abstract firstDayOffset(
    year: number,
    month: number,
    localizations: MaterialLocalizations,
  ): number;
  /**
   * @dartParam year int
   * @dartParamOrigin year explicit
   * @dartParam month int
   * @dartParamOrigin month explicit
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  abstract getDaysInMonth(year: number, month: number): number;
  /**
   * @dartParam year int
   * @dartParamOrigin year explicit
   * @dartParam month int
   * @dartParamOrigin month explicit
   */
  abstract getMonth(year: number, month: number): T;
  /**
   * @dartParam year int
   * @dartParamOrigin year explicit
   * @dartParam month int
   * @dartParamOrigin month explicit
   * @dartParam day int
   * @dartParamOrigin day explicit
   */
  abstract getDay(year: number, month: number, day: number): T;
  abstract formatMonthYear(date: T, localizations: MaterialLocalizations): string;
  /**
   * @dartParam year int
   * @dartParamOrigin year explicit
   */
  formatYear(year: number, localizations: MaterialLocalizations): string {
    checkedInteger(year);
    return localizations.formatYear(new DateTime(checkedInteger(year)));
  }
  abstract formatMediumDate(date: T, localizations: MaterialLocalizations): string;
  abstract formatShortMonthDay(date: T, localizations: MaterialLocalizations): string;
  abstract formatShortDate(date: T, localizations: MaterialLocalizations): string;
  abstract formatFullDate(date: T, localizations: MaterialLocalizations): string;
  abstract formatCompactDate(date: T, localizations: MaterialLocalizations): string;
  abstract parseCompactDate(
    inputString: string | null,
    localizations: MaterialLocalizations,
  ): T | null;
  abstract dateHelpText(localizations: MaterialLocalizations): string;
}
export class GregorianCalendarDelegate extends CalendarDelegate<DateTime> {
  constructor() {
    super(dateTimeType);
    captureDartType(
      this,
      applyDartType<GregorianCalendarDelegate>(
        GregorianCalendarDelegate,
        'GregorianCalendarDelegate',
        [],
        [
          applyDartType<CalendarDelegate<DateTime>>(
            CalendarDelegate,
            'CalendarDelegate',
            [dateTimeType],
            [],
          ),
        ],
      ),
    );
  }
  override now(): DateTime {
    return DateTime.now();
  }
  override dateOnly(date: DateTime): DateTime {
    return DateUtils.dateOnly(date);
  }
  /**
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  override monthDelta(startDate: DateTime, endDate: DateTime): number {
    return checkedInteger(DateUtils.monthDelta(startDate, endDate));
  }
  /**
   * @dartParam monthsToAdd int
   * @dartParamOrigin monthsToAdd explicit
   */
  override addMonthsToMonthDate(monthDate: DateTime, monthsToAdd: number): DateTime {
    checkedInteger(monthsToAdd);
    return DateUtils.addMonthsToMonthDate(monthDate, checkedInteger(monthsToAdd));
  }
  /**
   * @dartParam days int
   * @dartParamOrigin days explicit
   */
  override addDaysToDate(date: DateTime, days: number): DateTime {
    checkedInteger(days);
    return DateUtils.addDaysToDate(date, checkedInteger(days));
  }
  /**
   * @dartParam year int
   * @dartParamOrigin year explicit
   * @dartParam month int
   * @dartParamOrigin month explicit
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  override firstDayOffset(
    year: number,
    month: number,
    localizations: MaterialLocalizations,
  ): number {
    checkedInteger(year);
    checkedInteger(month);
    return checkedInteger(
      DateUtils.firstDayOffset(checkedInteger(year), checkedInteger(month), localizations),
    );
  }
  /**
   * @dartParam year int
   * @dartParamOrigin year explicit
   * @dartParam month int
   * @dartParamOrigin month explicit
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  override getDaysInMonth(year: number, month: number): number {
    checkedInteger(year);
    checkedInteger(month);
    return checkedInteger(DateUtils.getDaysInMonth(checkedInteger(year), checkedInteger(month)));
  }
  /**
   * @dartParam year int
   * @dartParamOrigin year explicit
   * @dartParam month int
   * @dartParamOrigin month explicit
   */
  override getMonth(year: number, month: number): DateTime {
    checkedInteger(year);
    checkedInteger(month);
    return new DateTime(checkedInteger(year), checkedInteger(month));
  }
  /**
   * @dartParam year int
   * @dartParamOrigin year explicit
   * @dartParam month int
   * @dartParamOrigin month explicit
   * @dartParam day int
   * @dartParamOrigin day explicit
   */
  override getDay(year: number, month: number, day: number): DateTime {
    checkedInteger(year);
    checkedInteger(month);
    checkedInteger(day);
    return new DateTime(checkedInteger(year), checkedInteger(month), checkedInteger(day));
  }
  override formatMonthYear(date: DateTime, localizations: MaterialLocalizations): string {
    return localizations.formatMonthYear(date);
  }
  override formatMediumDate(date: DateTime, localizations: MaterialLocalizations): string {
    return localizations.formatMediumDate(date);
  }
  override formatShortMonthDay(date: DateTime, localizations: MaterialLocalizations): string {
    return localizations.formatShortMonthDay(date);
  }
  override formatShortDate(date: DateTime, localizations: MaterialLocalizations): string {
    return localizations.formatShortDate(date);
  }
  override formatFullDate(date: DateTime, localizations: MaterialLocalizations): string {
    return localizations.formatFullDate(date);
  }
  override formatCompactDate(date: DateTime, localizations: MaterialLocalizations): string {
    return localizations.formatCompactDate(date);
  }
  override parseCompactDate(
    inputString: string | null,
    localizations: MaterialLocalizations,
  ): DateTime | null {
    return localizations.parseCompactDate(inputString);
  }
  override dateHelpText(localizations: MaterialLocalizations): string {
    return localizations.dateHelpText;
  }
}
export abstract class DateUtils {
  constructor() {}
  static dateOnly(date: DateTime): DateTime {
    return new DateTime(
      checkedInteger(date.year),
      checkedInteger(date.month),
      checkedInteger(date.day),
    );
  }
  static datesOnly(range: DateTimeRange<DateTime>): DateTimeRange<DateTime> {
    return new DateTimeRange<DateTime>(dateTimeType, {
      start: DateUtils.dateOnly(range.start),
      end: DateUtils.dateOnly(range.end),
    });
  }
  static isSameDay(dateA: DateTime | null, dateB: DateTime | null): boolean {
    return (
      (() => {
        const _dartTemporary15 = dateA;
        return _dartTemporary15 === null ? null : _dartTemporary15.year;
      })() ===
        (() => {
          const _dartTemporary16 = dateB;
          return _dartTemporary16 === null ? null : _dartTemporary16.year;
        })() &&
      (() => {
        const _dartTemporary17 = dateA;
        return _dartTemporary17 === null ? null : _dartTemporary17.month;
      })() ===
        (() => {
          const _dartTemporary18 = dateB;
          return _dartTemporary18 === null ? null : _dartTemporary18.month;
        })() &&
      (() => {
        const _dartTemporary19 = dateA;
        return _dartTemporary19 === null ? null : _dartTemporary19.day;
      })() ===
        (() => {
          const _dartTemporary20 = dateB;
          return _dartTemporary20 === null ? null : _dartTemporary20.day;
        })()
    );
  }
  static isSameMonth(dateA: DateTime | null, dateB: DateTime | null): boolean {
    return (
      (() => {
        const _dartTemporary21 = dateA;
        return _dartTemporary21 === null ? null : _dartTemporary21.year;
      })() ===
        (() => {
          const _dartTemporary22 = dateB;
          return _dartTemporary22 === null ? null : _dartTemporary22.year;
        })() &&
      (() => {
        const _dartTemporary23 = dateA;
        return _dartTemporary23 === null ? null : _dartTemporary23.month;
      })() ===
        (() => {
          const _dartTemporary24 = dateB;
          return _dartTemporary24 === null ? null : _dartTemporary24.month;
        })()
    );
  }
  /**
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  static monthDelta(startDate: DateTime, endDate: DateTime): number {
    return checkedInteger(
      checkedInteger(
        checkedInteger(
          checkedInteger(
            checkedInteger(checkedInteger(endDate.year) - checkedInteger(startDate.year)),
          ) * 12,
        ) + checkedInteger(endDate.month),
      ) - checkedInteger(startDate.month),
    );
  }
  /**
   * @dartParam monthsToAdd int
   * @dartParamOrigin monthsToAdd explicit
   */
  static addMonthsToMonthDate(monthDate: DateTime, monthsToAdd: number): DateTime {
    checkedInteger(monthsToAdd);
    return new DateTime(
      checkedInteger(monthDate.year),
      checkedInteger(checkedInteger(monthDate.month) + checkedInteger(monthsToAdd)),
    );
  }
  /**
   * @dartParam days int
   * @dartParamOrigin days explicit
   */
  static addDaysToDate(date: DateTime, days: number): DateTime {
    checkedInteger(days);
    return new DateTime(
      checkedInteger(date.year),
      checkedInteger(date.month),
      checkedInteger(checkedInteger(date.day) + checkedInteger(days)),
    );
  }
  /**
   * @dartParam year int
   * @dartParamOrigin year explicit
   * @dartParam month int
   * @dartParamOrigin month explicit
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  static firstDayOffset(year: number, month: number, localizations: MaterialLocalizations): number {
    checkedInteger(year);
    checkedInteger(month);
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const weekdayFromMonday: number = checkedInteger(
      checkedInteger(new DateTime(checkedInteger(year), checkedInteger(month)).weekday) - 1,
    );
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    let firstDayOfWeekIndex: number = checkedInteger(localizations.firstDayOfWeekIndex);
    void checkedInteger(
      (firstDayOfWeekIndex = checkedInteger(
        modulo(checkedInteger(checkedInteger(checkedInteger(firstDayOfWeekIndex) - 1)), 7),
      )),
    );
    return checkedInteger(
      modulo(
        checkedInteger(
          checkedInteger(checkedInteger(weekdayFromMonday) - checkedInteger(firstDayOfWeekIndex)),
        ),
        7,
      ),
    );
  }
  /**
   * @dartParam year int
   * @dartParamOrigin year explicit
   * @dartParam month int
   * @dartParamOrigin month explicit
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  static getDaysInMonth(year: number, month: number): number {
    checkedInteger(year);
    checkedInteger(month);
    if (checkedInteger(month) === checkedInteger(DateTime.february)) {
      const isLeapYear: boolean =
        (checkedInteger(modulo(checkedInteger(year), 4)) === 0 &&
          checkedInteger(modulo(checkedInteger(year), 100)) !== 0) ||
        checkedInteger(modulo(checkedInteger(year), 400)) === 0;
      return checkedInteger(isLeapYear ? 29 : 28);
    }
    /**
     * @dartType List<int>
     * @dartTypeOrigin inferred
     */
    const daysInMonth: ScrollbarSourceList<DartInt> = [
      boxSourceDartInt(31),
      boxSourceDartInt(checkedInteger(-1)),
      boxSourceDartInt(31),
      boxSourceDartInt(30),
      boxSourceDartInt(31),
      boxSourceDartInt(30),
      boxSourceDartInt(31),
      boxSourceDartInt(31),
      boxSourceDartInt(30),
      boxSourceDartInt(31),
      boxSourceDartInt(30),
      boxSourceDartInt(31),
    ];
    return checkedInteger(
      castSourceDartInt(dateListAt(daysInMonth, checkedInteger(checkedInteger(month) - 1))),
    );
  }
}
export class DateTimeRange<T extends DateTime> {
  readonly start: T;
  readonly end: T;
  constructor(
    _dartTemporary25: DartTypeWitness<T>,
    {
      start,
      end,
    }: {
      readonly start: T;
      readonly end: T;
    },
  ) {
    castDartType<T>(start, _dartTemporary25);
    castDartType<T>(end, _dartTemporary25);
    const _initialField0 = start;
    const _initialField1 = end;
    if (FoundationBuildMode.debug)
      invariant(!start.isAfter(end), 'generated-source-assert', 'Pinned Dart assertion failed');
    captureDartType(
      this,
      applyDartType<DateTimeRange<T>>(DateTimeRange, 'DateTimeRange', [_dartTemporary25], []),
    );
    this.start = _initialField0;
    this.end = _initialField1;
    protect(this, ['start', 'end']);
  }
  get duration(): number {
    return this.end.difference(this.start);
  }
  equals(other: {}): boolean {
    if (!(sourceStyleRuntimeType(other) === sourceStyleRuntimeType(this))) {
      return false;
    }
    return (
      isDartType<DateTimeRange<DateTime>>(
        other,
        applyDartType<DateTimeRange<DateTime>>(DateTimeRange, 'DateTimeRange', [dateTimeType], []),
      ) &&
      (other as DateTimeRange<DateTime>).start.equals(this.start) &&
      (other as DateTimeRange<DateTime>).end.equals(this.end)
    );
  }
  /**
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  get hashCode(): number {
    return checkedInteger(sourceStyleHash(this.start, this.end));
  }
  toString(): string {
    return `${dartValueString(this.start)} - ${dartValueString(this.end)}`;
  }
}

import { registerDateEnumValues } from '../../internal/date/source-values.ts';
registerDateEnumValues(DatePickerEntryMode);
registerDateEnumValues(DatePickerMode);
