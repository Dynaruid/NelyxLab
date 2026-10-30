// SPDX-License-Identifier: BSD-3-Clause
import { Color } from '@nelyx/core/ui/color';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { CupertinoDynamicColor } from '../../colors.ts';
import type { CupertinoThemeData } from '../../theme-data.ts';
/** Existing Nelyx ARGB API plus the shared Core Color/dynamic-color input. */
export type CupertinoColor = number | Color;
export function coreCupertinoColor(value: CupertinoColor): Color {
  return typeof value === 'number' ? new Color(value) : value;
}
export function cupertinoColorValue(value: CupertinoColor): number {
  return coreCupertinoColor(value).toARGB32();
}
export function resolveCupertinoColor(value: CupertinoColor, context: BuildContext): Color {
  return CupertinoDynamicColor.resolve(coreCupertinoColor(value), context);
}
export function cupertinoColorEquals(a: CupertinoColor | null, b: CupertinoColor | null): boolean {
  return (
    a === b || (a !== null && b !== null && coreCupertinoColor(a).equals(coreCupertinoColor(b)))
  );
}

const themePrimaryColors = new WeakMap<CupertinoThemeData, () => CupertinoColor>();
/** Keep the source Color receiver until IconTheme resolves it in the descendant context. */
export function registerThemePrimaryColor(
  data: CupertinoThemeData,
  read: () => CupertinoColor,
): void {
  themePrimaryColors.set(data, read);
}
export function themePrimaryColor(data: CupertinoThemeData): Color {
  const read = themePrimaryColors.get(data);
  if (!read) throw new TypeError('CupertinoTheme requires canonical CupertinoThemeData');
  return coreCupertinoColor(read());
}
