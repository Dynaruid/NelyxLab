// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/date_picker.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { canonicalLocaleTag } from '@nelyx/core/framework/widgets/app';
import { MaterialLocalizations } from '../../material-localizations.ts';
import { DateTime } from './date-time.ts';

const localized = new WeakMap<MaterialLocalizations, MaterialLocalizations>();
const digits = /^[0-9]+$/;
const bidi = /[\u200e\u200f\u061c]/g;
const regexCharacters = /[.*+?^${}()|[\]\\]/g;
const englishWeek = new DateTime(2026, 1, 4);

class RangeLocalizations extends MaterialLocalizations {
  private readonly compact: Intl.DateTimeFormat;
  private readonly short: Intl.DateTimeFormat;
  private readonly shortDay: Intl.DateTimeFormat;
  private readonly medium: Intl.DateTimeFormat;
  private readonly full: Intl.DateTimeFormat;
  private readonly month: Intl.DateTimeFormat;
  private readonly year: Intl.DateTimeFormat;
  private readonly weekday: Intl.DateTimeFormat;
  private readonly decimal: Intl.NumberFormat;
  private readonly digitParser: ReadonlyMap<string, string>;
  private readonly compactPattern: RegExp;
  private readonly dateParts: readonly ('year' | 'month' | 'day')[];
  private readonly firstDay: number;
  private readonly weekLabels: readonly string[];

  constructor(localization: MaterialLocalizations, locale: string) {
    super(localization.locale);
    const format = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { ...options, calendar: 'gregory' });
    this.compact = format({ day: 'numeric', month: 'numeric', year: 'numeric' });
    this.short = format({ day: 'numeric', month: 'short', year: 'numeric' });
    this.shortDay = format({ day: 'numeric', month: 'short' });
    this.medium = format({ weekday: 'short', day: 'numeric', month: 'short' });
    this.full = format({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    this.month = format({ month: 'long', year: 'numeric' });
    this.year = format({ year: 'numeric' });
    this.weekday = format({ weekday: 'narrow' });
    this.decimal = new Intl.NumberFormat(locale);
    this.digitParser = new Map(
      Array.from({ length: 10 }, (_, value) => [this.decimal.format(value), String(value)]),
    );
    const fields: Array<'year' | 'month' | 'day'> = [];
    const compactPattern = this.compact
      .formatToParts(new DateTime(2026, 10, 23).toDate())
      .map(({ type, value }) => {
        if (type === 'year' || type === 'month' || type === 'day') {
          fields.push(type);
          return '([0-9]{1,6})';
        }
        return value.replace(bidi, '').replace(regexCharacters, '\\$&');
      });
    this.dateParts = fields;
    this.compactPattern = new RegExp('^' + compactPattern.join('') + '$');
    const localeInfo =
      typeof Intl.Locale === 'function'
        ? (new Intl.Locale(locale) as Intl.Locale & {
            readonly weekInfo?: { readonly firstDay: number };
            getWeekInfo?: () => { readonly firstDay: number };
          })
        : null;
    const firstDay = localeInfo?.getWeekInfo?.().firstDay ?? localeInfo?.weekInfo?.firstDay;
    this.firstDay =
      firstDay === undefined ? localization.firstDayOfWeekIndex : firstDay % DateTime.daysPerWeek;
    this.weekLabels = Object.freeze(
      Array.from({ length: DateTime.daysPerWeek }, (_, index) =>
        this.weekday.format(
          new DateTime(englishWeek.year, englishWeek.month, englishWeek.day + index).toDate(),
        ),
      ),
    );
  }

  override formatCompactDate(date: DateTime): string {
    return this.compact.format(date.toDate());
  }
  override formatShortDate(date: DateTime): string {
    return this.short.format(date.toDate());
  }
  override formatShortMonthDay(date: DateTime): string {
    return this.shortDay.format(date.toDate());
  }
  override formatMediumDate(date: DateTime): string {
    return this.medium.format(date.toDate());
  }
  override formatFullDate(date: DateTime): string {
    return this.full.format(date.toDate());
  }
  override formatMonthYear(date: DateTime): string {
    return this.month.format(date.toDate());
  }
  override formatYear(date: DateTime): string {
    return this.year.format(date.toDate());
  }
  override formatDecimal(value: number): string {
    return this.decimal.format(value);
  }
  override get firstDayOfWeekIndex(): number {
    return this.firstDay;
  }
  override get narrowWeekdays(): readonly string[] {
    return this.weekLabels;
  }

  override parseCompactDate(input: string | null): DateTime | null {
    if (input === null) return null;
    const text = Array.from(input.trim().replace(bidi, ''), (value) =>
      digits.test(value) ? value : (this.digitParser.get(value) ?? value),
    ).join('');
    const match = this.compactPattern.exec(text);
    if (!match) return null;
    const values = { year: 0, month: 0, day: 0 };
    this.dateParts.forEach((part, index) => {
      values[part] = Number(match[index + 1]);
    });
    const { year, month, day } = values;
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    try {
      const date = new DateTime(year, month, day);
      return date.year === year && date.month === month && date.day === day ? date : null;
    } catch (error) {
      if (error instanceof RangeError) return null;
      throw error;
    }
  }

  override get dateHelpText(): string {
    return this.dateRangeLabel('dateHelpText');
  }
}

export function dateRangeLocalizations(localization: MaterialLocalizations): MaterialLocalizations {
  if (
    localization.constructor !== MaterialLocalizations ||
    typeof Intl === 'undefined' ||
    typeof Intl.DateTimeFormat !== 'function' ||
    typeof Intl.DateTimeFormat.prototype.formatToParts !== 'function'
  )
    return localization;
  const previous = localized.get(localization);
  if (previous) return previous;
  const locale = canonicalLocaleTag(localization.locale);
  let result = localization;
  if (locale && locale !== 'en' && locale !== 'en-US') {
    try {
      result = new RangeLocalizations(localization, locale);
    } catch (error) {
      if (!(error instanceof RangeError || error instanceof TypeError)) throw error;
    }
  }
  localized.set(localization, result);
  return result;
}
