// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/material_localizations.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { InheritedWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Localizations, LocalizationsDelegate } from '@nelyx/core/framework/widgets/app-data';
import type { Locale } from '@nelyx/core/ui/locale';
import { IntlProvider } from '@nelyx/core/framework/widgets/intl-provider';
import { WidgetLocalizationCatalog } from '@nelyx/core/framework/widgets/widget-localization-catalog';
import { checkedInteger } from '@nelyx/core/internal/ui/value-math';
import { ScriptCategory } from './script-category.ts';
import type { DateRangeLabel } from './internal/date/range-labels.ts';
import type { MenuKeyboardLabel } from './internal/menu-keyboard-labels.ts';
import { IntlDateLocalizations } from './internal/date/date-localizations.ts';
import type { DateTime } from './internal/date/date-time.ts';
import { SourceDateLocalizations } from './generated/date/material_localizations.generated.ts';
import { materialArb } from './generated/localizations/material-arb.generated.ts';
import { timeDigits } from './generated/localizations/time-localizations-data.generated.ts';
import { DayPeriod, HourFormat, TimeOfDayFormat, hourFormat } from './time.ts';
import type { TimeOfDay } from './time.ts';
function localeCandidates(locale: string): string[] {
  const parts = locale.replaceAll('-', '_').split('_'),
    language = parts[0]!,
    script = parts.find((value) => value.length === 4),
    region = parts.find(
      (value) => (value.length === 2 && value !== language) || value.length === 3,
    );
  return [
    language,
    ...(script ? [language + '_' + script] : []),
    ...(region ? [language + '_' + region] : []),
    parts.join('_'),
  ];
}
function categoryFor(catalog: WidgetLocalizationCatalog): ScriptCategory {
  const category = catalog.raw('scriptCategory');
  if (category === 'dense') return ScriptCategory.dense;
  return category === 'tall' ? ScriptCategory.tall : ScriptCategory.englishLike;
}

const timeFormats: Readonly<Record<string, keyof typeof TimeOfDayFormat>> = {
  'H:mm': 'H_colon_mm',
  'h:mm a': 'h_colon_mm_space_a',
  'HH:mm': 'HH_colon_mm',
  'HH:mm น.': 'HH_colon_mm',
  'HH.mm': 'HH_dot_mm',
  "HH 'h' mm": 'frenchCanadian',
  'a h:mm': 'a_space_h_colon_mm',
  'ah:mm': 'a_space_h_colon_mm',
};
const catalogLocales = Object.freeze(Object.keys(materialArb.locales));

export class MaterialLocalizations extends SourceDateLocalizations {
  private readonly intl: IntlProvider;
  private readonly catalog: WidgetLocalizationCatalog;
  private dateData: IntlDateLocalizations | null | undefined;
  private numericTimeDigits: readonly string[] | undefined;

  keyboardKeyLabel(key: MenuKeyboardLabel): string {
    return this.message(key);
  }

  dateRangeLabel(key: DateRangeLabel, fullDate?: string): string {
    switch (key) {
      case 'dateHelpText':
      case 'calendarModeButtonLabel':
      case 'cancelButtonLabel':
      case 'closeButtonTooltip':
      case 'currentDateLabel':
      case 'dateOutOfRangeLabel':
      case 'inputDateModeButtonLabel':
      case 'invalidDateFormatLabel':
      case 'okButtonLabel':
        return this[key];
      case 'dateRangeStartDateSemanticLabel':
      case 'dateRangeEndDateSemanticLabel':
        return fullDate === undefined ? this.message(key) : this.catalog.format(key, { fullDate });
      default:
        return this.message(key);
    }
  }
  get menuDismissLabel(): string {
    return this.message('menuDismissLabel');
  }
  get popupMenuLabel(): string {
    return this.message('popupMenuLabel');
  }
  get showMenuTooltip(): string {
    return this.message('showMenuTooltip');
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
  get continueButtonLabel(): string {
    return this.message('continueButtonLabel');
  }
  get searchFieldLabel(): string {
    return this.message('searchFieldLabel');
  }
  get clearButtonTooltip(): string {
    return this.message('clearButtonTooltip');
  }
  get signedInLabel(): string {
    return this.message('signedInLabel');
  }
  get showAccountsLabel(): string {
    return this.message('showAccountsLabel');
  }
  get hideAccountsLabel(): string {
    return this.message('hideAccountsLabel');
  }

  constructor(readonly locale = 'en') {
    super();
    this.intl = IntlProvider.forLocale(locale);
    this.catalog = new WidgetLocalizationCatalog(materialArb, this.intl);
  }

  private get dates(): IntlDateLocalizations | null {
    if (this.dateData === undefined) this.dateData = IntlDateLocalizations.forProvider(this.intl);
    return this.dateData;
  }
  override formatCompactDate(date: DateTime): string {
    return this.dates?.format('compact', date) ?? super.formatCompactDate(date);
  }
  override parseCompactDate(input: string | null): DateTime | null {
    return this.dates ? this.dates.parse(input) : super.parseCompactDate(input);
  }
  override formatShortDate(date: DateTime): string {
    return this.dates?.format('short', date) ?? super.formatShortDate(date);
  }
  override formatShortMonthDay(date: DateTime): string {
    return this.dates?.format('shortDay', date) ?? super.formatShortMonthDay(date);
  }
  override formatMediumDate(date: DateTime): string {
    return this.dates?.format('medium', date) ?? super.formatMediumDate(date);
  }
  override formatFullDate(date: DateTime): string {
    return this.dates?.format('full', date) ?? super.formatFullDate(date);
  }
  override formatMonthYear(date: DateTime): string {
    return this.dates?.format('month', date) ?? super.formatMonthYear(date);
  }
  override formatYear(date: DateTime): string {
    return this.dates?.format('year', date) ?? super.formatYear(date);
  }
  override formatDecimal(value: number): string {
    return this.dates?.decimal.format(checkedInteger(value)) ?? super.formatDecimal(value);
  }
  override get narrowWeekdays(): readonly string[] {
    return this.dates?.narrowWeekdays ?? super.narrowWeekdays;
  }
  override get firstDayOfWeekIndex(): number {
    return this.dates?.firstDayOfWeekIndex ?? super.firstDayOfWeekIndex;
  }
  override get dateHelpText(): string {
    return this.dates?.dateHelpText ?? super.dateHelpText;
  }
  override get selectYearSemanticsLabel(): string {
    return this.message('selectYearSemanticsLabel');
  }
  override get dateInputLabel(): string {
    return this.message('dateInputLabel');
  }
  override get invalidDateFormatLabel(): string {
    return this.message('invalidDateFormatLabel');
  }
  override get dateOutOfRangeLabel(): string {
    return this.message('dateOutOfRangeLabel');
  }
  override get datePickerHelpText(): string {
    return this.message('datePickerHelpText');
  }
  override get calendarModeButtonLabel(): string {
    return this.message('calendarModeButtonLabel');
  }
  override get inputDateModeButtonLabel(): string {
    return this.message('inputDateModeButtonLabel');
  }
  override get nextMonthTooltip(): string {
    return this.message('nextMonthTooltip');
  }
  override get previousMonthTooltip(): string {
    return this.message('previousMonthTooltip');
  }
  override get currentDateLabel(): string {
    return this.message('currentDateLabel');
  }
  override get selectedDateLabel(): string {
    return this.message('selectedDateLabel');
  }

  get scriptCategory(): ScriptCategory {
    return categoryFor(this.catalog);
  }
  aboutListTileTitle(applicationName: string): string {
    return this.catalog.format('aboutListTileTitle', { applicationName });
  }
  get viewLicensesButtonLabel(): string {
    return this.message('viewLicensesButtonLabel');
  }
  get closeButtonLabel(): string {
    return this.message('closeButtonLabel');
  }
  get licensesPageTitle(): string {
    return this.message('licensesPageTitle');
  }
  licensesPackageDetailText(licenseCount: number): string {
    return this.catalog.format('licensesPackageDetailText', { licenseCount });
  }
  get refreshIndicatorSemanticLabel(): string {
    return this.message('refreshIndicatorSemanticLabel');
  }
  get expandedIconTapHint(): string {
    return this.message('expandedIconTapHint');
  }
  get collapsedIconTapHint(): string {
    return this.message('collapsedIconTapHint');
  }
  get dialogLabel(): string {
    return this.message('dialogLabel');
  }
  get alertDialogLabel(): string {
    return this.message('alertDialogLabel');
  }
  get scrimLabel(): string {
    return this.message('scrimLabel');
  }
  get bottomSheetLabel(): string {
    return this.message('bottomSheetLabel');
  }
  scrimOnTapHint(modalRouteContentName: string): string {
    return this.catalog.format('scrimOnTapHint', { modalRouteContentName });
  }
  static of(context: BuildContext): MaterialLocalizations {
    const localizations = context.maybeDependOn(Localizations);
    return (
      context.maybeDependOn(MaterialLocalizationsScope)?.data ??
      localizations?.resource(MaterialLocalizations) ??
      new MaterialLocalizations(localizations?.locale ?? 'en')
    );
  }
  static get supportedLocales(): readonly string[] {
    return catalogLocales;
  }
  protected message(key: string): string {
    const value = this.catalog.raw(key);
    if (value === undefined) throw new Error('Missing Material localization: ' + key);
    return value;
  }
  get cutButtonLabel(): string {
    return this.message('cutButtonLabel');
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
  get searchWebButtonLabel(): string {
    return this.message('searchWebButtonLabel');
  }
  get shareButtonLabel(): string {
    return this.message('shareButtonLabel');
  }
  get deleteButtonTooltip(): string {
    return this.message('deleteButtonTooltip');
  }
  get scanTextButtonLabel(): string {
    return this.message('scanTextButtonLabel');
  }
  get moreButtonTooltip(): string {
    return this.message('moreButtonTooltip');
  }
  get backButtonTooltip(): string {
    return this.message('backButtonTooltip');
  }
  get closeButtonTooltip(): string {
    return this.message('closeButtonTooltip');
  }
  get drawerLabel(): string {
    return this.message('drawerLabel');
  }
  get openAppDrawerTooltip(): string {
    return this.message('openAppDrawerTooltip');
  }
  tabLabel({
    tabIndex,
    tabCount,
  }: {
    readonly tabIndex: number;
    readonly tabCount: number;
  }): string {
    return this.catalog.format('tabLabel', { tabIndex, tabCount });
  }
  private get timePickerDigits(): readonly string[] {
    return (this.numericTimeDigits ??= Array.from(
      localeCandidates(this.intl.locale).reduce(
        (digits, key) => timeDigits[key] ?? digits,
        timeDigits.en!,
      ),
    ));
  }
  /** @internal Localized numerals for the finite time picker input domain. */
  timePickerNumber(value: number, width = 1): string {
    const digits = this.timePickerDigits;
    return String(value)
      .padStart(width, '0')
      .replace(/\d/g, (digit) => digits[Number(digit)]!);
  }
  /** @internal Text entered into a picker can use local or ASCII digits. */
  parseTimePickerNumber(value: string): number | null {
    const digits = this.timePickerDigits;
    const input = [...value.trim()]
      .map((char) => {
        const digit = digits.indexOf(char);
        return digit < 0 ? char : String(digit);
      })
      .join('');
    return /^\d{1,2}$/.test(input) ? Number(input) : null;
  }
  timeOfDayFormat({
    alwaysUse24HourFormat = false,
  }: { readonly alwaysUse24HourFormat?: boolean } = {}): TimeOfDayFormat {
    const format = TimeOfDayFormat[timeFormats[this.message('timeOfDayFormat')]!];
    return alwaysUse24HourFormat && hourFormat({ of: format }) === HourFormat.h
      ? TimeOfDayFormat.HH_colon_mm
      : format;
  }
  formatHour(time: TimeOfDay, options: { readonly alwaysUse24HourFormat?: boolean } = {}): string {
    const format = hourFormat({ of: this.timeOfDayFormat(options) });
    if (format === HourFormat.h) return this.timePickerNumber(time.hourOfPeriod);
    return this.timePickerNumber(time.hour, format === HourFormat.HH ? 2 : 1);
  }
  formatMinute(time: TimeOfDay): string {
    return this.timePickerNumber(time.minute, 2);
  }
  formatTimeOfDay(
    time: TimeOfDay,
    options: { readonly alwaysUse24HourFormat?: boolean } = {},
  ): string {
    const hour = this.formatHour(time, options);
    const minute = this.formatMinute(time);
    const period =
      time.period === DayPeriod.am ? this.anteMeridiemAbbreviation : this.postMeridiemAbbreviation;
    switch (this.timeOfDayFormat(options)) {
      case TimeOfDayFormat.HH_dot_mm:
        return `${hour}.${minute}`;
      case TimeOfDayFormat.frenchCanadian:
        return `${hour} h ${minute}`;
      case TimeOfDayFormat.h_colon_mm_space_a:
        return `${hour}:${minute} ${period}`;
      case TimeOfDayFormat.a_space_h_colon_mm:
        return `${period} ${hour}:${minute}`;
      default:
        return `${hour}:${minute}`;
    }
  }
  get anteMeridiemAbbreviation(): string {
    return this.message('anteMeridiemAbbreviation');
  }
  get postMeridiemAbbreviation(): string {
    return this.message('postMeridiemAbbreviation');
  }
  get timePickerDialHelpText(): string {
    return this.message('timePickerDialHelpText');
  }
  get timePickerInputHelpText(): string {
    return this.message('timePickerInputHelpText');
  }
  get timePickerHourLabel(): string {
    return this.message('timePickerHourLabel');
  }
  get timePickerMinuteLabel(): string {
    return this.message('timePickerMinuteLabel');
  }
  get timePickerHourModeAnnouncement(): string {
    return this.message('timePickerHourModeAnnouncement');
  }
  get timePickerMinuteModeAnnouncement(): string {
    return this.message('timePickerMinuteModeAnnouncement');
  }
  get invalidTimeLabel(): string {
    return this.message('invalidTimeLabel');
  }
  get dialModeButtonLabel(): string {
    return this.message('dialModeButtonLabel');
  }
  get inputTimeModeButtonLabel(): string {
    return this.message('inputTimeModeButtonLabel');
  }
  get modalBarrierDismissLabel(): string {
    return this.message('modalBarrierDismissLabel');
  }
  override get cancelButtonLabel(): string {
    return this.message('cancelButtonLabel');
  }
  override get okButtonLabel(): string {
    return this.message('okButtonLabel');
  }
}
class MaterialLocalizationsDelegate extends LocalizationsDelegate<MaterialLocalizations> {
  readonly type = MaterialLocalizations;
  isSupported(locale: Locale): boolean {
    return locale.languageCode === 'en';
  }
  load(_locale: Locale): DefaultMaterialLocalizations {
    return new DefaultMaterialLocalizations();
  }
  shouldReload(_previous: this): boolean {
    return false;
  }
  toString(): string {
    return 'DefaultMaterialLocalizations.delegate(en_US)';
  }
}

export class DefaultMaterialLocalizations extends MaterialLocalizations {
  static readonly delegate: LocalizationsDelegate<MaterialLocalizations> = Object.freeze(
    new MaterialLocalizationsDelegate(),
  );
  static load(_locale: Locale): Promise<DefaultMaterialLocalizations> {
    return Promise.resolve(new DefaultMaterialLocalizations());
  }
  constructor() {
    super('en');
  }
}
const catalogResources = new WeakSet<MaterialLocalizations>();
/** The app's bundled locale catalog supports region-specific formats. */
export const materialCatalogDelegate: LocalizationsDelegate<MaterialLocalizations> = Object.freeze({
  type: MaterialLocalizations,
  isSupported: () => true,
  load(locale: Locale) {
    const resource = new MaterialLocalizations(locale.toLanguageTag());
    catalogResources.add(resource);
    return resource;
  },
  shouldReload: () => false,
});

/** @internal Explicit picker locales select a catalog unless the app provided its own resource. */
export function materialPickerLocalizations(
  context: BuildContext,
  locale: string,
): MaterialLocalizations {
  const scope = context.maybeDependOn(MaterialLocalizationsScope);
  const inherited = Localizations.of(context, MaterialLocalizations);
  return (
    scope?.data ??
    (inherited && !catalogResources.has(inherited) ? inherited : new MaterialLocalizations(locale))
  );
}
const defaultLocalizationsOf = MaterialLocalizations.of;
let scriptLocale: string | undefined,
  cachedScriptCategory = ScriptCategory.englishLike;
/** @internal Theme needs the immutable script category without materializing menu messages. */
export function materialScriptCategoryOf(context: BuildContext): ScriptCategory {
  if (MaterialLocalizations.of !== defaultLocalizationsOf)
    return MaterialLocalizations.of(context).scriptCategory;
  const provided = context.maybeDependOn(MaterialLocalizationsScope)?.data;
  if (provided !== undefined && provided !== null) return provided.scriptCategory;
  const localizations = context.maybeDependOn(Localizations);
  const registered = localizations?.resource(MaterialLocalizations);
  if (registered) return registered.scriptCategory;
  const locale = localizations?.locale ?? 'en';
  if (typeof locale !== 'string') return new MaterialLocalizations(locale).scriptCategory;
  // The generated category table and enum are frozen. Keep only one scalar
  // locale result; public localization objects and mutable messages stay fresh.
  if (locale !== scriptLocale) {
    cachedScriptCategory = categoryFor(
      new WidgetLocalizationCatalog(materialArb, IntlProvider.forLocale(locale)),
    );
    scriptLocale = locale;
  }
  return cachedScriptCategory;
}
export class MaterialLocalizationsScope extends InheritedWidget {
  constructor(
    readonly data: MaterialLocalizations,
    child: Widget,
  ) {
    super(child);
  }
  updateShouldNotify(old: this): boolean {
    return old.data !== this.data;
  }
}
