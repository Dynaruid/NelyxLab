// SPDX-License-Identifier: BSD-3-Clause
import { localeFromTag } from './app-locales.ts';
import { IntlProvider } from './intl-provider.ts';

interface WidgetMessageMetadata {
  readonly parameters?: string;
  readonly plural?: string;
  readonly optional?: boolean;
  readonly 'x-flutter-type'?: string;
  readonly [attribute: string]: unknown;
}
type WidgetMessageMetadataMap = Readonly<Record<string, WidgetMessageMetadata | undefined>>;
interface WidgetCatalogLocale {
  readonly parent: string | null;
  readonly messages: Readonly<Record<string, string | undefined>>;
  readonly metadata?: WidgetMessageMetadataMap;
}
export interface WidgetLocalizationCatalogData {
  readonly metadata: WidgetMessageMetadataMap;
  readonly locales: Readonly<Record<string, WidgetCatalogLocale | undefined>>;
}

const placeholder = /\$(?:\{([a-zA-Z]\w*)\}|([a-zA-Z]\w*))/g;
const pluralBranches = {
  zero: 'Zero',
  one: 'One',
  two: 'Two',
  few: 'Few',
  many: 'Many',
  other: 'Other',
} as const;

export class WidgetLocalizationCatalog {
  private readonly row: WidgetCatalogLocale;

  constructor(
    private readonly data: WidgetLocalizationCatalogData,
    private readonly intl: IntlProvider,
  ) {
    const locale = localeFromTag(intl.locale);
    const { languageCode, scriptCode, countryCode } = locale;
    this.row =
      data.locales[intl.locale] ??
      (scriptCode ? data.locales[`${languageCode}-${scriptCode}`] : undefined) ??
      (countryCode ? data.locales[`${languageCode}-${countryCode}`] : undefined) ??
      data.locales[languageCode] ??
      data.locales.en!;
  }

  raw(key: string): string | undefined {
    let row: WidgetCatalogLocale | undefined = this.row;
    while (row !== undefined) {
      if (Object.hasOwn(row.messages, key)) return row.messages[key];
      row = row.parent === null ? undefined : this.data.locales[row.parent];
    }
    return undefined;
  }

  format(key: string, argumentsValue: Readonly<Record<string, string | number>> = {}): string {
    const metadata = Object.hasOwn(this.data.metadata, key) ? this.data.metadata[key] : undefined;
    const parameters = metadata?.plural
      ? [metadata.plural]
      : (metadata?.parameters?.split(',').map((name) => name.trim().replace(/^\$/, '')) ?? []);
    if (
      Object.keys(argumentsValue).length !== parameters.length ||
      parameters.some(
        (parameter) =>
          !Object.hasOwn(argumentsValue, parameter) ||
          (typeof argumentsValue[parameter] !== 'string' &&
            !Number.isFinite(argumentsValue[parameter])),
      )
    )
      throw new TypeError(`Expected localization arguments for ${key}: ${parameters.join(', ')}`);

    let pattern: string | undefined;
    if (metadata?.plural) {
      const count = argumentsValue[metadata.plural];
      if (typeof count !== 'number')
        throw new TypeError(`Plural argument ${metadata.plural} must be a number`);
      const rules = this.intl.pluralRules();
      const exact = count === 0 ? 'Zero' : count === 1 ? 'One' : count === 2 ? 'Two' : null;
      pattern =
        (exact ? this.raw(key + exact) : undefined) ??
        this.raw(key + pluralBranches[rules?.select(count) ?? 'other']) ??
        this.raw(key + 'Other');
    } else {
      pattern = this.raw(key);
    }
    if (pattern === undefined) throw new Error(`Missing widget localization: ${key}`);
    return pattern.replace(
      placeholder,
      (_match, braced: string | undefined, plain: string | undefined) => {
        const argument = argumentsValue[(braced ?? plain)!]!;
        return typeof argument === 'number'
          ? (this.intl.numberFormat()?.format(argument) ?? String(argument))
          : argument;
      },
    );
  }
}
