// SPDX-License-Identifier: BSD-3-Clause
import type { DateTime } from './date-time.ts';
/** Date members consumed by the pinned Flutter date widgets. */
export interface DateLocalizationsContract {
  formatYear(date: DateTime): string;
  formatMonthYear(date: DateTime): string;
  formatMediumDate(date: DateTime): string;
  formatShortMonthDay(date: DateTime): string;
  formatShortDate(date: DateTime): string;
  formatFullDate(date: DateTime): string;
  formatCompactDate(date: DateTime): string;
  parseCompactDate(text: string): DateTime | null;
  formatDecimal(number: number): string;
  readonly dateHelpText: string;
  readonly firstDayOfWeekIndex: number;
  readonly currentDateLabel: string;
  readonly selectedDateLabel: string;
  readonly selectYearSemanticsLabel: string;
  readonly previousMonthTooltip: string;
  readonly nextMonthTooltip: string;
  readonly narrowWeekdays: readonly string[];
  readonly invalidDateFormatLabel: string;
  readonly dateOutOfRangeLabel: string;
  readonly dateInputLabel: string;
  readonly cancelButtonLabel: string;
  readonly okButtonLabel: string;
  readonly inputDateModeButtonLabel: string;
  readonly calendarModeButtonLabel: string;
  readonly datePickerHelpText: string;
}
