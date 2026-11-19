// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Selection and time messages from the pinned localization tables.
import { InheritedWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Localizations } from '@nelyx/core/framework/widgets/app-data';
import { selectionMessages } from './generated/localizations/selection-localizations-data.ts';
import { scriptCategories } from './generated/localizations/script-categories.ts';
import { ScriptCategory } from './script-category.ts';
import { refreshIndicatorLabels } from './generated/localizations/refresh-localizations-data.ts';
import {
  closeButtonTooltips,
  drawerLabels,
  openAppDrawerTooltips,
  tabLabels,
} from './generated/localizations/app-bar-localizations-data.generated.ts';
import { SourceDateLocalizations } from './generated/date/material_localizations.generated.ts';
import {
  timeDigits,
  timeMessages,
} from './generated/localizations/time-localizations-data.generated.ts';
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
function categoryFor(candidates: readonly string[]): ScriptCategory {
  return ScriptCategory[
    candidates.reduce<'englishLike' | 'dense' | 'tall'>(
      (current, key) => scriptCategories[key] ?? current,
      'englishLike',
    )
  ];
}
export class MaterialLocalizations extends SourceDateLocalizations {
  private readonly messages: Readonly<Record<string, string>>;
  private readonly category: ScriptCategory;
  private timeData:
    | { readonly labels: Readonly<Record<string, string>>; readonly digits: string }
    | undefined;
  constructor(readonly locale = 'en') {
    super();
    const candidates = localeCandidates(locale);
    this.messages = Object.freeze(
      Object.assign(
        {},
        selectionMessages.en,
        ...candidates.map((key) => selectionMessages[key] ?? {}),
        {
          refreshIndicatorSemanticLabel: candidates.reduce(
            (label, key) => refreshIndicatorLabels[key] ?? label,
            refreshIndicatorLabels.en!,
          ),
          closeButtonTooltip: candidates.reduce(
            (label, key) => closeButtonTooltips[key] ?? label,
            closeButtonTooltips.en!,
          ),
          drawerLabel: candidates.reduce((label, key) => drawerLabels[key] ?? label, drawerLabels.en!),
          openAppDrawerTooltip: candidates.reduce(
            (label, key) => openAppDrawerTooltips[key] ?? label,
            openAppDrawerTooltips.en!,
          ),
          tabLabel: candidates.reduce((label, key) => tabLabels[key] ?? label, tabLabels.en!),
        },
      ),
    );
    this.category = categoryFor(candidates);
  }
  get scriptCategory(): ScriptCategory {
    return this.category;
  }
  get refreshIndicatorSemanticLabel(): string {
    return this.message('refreshIndicatorSemanticLabel');
  }
  static of(context: BuildContext): MaterialLocalizations {
    return (
      context.maybeDependOn(MaterialLocalizationsScope)?.data ??
      new MaterialLocalizations(context.maybeDependOn(Localizations)?.locale ?? 'en')
    );
  }
  static get supportedLocales(): readonly string[] {
    return Object.freeze(Object.keys(selectionMessages));
  }
  protected message(key: string): string {
    const value = this.messages[key];
    if (value === undefined) throw new Error('Missing Material selection localization: ' + key);
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
    return this.message('tabLabel')
      .replace('$tabIndex', this.timePickerNumber(tabIndex))
      .replace('$tabCount', this.timePickerNumber(tabCount));
  }
  private timeLocalization() {
    if (!this.timeData) {
      const candidates = localeCandidates(this.locale);
      this.timeData = {
        labels: Object.freeze(
          Object.assign({}, timeMessages.en, ...candidates.map((key) => timeMessages[key] ?? {})),
        ),
        digits: candidates.reduce((digits, key) => timeDigits[key] ?? digits, timeDigits.en!),
      };
    }
    return this.timeData;
  }
  private timeLabel(key: string): string {
    const value = this.timeLocalization().labels[key];
    if (value === undefined) throw new Error('Missing Material time localization: ' + key);
    return value;
  }
  /** @internal Localized numerals for the finite time picker input domain. */
  timePickerNumber(value: number, width = 1): string {
    const digits = [...this.timeLocalization().digits];
    return String(value)
      .padStart(width, '0')
      .replace(/\d/g, (digit) => digits[Number(digit)]!);
  }
  /** @internal Text entered into a picker can use local or ASCII digits. */
  parseTimePickerNumber(value: string): number | null {
    const digits = [...this.timeLocalization().digits];
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
    const format = this.timeLabel('timeOfDayFormat') as TimeOfDayFormat;
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
    return this.timeLabel('anteMeridiemAbbreviation');
  }
  get postMeridiemAbbreviation(): string {
    return this.timeLabel('postMeridiemAbbreviation');
  }
  get timePickerDialHelpText(): string {
    return this.timeLabel('timePickerDialHelpText');
  }
  get timePickerInputHelpText(): string {
    return this.timeLabel('timePickerInputHelpText');
  }
  get timePickerHourLabel(): string {
    return this.timeLabel('timePickerHourLabel');
  }
  get timePickerMinuteLabel(): string {
    return this.timeLabel('timePickerMinuteLabel');
  }
  get timePickerHourModeAnnouncement(): string {
    return this.timeLabel('timePickerHourModeAnnouncement');
  }
  get timePickerMinuteModeAnnouncement(): string {
    return this.timeLabel('timePickerMinuteModeAnnouncement');
  }
  get invalidTimeLabel(): string {
    return this.timeLabel('invalidTimeLabel');
  }
  get dialModeButtonLabel(): string {
    return this.timeLabel('dialModeButtonLabel');
  }
  get inputTimeModeButtonLabel(): string {
    return this.timeLabel('inputTimeModeButtonLabel');
  }
  get modalBarrierDismissLabel(): string {
    return this.timeLabel('modalBarrierDismissLabel');
  }
  override get cancelButtonLabel(): string {
    return this.timeLabel('cancelButtonLabel');
  }
  override get okButtonLabel(): string {
    return this.timeLabel('okButtonLabel');
  }
}
export class DefaultMaterialLocalizations extends MaterialLocalizations {
  constructor() {
    super('en');
  }
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
  const locale = context.maybeDependOn(Localizations)?.locale ?? 'en';
  if (typeof locale !== 'string') return new MaterialLocalizations(locale).scriptCategory;
  // The generated category table and enum are frozen. Keep only one scalar
  // locale result; public localization objects and mutable messages stay fresh.
  if (locale !== scriptLocale) {
    cachedScriptCategory = categoryFor(localeCandidates(locale));
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
