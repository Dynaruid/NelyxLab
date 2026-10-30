// SPDX-License-Identifier: BSD-3-Clause
// Exact canonical wrapper witnesses avoid importing UI consumers into ThemeData.
import { AppBarThemeData } from '../../app-bar-theme-data.ts';
import { InputDecorationThemeData } from '../../input-decoration-theme-data.ts';
import type { AppBarTheme } from '../../app-bar-theme.ts';
import type { InputDecorationTheme } from '../../input-decoration-theme.ts';
const appBars = new WeakMap<AppBarTheme, () => AppBarThemeData>(),
  inputs = new WeakMap<InputDecorationTheme, () => InputDecorationThemeData>();
export function registerAppBarTheme(value: AppBarTheme): void {
  appBars.set(value, () => value.data);
}
export function registerInputDecorationTheme(value: InputDecorationTheme): void {
  inputs.set(value, () => value.data);
}
export function appBarThemeData(
  value: AppBarThemeData | AppBarTheme | null | undefined,
): AppBarThemeData | null {
  if (value == null) return null;
  if (value instanceof AppBarThemeData) return value;
  const read = appBars.get(value);
  if (!read) throw new TypeError('appBarTheme must be either AppBarThemeData or AppBarTheme');
  const data = read();
  if (!(data instanceof AppBarThemeData))
    throw new TypeError('AppBarTheme must return canonical AppBarThemeData');
  return data;
}
export function inputDecorationThemeData(
  value: InputDecorationThemeData | InputDecorationTheme | null | undefined,
): InputDecorationThemeData | null {
  if (value == null) return null;
  if (value instanceof InputDecorationThemeData) return value;
  const read = inputs.get(value);
  if (!read)
    throw new TypeError(
      'inputDecorationTheme must be either InputDecorationThemeData or InputDecorationTheme',
    );
  return read();
}
