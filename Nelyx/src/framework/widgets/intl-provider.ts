// SPDX-License-Identifier: BSD-3-Clause
import { canonicalLocaleTag } from './app-locales.ts';

type IntlOptions = Intl.DateTimeFormatOptions | Intl.NumberFormatOptions | Intl.PluralRulesOptions;
type IntlConstructor<Options, Formatter> = {
  new (locale: string, options: Options): Formatter;
  supportedLocalesOf(locales: string[]): string[];
};

/** Host formatters for a specific locale. A null formatter lets the caller use its defaults. */
export class IntlProvider {
  private static readonly locales = new Map<string, IntlProvider>();
  private readonly dates = new Map<string, Intl.DateTimeFormat | null>();
  private readonly numbers = new Map<string, Intl.NumberFormat | null>();
  private readonly plurals = new Map<string, Intl.PluralRules | null>();

  private constructor(readonly locale: string) {}

  static forLocale(tag: string): IntlProvider {
    const locale = canonicalLocaleTag(tag);
    let provider = this.locales.get(locale);
    if (!provider) {
      provider = new IntlProvider(locale);
      this.locales.set(locale, provider);
    }
    return provider;
  }

  dateTimeFormat(options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat | null {
    return this.formatter(this.dates, globalThis.Intl?.DateTimeFormat, options, (format) => {
      const resolved = format.resolvedOptions();
      return (
        typeof format.format === 'function' &&
        (!options.calendar || resolved.calendar === options.calendar) &&
        (!options.numberingSystem || resolved.numberingSystem === options.numberingSystem) &&
        (options.timeZone !== 'UTC' || resolved.timeZone === 'UTC')
      );
    });
  }

  numberFormat(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat | null {
    return this.formatter(this.numbers, globalThis.Intl?.NumberFormat, options, (format) => {
      return (
        typeof format.format === 'function' &&
        (!options.numberingSystem ||
          format.resolvedOptions().numberingSystem === options.numberingSystem)
      );
    });
  }

  pluralRules(options: Intl.PluralRulesOptions = {}): Intl.PluralRules | null {
    return this.formatter(this.plurals, globalThis.Intl?.PluralRules, options, (rules) => {
      return typeof rules.select === 'function';
    });
  }

  /** ISO weekday (Monday = 1), when the host includes locale week data. */
  get firstDayOfWeek(): number | null {
    const Locale = globalThis.Intl?.Locale;
    if (typeof Locale !== 'function') return null;
    try {
      const locale: Intl.Locale & {
        readonly weekInfo?: { readonly firstDay: number };
        getWeekInfo?: () => { readonly firstDay: number };
      } = new Locale(this.locale);
      const day = locale.getWeekInfo?.()?.firstDay ?? locale.weekInfo?.firstDay;
      return day !== undefined && Number.isInteger(day) && day >= 1 && day <= 7 ? day : null;
    } catch (error) {
      if (!(error instanceof RangeError || error instanceof TypeError)) throw error;
      return null;
    }
  }

  private formatter<Options extends IntlOptions, Formatter>(
    cache: Map<string, Formatter | null>,
    create: IntlConstructor<Options, Formatter> | undefined,
    options: Options,
    usable: (value: Formatter) => boolean,
  ): Formatter | null {
    const key = JSON.stringify(
      Object.entries(options).sort(([left], [right]) => left.localeCompare(right)),
    );
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    let formatter = null;
    try {
      if (typeof create === 'function' && create.supportedLocalesOf?.([this.locale]).length) {
        const candidate = new create(this.locale, options);
        if (usable(candidate)) formatter = candidate;
      }
    } catch (error) {
      if (!(error instanceof RangeError || error instanceof TypeError)) throw error;
    }
    cache.set(key, formatter);
    return formatter;
  }
}
