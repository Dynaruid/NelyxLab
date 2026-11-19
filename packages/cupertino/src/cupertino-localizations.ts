// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { DateTime } from '@nelyx/core/foundation/date-time';
import { InheritedWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Localizations } from '@nelyx/core/framework/widgets/app-data';
import { selectionMessages } from './generated/localizations/selection-localizations-data.ts';
import { clearButtonLabels } from './internal/input/clear-localizations.ts';
import { searchPlaceholderLabels } from './generated/localizations/search-localizations-data.generated.ts';
import {
  pickerFormats,
  pickerMessages,
} from './generated/localizations/picker-localizations-data.generated.ts';
import type { PickerFormats } from './generated/localizations/picker-localizations-data.generated.ts';

export enum DatePickerDateOrder {
  dmy = 'dmy',
  mdy = 'mdy',
  ymd = 'ymd',
  ydm = 'ydm',
}

export enum DatePickerDateTimeOrder {
  date_time_dayPeriod = 'date_time_dayPeriod',
  time_dayPeriod_date = 'time_dayPeriod_date',
  date_dayPeriod_time = 'date_dayPeriod_time',
  dayPeriod_time_date = 'dayPeriod_time_date',
}

export class CupertinoLocalizations {
  private readonly messages: Readonly<Record<string, string>>;
  private readonly formats: PickerFormats;
  private readonly digits: readonly string[];

  constructor(readonly locale = 'en') {
    const parts = locale.replaceAll('-', '_').split('_'),
      language = parts[0]!,
      script = parts.find((value) => value.length === 4),
      region = parts.find(
        (value) => (value.length === 2 && value !== language) || value.length === 3,
      );
    const candidates = [
      language,
      ...(script ? [language + '_' + script] : []),
      ...(region ? [language + '_' + region] : []),
      parts.join('_'),
    ];
    const pickerLocale = candidates.filter((key) => pickerFormats[key] !== undefined).at(-1);
    this.formats = pickerFormats[pickerLocale ?? 'en']!;
    this.digits = Array.from(this.formats.digits);
    this.messages = Object.freeze(
      Object.assign(
        {
          clearButtonLabel: clearButtonLabels.en,
          searchTextFieldPlaceholderLabel: searchPlaceholderLabels.en,
        },
        selectionMessages.en,
        pickerMessages.en,
        ...candidates.map((key) => ({
          ...selectionMessages[key],
          ...pickerMessages[key],
          ...(searchPlaceholderLabels[key] === undefined
            ? {}
            : { searchTextFieldPlaceholderLabel: searchPlaceholderLabels[key] }),
          ...(clearButtonLabels[key] === undefined
            ? {}
            : { clearButtonLabel: clearButtonLabels[key] }),
        })),
      ),
    );
  }
  static of(context: BuildContext): CupertinoLocalizations {
    return (
      context.maybeDependOn(CupertinoLocalizationsScope)?.data ??
      new CupertinoLocalizations(context.maybeDependOn(Localizations)?.locale ?? 'en')
    );
  }
  static get supportedLocales(): readonly string[] {
    return Object.freeze(Object.keys(selectionMessages));
  }
  protected message(key: string): string {
    const value = this.messages[key];
    if (value === undefined) throw new Error('Missing Cupertino localization: ' + key);
    return value;
  }
  get cutButtonLabel(): string {
    return this.message('cutButtonLabel');
  }
  get clearButtonLabel(): string {
    return this.message('clearButtonLabel');
  }
  get copyButtonLabel(): string {
    return this.message('copyButtonLabel');
  }
  get pasteButtonLabel(): string {
    return this.message('pasteButtonLabel');
  }
  get selectAllButtonLabel(): string {
    return this.message('selectAllButtonLabel');
  }
  get lookUpButtonLabel(): string {
    return this.message('lookUpButtonLabel');
  }
  get searchTextFieldPlaceholderLabel(): string {
    return this.message('searchTextFieldPlaceholderLabel');
  }
  get searchWebButtonLabel(): string {
    return this.message('searchWebButtonLabel');
  }
  get shareButtonLabel(): string {
    return this.message('shareButtonLabel');
  }
  tabSemanticsLabel({
    tabIndex,
    tabCount,
  }: {
    readonly tabIndex: number;
    readonly tabCount: number;
  }): string {
    return this.message('tabSemanticsLabel')
      .replaceAll('$tabIndex', this.number(tabIndex))
      .replaceAll('$tabCount', this.number(tabCount));
  }

  get datePickerDateOrder(): DatePickerDateOrder {
    return this.message('datePickerDateOrder') as DatePickerDateOrder;
  }

  get datePickerDateTimeOrder(): DatePickerDateTimeOrder {
    return this.message('datePickerDateTimeOrder') as DatePickerDateTimeOrder;
  }

  get anteMeridiemAbbreviation(): string {
    return this.message('anteMeridiemAbbreviation');
  }

  get postMeridiemAbbreviation(): string {
    return this.message('postMeridiemAbbreviation');
  }

  get todayLabel(): string {
    return this.message('todayLabel');
  }

  get backButtonLabel(): string {
    return this.message('backButtonLabel');
  }

  get cancelButtonLabel(): string {
    return this.message('cancelButtonLabel');
  }

  private number(value: number): string {
    return String(value).replace(/\d/g, (digit) => this.digits[Number(digit)]!);
  }

  datePickerYear(year: number): string {
    const [prefix, suffix] = this.formats.year;
    return prefix + this.number(year) + suffix;
  }

  datePickerMonth(month: number): string {
    return this.formats.months[month - 1] ?? this.number(month);
  }

  datePickerDayOfMonth(day: number, weekday?: number): string {
    const value = this.formats.days[day - 1] ?? this.number(day);
    const weekdayLabel = weekday === undefined ? undefined : this.formats.weekdays[weekday - 1];
    return weekdayLabel === undefined ? value : `${weekdayLabel} ${value}`;
  }

  datePickerMediumDate(date: DateTime): string {
    return this.formats.medium
      .map((part) => (typeof part === 'string' ? part : part.values[date[part.field] - 1]!))
      .join('');
  }

  datePickerHour(hour: number): string {
    return this.formats.hours[hour] ?? this.number(hour);
  }

  datePickerMinute(minute: number): string {
    return this.formats.minutes[minute] ?? this.number(minute);
  }

  datePickerHourSemanticsLabel(hour: number): string {
    return this.formats.hourSemantics[hour] ?? this.number(hour);
  }

  datePickerMinuteSemanticsLabel(minute: number): string {
    return this.formats.minuteSemantics[minute] ?? this.number(minute);
  }

  timerPickerHour(hour: number): string {
    return this.datePickerHour(hour);
  }

  timerPickerMinute(minute: number): string {
    return this.formats.timerMinutes[minute] ?? this.number(minute);
  }

  timerPickerSecond(second: number): string {
    return this.formats.timerSeconds[second] ?? this.number(second);
  }

  timerPickerHourLabel(hour: number): string {
    return this.formats.timerHourLabels[hour] ?? '';
  }

  timerPickerMinuteLabel(minute: number): string {
    return this.formats.timerMinuteLabels[minute] ?? '';
  }

  timerPickerSecondLabel(second: number): string {
    return this.formats.timerSecondLabels[second] ?? '';
  }
}
export class DefaultCupertinoLocalizations extends CupertinoLocalizations {
  constructor() {
    super('en');
  }
}
export class CupertinoLocalizationsScope extends InheritedWidget {
  constructor(
    readonly data: CupertinoLocalizations,
    child: Widget,
  ) {
    super(child);
  }
  updateShouldNotify(old: this): boolean {
    return old.data !== this.data;
  }
}
