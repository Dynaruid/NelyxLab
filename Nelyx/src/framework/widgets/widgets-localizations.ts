// SPDX-License-Identifier: BSD-3-Clause
import type { Locale } from '../../ui/locale.ts';
import { localeFromTag } from './app-locales.ts';
import { LocalizationsDelegate } from './app-data.ts';
import { IntlProvider } from './intl-provider.ts';
import { WidgetLocalizationCatalog } from './widget-localization-catalog.ts';
import { widgetsArb } from './widgets-arb.generated.ts';

export class WidgetsLocalizations {
  private readonly catalog: WidgetLocalizationCatalog;

  constructor(locale: string) {
    this.catalog = new WidgetLocalizationCatalog(widgetsArb, IntlProvider.forLocale(locale));
  }

  static readonly delegate: LocalizationsDelegate<WidgetsLocalizations> = Object.freeze({
    type: WidgetsLocalizations,
    isSupported: (locale: Locale) => Object.hasOwn(widgetsArb.locales, locale.languageCode),
    load: (locale: Locale) => new WidgetsLocalizations(locale.toLanguageTag()),
    shouldReload: () => false,
  });

  static forLocale(locale: string, fallback = 'en'): WidgetsLocalizations {
    return new WidgetsLocalizations(
      this.delegate.isSupported(localeFromTag(locale)) ? locale : fallback,
    );
  }

  get radioButtonUnselectedLabel(): string {
    return this.catalog.format('radioButtonUnselectedLabel');
  }
}
