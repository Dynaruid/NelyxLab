// SPDX-License-Identifier: BSD-3-Clause
// One default path for ThemeData and TextTheme's ambient fallback; no Widget or ThemeData value dependency.
import { ColorScheme } from '../../color-scheme.ts';
import { material2021 } from '../../generated/theme/typography-data.ts';
import { platformTextThemes } from '../../generated/theme/typography-data.ts';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import type { TargetPlatform } from '@nelyx/core/foundation/platform';
import { Color } from '@nelyx/core/ui/color';
import type { TextTheme, TextThemeOptions } from '../../text-theme.ts';

export function platformTypographyNames(platform: TargetPlatform) {
  switch (platform) {
    case 'iOS':
      return ['blackCupertino', 'whiteCupertino'] as const;
    case 'macOS':
      return ['blackRedwoodCity', 'whiteRedwoodCity'] as const;
    case 'windows':
      return ['blackRedmond', 'whiteRedmond'] as const;
    case 'linux':
      return ['blackHelsinki', 'whiteHelsinki'] as const;
    case 'android':
    case 'fuchsia':
      return ['blackMountainView', 'whiteMountainView'] as const;
  }
}

export function materialTextThemeDefault(
  create: (options: TextThemeOptions) => TextTheme,
  colors: ColorScheme = new ColorScheme(),
  primary = false,
  category: keyof typeof material2021 = 'englishLike',
): TextTheme {
  const primaryColor = new Color(colors.brightness === 'dark' ? colors.surface : colors.primary);
  const luminance = primaryColor.computeLuminance();
  const primaryIsDark = (luminance + 0.05) * (luminance + 0.05) <= 0.15;
  const useWhite = primary ? primaryIsDark : colors.brightness === 'dark';
  const names = platformTypographyNames(FoundationPlatform.defaultTargetPlatform);
  const color = useWhite === (colors.brightness === 'dark') ? colors.onSurface : colors.surface;
  const colorTheme = create(platformTextThemes[names[useWhite ? 1 : 0]]).apply({
    bodyColor: color,
    displayColor: color,
    decorationColor: color,
  });
  return create(material2021[category]).merge(colorTheme);
}
