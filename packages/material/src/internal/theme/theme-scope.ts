// SPDX-License-Identifier: BSD-3-Clause
// A design-owned scope over the single Core inherited tree; value modules import its data type only.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import { findAncestorInheritedElement } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import type { ThemeData } from '../../theme-data.ts';

export abstract class MaterialThemeScope extends InheritedTheme {
  protected constructor(
    readonly data: ThemeData,
    child: Widget,
  ) {
    super(child);
  }
  abstract resolveData(context: BuildContext): ThemeData;
}

export function maybeMaterialThemeScopeOf(context: BuildContext): MaterialThemeScope | null {
  const ancestor = findAncestorInheritedElement(context, MaterialThemeScope);
  return ancestor ? context.dependOnInheritedElement<MaterialThemeScope>(ancestor) : null;
}

export function maybeMaterialThemeDataOf(context: BuildContext): ThemeData | null {
  return maybeMaterialThemeScopeOf(context)?.resolveData(context) ?? null;
}
