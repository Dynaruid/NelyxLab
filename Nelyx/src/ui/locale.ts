// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// Locale and complete alias tables from pinned engine platform_dispatcher.dart.
import { FoundationBuildMode } from '../foundation/constants.ts';
import { invariant } from '../foundation/errors.ts';
import { hashDoubles } from './value-math.ts';
const languageAliases: ReadonlyMap<string, string> = new Map([
  ['in', 'id'],
  ['iw', 'he'],
  ['ji', 'yi'],
  ['jw', 'jv'],
  ['mo', 'ro'],
  ['aam', 'aas'],
  ['adp', 'dz'],
  ['aue', 'ktz'],
  ['ayx', 'nun'],
  ['bgm', 'bcg'],
  ['bjd', 'drl'],
  ['ccq', 'rki'],
  ['cjr', 'mom'],
  ['cka', 'cmr'],
  ['cmk', 'xch'],
  ['coy', 'pij'],
  ['cqu', 'quh'],
  ['drh', 'khk'],
  ['drw', 'prs'],
  ['gav', 'dev'],
  ['gfx', 'vaj'],
  ['ggn', 'gvr'],
  ['gti', 'nyc'],
  ['guv', 'duz'],
  ['hrr', 'jal'],
  ['ibi', 'opa'],
  ['ilw', 'gal'],
  ['jeg', 'oyb'],
  ['kgc', 'tdf'],
  ['kgh', 'kml'],
  ['koj', 'kwv'],
  ['krm', 'bmf'],
  ['ktr', 'dtp'],
  ['kvs', 'gdj'],
  ['kwq', 'yam'],
  ['kxe', 'tvd'],
  ['kzj', 'dtp'],
  ['kzt', 'dtp'],
  ['lii', 'raq'],
  ['lmm', 'rmx'],
  ['meg', 'cir'],
  ['mst', 'mry'],
  ['mwj', 'vaj'],
  ['myt', 'mry'],
  ['nad', 'xny'],
  ['ncp', 'kdz'],
  ['nnx', 'ngv'],
  ['nts', 'pij'],
  ['oun', 'vaj'],
  ['pcr', 'adx'],
  ['pmc', 'huw'],
  ['pmu', 'phr'],
  ['ppa', 'bfy'],
  ['ppr', 'lcq'],
  ['pry', 'prt'],
  ['puz', 'pub'],
  ['sca', 'hle'],
  ['skk', 'oyb'],
  ['tdu', 'dtp'],
  ['thc', 'tpo'],
  ['thx', 'oyb'],
  ['tie', 'ras'],
  ['tkk', 'twm'],
  ['tlw', 'weo'],
  ['tmp', 'tyj'],
  ['tne', 'kak'],
  ['tnf', 'prs'],
  ['tsf', 'taj'],
  ['uok', 'ema'],
  ['xba', 'cax'],
  ['xia', 'acn'],
  ['xkh', 'waw'],
  ['xsj', 'suj'],
  ['ybd', 'rki'],
  ['yma', 'lrr'],
  ['ymt', 'mtm'],
  ['yos', 'zom'],
  ['yuu', 'yug'],
]);
const regionAliases: ReadonlyMap<string, string> = new Map([
  ['BU', 'MM'],
  ['DD', 'DE'],
  ['FX', 'FR'],
  ['TP', 'TL'],
  ['YD', 'YE'],
  ['ZR', 'CD'],
]);
function initialize(
  target: Locale,
  language: string,
  script: string | null,
  country: string | null,
): void {
  Object.defineProperties(target, {
    rawLanguage: { value: language },
    rawCountry: { value: country },
    scriptCode: { value: script, enumerable: true },
  });
}
export class Locale {
  declare private readonly rawLanguage: string;
  declare private readonly rawCountry: string | null;
  declare readonly scriptCode: string | null;
  constructor(languageCode: string, countryCode: string | null = null) {
    if (FoundationBuildMode.debug)
      invariant(
        languageCode !== '',
        'empty-locale-language',
        'Locale languageCode must not be empty',
      );
    initialize(this, languageCode, null, countryCode);
  }
  static fromSubtags({
    languageCode = 'und',
    scriptCode = null,
    countryCode = null,
  }: {
    readonly languageCode?: string;
    readonly scriptCode?: string | null;
    readonly countryCode?: string | null;
  } = {}): Locale {
    if (FoundationBuildMode.debug)
      invariant(
        languageCode !== '' && scriptCode !== '' && countryCode !== '',
        'empty-locale-subtag',
        'Locale subtags must not be empty',
      );
    const locale = Object.create(Locale.prototype) as Locale;
    initialize(locale, languageCode, scriptCode, countryCode);
    return locale;
  }
  get languageCode(): string {
    return languageAliases.get(this.rawLanguage) ?? this.rawLanguage;
  }
  get countryCode(): string | null {
    return this.rawCountry === null
      ? null
      : (regionAliases.get(this.rawCountry) ?? this.rawCountry);
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof Locale &&
        this.languageCode === other.languageCode &&
        this.scriptCode === other.scriptCode &&
        (this.countryCode || null) === (other.countryCode || null))
    );
  }
  get hashCode(): number {
    return hashDoubles(
      Array.from(
        JSON.stringify([this.languageCode, this.scriptCode, this.countryCode || null]),
        (c) => c.charCodeAt(0),
      ),
    );
  }
  private rawToString(separator: string): string {
    return [
      this.languageCode,
      ...(this.scriptCode ? [this.scriptCode] : []),
      ...(this.rawCountry ? [this.countryCode!] : []),
    ].join(separator);
  }
  toString(): string {
    return this.rawToString('_');
  }
  toLanguageTag(): string {
    return this.rawToString('-');
  }
}
