// SPDX-License-Identifier: BSD-3-Clause
// Radio-only common widget localization; design packages do not own Core semantics policy.
import type { BuildContext } from './framework.ts';
import { Localizations } from './app-data.ts';
import { canonicalLocaleTag } from './app-locales.ts';
import { radioUnselectedLabels } from './radio-localizations.generated.ts';

export function radioUnselectedHint(context: BuildContext): string {
  const localization = context.maybeDependOn(Localizations),
    key = 'radioButtonUnselectedLabel';
  const custom = localization?.text(key);
  if (custom !== undefined && custom !== key) return custom;
  for (const locale of [localization?.locale ?? 'en', localization?.fallback ?? 'en']) {
    const tag = canonicalLocaleTag(locale).replaceAll('-', '_'),
      parts = tag.split('_'),
      language = parts[0]!;
    const script = parts.find((part) => part.length === 4),
      region = parts.find(
        (part) => (part.length === 2 && part !== language) || /^\d{3}$/.test(part),
      );
    for (const candidate of [
      tag,
      ...(script ? [language + '_' + script] : []),
      ...(region ? [language + '_' + region] : []),
      language,
    ]) {
      const value = radioUnselectedLabels[candidate];
      if (value !== undefined) return value;
    }
  }
  return radioUnselectedLabels.en!;
}
