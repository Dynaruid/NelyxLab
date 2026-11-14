// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/material_localizations.dart; SHA256 718d08b2aec034b9001e27cf93f7f85458b7e1aa28ed91409f7f86deaf019846
import { protect } from '@nelyx/core/internal/ui/value-math';
import { checkedInteger } from '@nelyx/core/internal/ui/value-math';
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { captureDartException } from '@nelyx/core/internal/foundation/dart-exceptions';
import { boxSourceDartInt } from '@nelyx/core/internal/foundation/dart-numeric';
import { castSourceDartInt } from '@nelyx/core/internal/foundation/dart-numeric';
import { modulo } from '@nelyx/core/internal/ui/value-math';
import { DateTime } from '../../internal/date/date-time.ts';
import { dateIntString } from '../../internal/date/source-values.ts';
import { dateIntAbs } from '../../internal/date/source-values.ts';
import { DateStringBuffer } from '../../internal/date/source-values.ts';
import { dateStringAt } from '../../internal/date/source-values.ts';
import { dateTryParseInt } from '../../internal/date/source-values.ts';
import { isDateArgumentError } from '../../internal/date/date-time.ts';
import { dateListAt } from '../../internal/date/source-values.ts';
import type { ScrollbarSourceList } from '@nelyx/core/internal/framework/widgets/scrollbar-painter-source-adapter';
import type { DartInt } from '@nelyx/core/internal/foundation/dart-numeric';
import type { DateLocalizationsContract } from '../../internal/date/localizations-contract.ts';
export class SourceDateLocalizations implements DateLocalizationsContract {
  static readonly _dart_87283a428f008a95_shortWeekdays: ScrollbarSourceList<string> = [
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'Sun',
  ];
  static readonly _dart_87283a428f008a95_weekdays: ScrollbarSourceList<string> = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];
  static readonly _dart_87283a428f008a95_narrowWeekdays: ScrollbarSourceList<string> = [
    'S',
    'M',
    'T',
    'W',
    'T',
    'F',
    'S',
  ];
  static readonly _dart_87283a428f008a95_shortMonths: ScrollbarSourceList<string> = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  static readonly _dart_87283a428f008a95_months: ScrollbarSourceList<string> = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  constructor() {}
  /**
   * @dartParam year int
   * @dartParamOrigin year explicit
   * @dartParam month int
   * @dartParamOrigin month explicit
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  _dart_87283a428f008a95_getDaysInMonth(year: number, month: number): number {
    checkedInteger(year);
    checkedInteger(month);
    if (checkedInteger(month) === checkedInteger(DateTime.february)) {
      const isLeapYear: boolean =
        (checkedInteger(modulo(checkedInteger(year), 4)) === 0 &&
          checkedInteger(modulo(checkedInteger(year), 100)) !== 0) ||
        checkedInteger(modulo(checkedInteger(year), 400)) === 0;
      if (isLeapYear) {
        return 29;
      }
      return 28;
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
  /**
   * @dartParam number int
   * @dartParamOrigin number explicit
   */
  _dart_87283a428f008a95_formatTwoDigitZeroPad(number: number): string {
    checkedInteger(number);
    if (FoundationBuildMode.debug)
      invariant(
        0 <= checkedInteger(number) && checkedInteger(number) < 100,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    if (checkedInteger(number) < 10) {
      return `0${dateIntString(checkedInteger(number))}`;
    }
    return `${dateIntString(checkedInteger(number))}`;
  }
  formatYear(date: DateTime): string {
    return dateIntString(checkedInteger(date.year));
  }
  formatCompactDate(date: DateTime): string {
    const month: string = this._dart_87283a428f008a95_formatTwoDigitZeroPad(
      checkedInteger(date.month),
    );
    const day: string = this._dart_87283a428f008a95_formatTwoDigitZeroPad(checkedInteger(date.day));
    const year: string = dateIntString(checkedInteger(date.year)).padStart(4, '0');
    return `${month}/${day}/${year}`;
  }
  formatShortDate(date: DateTime): string {
    const month: string = dateListAt(
      SourceDateLocalizations._dart_87283a428f008a95_shortMonths,
      checkedInteger(checkedInteger(date.month) - checkedInteger(DateTime.january)),
    );
    return `${month} ${dateIntString(checkedInteger(date.day))}, ${dateIntString(checkedInteger(date.year))}`;
  }
  formatMediumDate(date: DateTime): string {
    const day: string = dateListAt(
      SourceDateLocalizations._dart_87283a428f008a95_shortWeekdays,
      checkedInteger(checkedInteger(date.weekday) - checkedInteger(DateTime.monday)),
    );
    const month: string = dateListAt(
      SourceDateLocalizations._dart_87283a428f008a95_shortMonths,
      checkedInteger(checkedInteger(date.month) - checkedInteger(DateTime.january)),
    );
    return `${day}, ${month} ${dateIntString(checkedInteger(date.day))}`;
  }
  formatFullDate(date: DateTime): string {
    const month: string = dateListAt(
      SourceDateLocalizations._dart_87283a428f008a95_months,
      checkedInteger(checkedInteger(date.month) - checkedInteger(DateTime.january)),
    );
    return `${dateListAt(SourceDateLocalizations._dart_87283a428f008a95_weekdays, checkedInteger(checkedInteger(date.weekday) - checkedInteger(DateTime.monday)))}, ${month} ${dateIntString(checkedInteger(date.day))}, ${dateIntString(checkedInteger(date.year))}`;
  }
  formatMonthYear(date: DateTime): string {
    const year: string = this.formatYear(date);
    const month: string = dateListAt(
      SourceDateLocalizations._dart_87283a428f008a95_months,
      checkedInteger(checkedInteger(date.month) - checkedInteger(DateTime.january)),
    );
    return `${month} ${year}`;
  }
  formatShortMonthDay(date: DateTime): string {
    const month: string = dateListAt(
      SourceDateLocalizations._dart_87283a428f008a95_shortMonths,
      checkedInteger(checkedInteger(date.month) - checkedInteger(DateTime.january)),
    );
    return `${month} ${dateIntString(checkedInteger(date.day))}`;
  }
  parseCompactDate(inputString: string | null): DateTime | null {
    if (inputString === null) {
      return null;
    }
    const inputParts: ScrollbarSourceList<string> = (inputString as string).split('/');
    if (checkedInteger(inputParts.length) !== 3) {
      return null;
    }
    /**
     * @dartType int?
     * @dartTypeOrigin explicit
     */
    const year: number | null = dateTryParseInt(dateListAt(inputParts, 2), { radix: 10 });
    if (year === null || checkedInteger(year as number) < 1) {
      return null;
    }
    /**
     * @dartType int?
     * @dartTypeOrigin explicit
     */
    const month: number | null = dateTryParseInt(dateListAt(inputParts, 0), { radix: 10 });
    if (
      month === null ||
      checkedInteger(month as number) < 1 ||
      checkedInteger(month as number) > 12
    ) {
      return null;
    }
    /**
     * @dartType int?
     * @dartTypeOrigin explicit
     */
    const day: number | null = dateTryParseInt(dateListAt(inputParts, 1), { radix: 10 });
    if (
      day === null ||
      checkedInteger(day as number) < 1 ||
      checkedInteger(day as number) >
        checkedInteger(
          this._dart_87283a428f008a95_getDaysInMonth(
            checkedInteger(year as number),
            checkedInteger(month as number),
          ),
        )
    ) {
      return null;
    }
    try {
      return new DateTime(
        checkedInteger(year as number),
        checkedInteger(month as number),
        checkedInteger(day as number),
      );
    } catch (_dartTemporary0) {
      const _dartTemporary1 = captureDartException(_dartTemporary0);
      if (isDateArgumentError(_dartTemporary1.exception)) {
        return null;
      } else throw _dartTemporary1.exception;
    }
  }
  get narrowWeekdays(): ScrollbarSourceList<string> {
    return SourceDateLocalizations._dart_87283a428f008a95_narrowWeekdays;
  }
  /**
   * @dartReturn int
   * @dartReturnOrigin explicit
   */
  get firstDayOfWeekIndex(): number {
    return 0;
  }
  get dateHelpText(): string {
    return 'mm/dd/yyyy';
  }
  get selectYearSemanticsLabel(): string {
    return 'Select year';
  }
  get dateInputLabel(): string {
    return 'Enter Date';
  }
  get invalidDateFormatLabel(): string {
    return 'Invalid format.';
  }
  get dateOutOfRangeLabel(): string {
    return 'Out of range.';
  }
  get datePickerHelpText(): string {
    return 'Select date';
  }
  get calendarModeButtonLabel(): string {
    return 'Switch to calendar';
  }
  get inputDateModeButtonLabel(): string {
    return 'Switch to input';
  }
  /**
   * @dartParam number int
   * @dartParamOrigin number explicit
   */
  formatDecimal(number: number): string {
    checkedInteger(number);
    if (checkedInteger(number) > checkedInteger(-1000) && checkedInteger(number) < 1000) {
      return dateIntString(checkedInteger(number));
    }
    const digits: string = dateIntString(checkedInteger(dateIntAbs(checkedInteger(number))));
    const result: DateStringBuffer = new DateStringBuffer(checkedInteger(number) < 0 ? '-' : '');
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    const maxDigitIndex: number = checkedInteger(checkedInteger(digits.length) - 1);
    for (
      let /**
         * @dartType int
         * @dartTypeOrigin inferred
         */
        i: number = 0;
      checkedInteger(i) <= checkedInteger(maxDigitIndex);
      checkedInteger(
        (() => {
          const _dartTemporary2 = checkedInteger(i);
          const _dartTemporary3 = checkedInteger(_dartTemporary2 + 1);
          i = _dartTemporary3;
          return _dartTemporary3;
        })(),
      )
    ) {
      void result.write(dateStringAt(digits, checkedInteger(i)));
      if (
        checkedInteger(i) < checkedInteger(maxDigitIndex) &&
        checkedInteger(
          modulo(checkedInteger(checkedInteger(maxDigitIndex) - checkedInteger(i)), 3),
        ) === 0
      ) {
        void result.write(',');
      }
    }
    return result.toString();
  }
  get nextMonthTooltip(): string {
    return 'Next month';
  }
  get previousMonthTooltip(): string {
    return 'Previous month';
  }
  get currentDateLabel(): string {
    return 'Today';
  }
  get selectedDateLabel(): string {
    return 'Selected';
  }
  get cancelButtonLabel(): string {
    return 'Cancel';
  }
  get okButtonLabel(): string {
    return 'OK';
  }
}
protect(SourceDateLocalizations, [
  '_dart_87283a428f008a95_shortWeekdays',
  '_dart_87283a428f008a95_weekdays',
  '_dart_87283a428f008a95_narrowWeekdays',
  '_dart_87283a428f008a95_shortMonths',
  '_dart_87283a428f008a95_months',
]);
