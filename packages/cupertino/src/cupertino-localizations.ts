// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/localizations.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import type { DateTime } from '@nelyx/core/foundation/date-time';
import { InheritedWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Localizations, LocalizationsDelegate } from '@nelyx/core/framework/widgets/app-data';
import type { Locale } from '@nelyx/core/ui/locale';
import { selectionMessages } from './generated/localizations/selection-localizations-data.ts';
import { clearButtonLabels } from './internal/input/clear-localizations.ts';
import { dialogLabels } from './internal/dialog-labels.ts';
import { contextMenuLabels } from './internal/context-menu-labels.ts';
import { expansionTileLabels } from './internal/expansion-tile-labels.ts';
import { noSpellCheckReplacementLabels } from './internal/spell-check-labels.ts';
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
  private standaloneMonthFormat: Intl.DateTimeFormat | null | undefined;
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
        expansionTileLabels.en,
        ...candidates.map((key) => ({
          ...selectionMessages[key],
          ...pickerMessages[key],
          ...expansionTileLabels[key],
          ...(searchPlaceholderLabels[key] === undefined
            ? {}
            : { searchTextFieldPlaceholderLabel: searchPlaceholderLabels[key] }),
          ...(clearButtonLabels[key] === undefined
            ? {}
            : { clearButtonLabel: clearButtonLabels[key] }),
        })),
        {
          noSpellCheckReplacementsLabel: candidates.reduce(
            (label, key) => noSpellCheckReplacementLabels[key] ?? label,
            noSpellCheckReplacementLabels.en!,
          ),
          menuDismissLabel: candidates.reduce(
            (label, key) => contextMenuLabels[key]?.menuDismissLabel ?? label,
            contextMenuLabels.en!.menuDismissLabel!,
          ),
          modalBarrierDismissLabel: candidates.reduce(
            (label, key) => dialogLabels[key]?.[0] ?? label,
            dialogLabels.en![0]!,
          ),
          alertDialogLabel: candidates.reduce(
            (label, key) => dialogLabels[key]?.[1] ?? label,
            dialogLabels.en![1]!,
          ),
        },
      ),
    );
  }
  static of(context: BuildContext): CupertinoLocalizations {
    const localizations = context.maybeDependOn(Localizations);
    return (
      context.maybeDependOn(CupertinoLocalizationsScope)?.data ??
      localizations?.resource(CupertinoLocalizations) ??
      new CupertinoLocalizations(localizations?.locale ?? 'en')
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
  get noSpellCheckReplacementsLabel(): string {
    return this.message('noSpellCheckReplacementsLabel');
  }
  get collapsedHint(): string {
    return this.message('collapsedHint');
  }
  get expandedHint(): string {
    return this.message('expandedHint');
  }
  get expansionTileExpandedTapHint(): string {
    return this.message('expansionTileExpandedTapHint');
  }
  get expansionTileCollapsedTapHint(): string {
    return this.message('expansionTileCollapsedTapHint');
  }
  get expansionTileExpandedHint(): string {
    return this.message('expansionTileExpandedHint');
  }
  get expansionTileCollapsedHint(): string {
    return this.message('expansionTileCollapsedHint');
  }
  get modalBarrierDismissLabel(): string {
    return this.message('modalBarrierDismissLabel');
  }
  get menuDismissLabel(): string {
    return this.message('menuDismissLabel');
  }
  get alertDialogLabel(): string {
    return this.message('alertDialogLabel');
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

  datePickerStandaloneMonth(month: number): string {
    const tag = this.locale.replaceAll('_', '-');
    if (this.standaloneMonthFormat === undefined) {
      try {
        this.standaloneMonthFormat = Intl.DateTimeFormat.supportedLocalesOf([tag]).length
          ? new Intl.DateTimeFormat(tag, { month: 'long', timeZone: 'UTC', calendar: 'gregory' })
          : null;
      } catch {
        this.standaloneMonthFormat = null;
      }
    }
    if (!this.standaloneMonthFormat || month < 1 || month > 12) return this.datePickerMonth(month);
    const [first, ...rest] = Array.from(
      this.standaloneMonthFormat.format(new Date(Date.UTC(2024, month - 1, 1))),
    );
    return first ? first.toLocaleUpperCase(tag) + rest.join('') : this.datePickerMonth(month);
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
class CupertinoLocalizationsDelegate extends LocalizationsDelegate<CupertinoLocalizations> {
  readonly type = CupertinoLocalizations;
  isSupported(locale: Locale): boolean {
    return locale.languageCode === 'en';
  }
  load(_locale: Locale): DefaultCupertinoLocalizations {
    return new DefaultCupertinoLocalizations();
  }
  shouldReload(_previous: this): boolean {
    return false;
  }
  toString(): string {
    return 'DefaultCupertinoLocalizations.delegate(en_US)';
  }
}

export class DefaultCupertinoLocalizations extends CupertinoLocalizations {
  static readonly delegate: LocalizationsDelegate<CupertinoLocalizations> = Object.freeze(
    new CupertinoLocalizationsDelegate(),
  );
  static load(_locale: Locale): Promise<DefaultCupertinoLocalizations> {
    return Promise.resolve(new DefaultCupertinoLocalizations());
  }
  constructor() {
    super('en');
  }
}
/** The app's bundled locale catalog supports region-specific formats. */
export const cupertinoCatalogDelegate: LocalizationsDelegate<CupertinoLocalizations> =
  Object.freeze({
    type: CupertinoLocalizations,
    isSupported: () => true,
    load: (locale: Locale) => new CupertinoLocalizations(locale.toLanguageTag()),
    shouldReload: () => false,
  });
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
