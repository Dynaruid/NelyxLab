// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Shared Gregorian format and input rules for the Material date pickers.
import type { IntlProvider } from '@nelyx/core/framework/widgets/intl-provider';
import { DateTime } from './date-time.ts';

const bidi = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const regexCharacters = /[.*+?^$(){}|[\]\\]/g;
const example = new DateTime(2024, 10, 23);
const formats = {
  compact: { day: 'numeric', month: 'numeric', year: 'numeric' },
  short: { day: 'numeric', month: 'short', year: 'numeric' },
  shortDay: { day: 'numeric', month: 'short' },
  medium: { weekday: 'short', day: 'numeric', month: 'short' },
  full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  month: { month: 'long', year: 'numeric' },
  year: { year: 'numeric' },
  weekday: { weekday: 'narrow' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;
type DateFormat = keyof typeof formats;
type DateField = 'year' | 'month' | 'day';
const fieldHints = { year: 'yyyy', month: 'mm', day: 'dd' } as const;

// Project the local civil date to a neutral clock before handing it to Intl.
function civilDate(date: DateTime): Date {
  const value = new Date(0);
  value.setUTCFullYear(date.year, date.month - 1, date.day);
  return value;
}

export class IntlDateLocalizations {
  private static readonly cached = new WeakMap<IntlProvider, IntlDateLocalizations | null>();
  readonly narrowWeekdays: readonly string[];

  private constructor(
    private readonly formatters: ReadonlyMap<DateFormat, Intl.DateTimeFormat>,
    readonly decimal: Intl.NumberFormat,
    readonly firstDayOfWeekIndex: number | null,
    readonly dateHelpText: string,
    private readonly compactPattern: RegExp,
    private readonly dateFields: readonly DateField[],
    private readonly digits: ReadonlyMap<string, string>,
  ) {
    this.narrowWeekdays = Object.freeze(
      Array.from({ length: DateTime.daysPerWeek }, (_, index) =>
        this.format('weekday', new DateTime(2024, 1, 7 + index)),
      ),
    );
  }

  static forProvider(intl: IntlProvider): IntlDateLocalizations | null {
    const previous = this.cached.get(intl);
    if (previous !== undefined) return previous;
    let result: IntlDateLocalizations | null;
    try {
      result = this.load(intl);
    } catch (error) {
      if (!(error instanceof RangeError || error instanceof TypeError)) throw error;
      result = null;
    }
    this.cached.set(intl, result);
    return result;
  }

  private static load(intl: IntlProvider): IntlDateLocalizations | null {
    if (intl.locale === 'en' || intl.locale === 'en-US') return null;
    const formatters = new Map<DateFormat, Intl.DateTimeFormat>();
    for (const name of Object.keys(formats) as DateFormat[]) {
      const formatter = intl.dateTimeFormat({
        ...formats[name],
        calendar: 'gregory',
        timeZone: 'UTC',
      });
      if (!formatter) return null;
      formatters.set(name, formatter);
    }
    const compact = formatters.get('compact')!;
    if (typeof compact.formatToParts !== 'function') return null;
    const decimal = intl.numberFormat();
    const digitFormat = intl.numberFormat({
      numberingSystem: compact.resolvedOptions().numberingSystem,
      useGrouping: false,
    });
    if (!decimal || !digitFormat) return null;
    const digits = new Map<string, string>();
    for (let i = 0; i < 10; i++) {
      const digit = digitFormat.format(i).replace(bidi, '');
      if (Array.from(digit).length !== 1 || digits.has(digit)) return null;
      digits.set(digit, String(i));
    }
    const fields: DateField[] = [];
    const parts = compact.formatToParts(civilDate(example));
    const hints: string[] = [];
    const pattern = parts
      .map(({ type, value }, index) => {
        if (type === 'year' || type === 'month' || type === 'day') {
          fields.push(type);
          hints.push(fieldHints[type]);
          return '([0-9]{1,6})';
        }
        let literal = value.replace(bidi, '');
        if (index === 0) literal = literal.trimStart();
        if (index === parts.length - 1) literal = literal.trimEnd();
        hints.push(literal);
        return literal.replace(regexCharacters, '\\$&');
      })
      .join('');
    if (fields.length !== 3 || new Set(fields).size !== 3) return null;
    const firstDay = intl.firstDayOfWeek;
    const result = new IntlDateLocalizations(
      formatters,
      decimal,
      firstDay === null ? null : firstDay % DateTime.daysPerWeek,
      hints.join(''),
      new RegExp('^' + pattern + '$'),
      fields,
      digits,
    );
    return result.parse(result.format('compact', example))?.equals(example) ? result : null;
  }

  format(name: DateFormat, date: DateTime): string {
    return this.formatters.get(name)!.format(civilDate(date));
  }

  parse(input: string | null): DateTime | null {
    if (input === null) return null;
    const text = Array.from(
      input.replace(bidi, '').trim(),
      (char) => this.digits.get(char) ?? char,
    ).join('');
    const match = this.compactPattern.exec(text);
    if (!match) return null;
    const fields = { year: 0, month: 0, day: 0 };
    this.dateFields.forEach((field, index) => {
      fields[field] = Number(match[index + 1]);
    });
    const { year, month, day } = fields;
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    try {
      const date = new DateTime(year, month, day);
      return date.year === year && date.month === month && date.day === day ? date : null;
    } catch (error) {
      if (error instanceof RangeError) return null;
      throw error;
    }
  }
}
