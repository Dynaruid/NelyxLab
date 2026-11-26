// SPDX-License-Identifier: BSD-3-Clause
import type { BuildContext } from './framework.ts';
import { Localizations } from './app-data.ts';
import { WidgetsLocalizations } from './widgets-localizations.ts';

export function radioUnselectedHint(context: BuildContext): string {
  const localization = context.maybeDependOn(Localizations),
    key = 'radioButtonUnselectedLabel';
  const custom = localization?.text(key);
  if (custom !== undefined && custom !== key) return custom;
  return (
    localization?.resource(WidgetsLocalizations) ??
    WidgetsLocalizations.forLocale(localization?.locale ?? 'en', localization?.fallback)
  ).radioButtonUnselectedLabel;
}
