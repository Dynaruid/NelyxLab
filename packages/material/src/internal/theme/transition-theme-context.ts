import { defaultMaterialColorScheme } from './default-color-schemes.ts';
// SPDX-License-Identifier: BSD-3-Clause
// Selected color/platform projection over the canonical inherited theme data.
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import type { TargetPlatform } from '@nelyx/core/foundation/platform';
import { CupertinoTheme, InheritedCupertinoTheme } from '@nelyx/cupertino/theme';
import type { CupertinoThemeData } from '@nelyx/cupertino/theme';
import { ColorScheme } from '../../color-scheme.ts';
import { maybeMaterialThemeDataOf } from './theme-scope.ts';

export function cupertinoMaterialColorScheme(data: CupertinoThemeData): ColorScheme {
  return ColorScheme.fromSeed({
    seedColor: data.primaryColor,
    brightness: data.brightness,
    primary: data.primaryColor,
    onPrimary: data.primaryContrastingColor,
  });
}
export function materialTransitionThemeOf(context: BuildContext): {
  readonly colorScheme: ColorScheme;
  readonly platform: TargetPlatform;
} {
  const material = maybeMaterialThemeDataOf(context);
  if (material) return material;
  const cupertino = context.maybeDependOn(InheritedCupertinoTheme);
  return {
    colorScheme: cupertino
      ? cupertinoMaterialColorScheme(CupertinoTheme.of(context))
      : fallbackColorScheme,
    platform: FoundationPlatform.defaultTargetPlatform,
  };
}
const fallbackColorScheme = defaultMaterialColorScheme('light');
