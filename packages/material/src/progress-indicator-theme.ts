// SPDX-License-Identifier: BSD-3-Clause
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { Widget, WidgetOptions, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { ProgressIndicatorThemeData } from './progress-indicator-theme-data.ts';
export { ProgressIndicatorThemeData } from './progress-indicator-theme-data.ts';
export type { ProgressIndicatorThemeOptions } from './progress-indicator-theme-data.ts';
export class ProgressIndicatorTheme extends InheritedTheme {
  constructor(
    readonly data: ProgressIndicatorThemeData,
    child: Widget,
    options: WidgetOptions = {},
  ) {
    super(child, options.key ?? null);
  }
  static of(context: BuildContext): ProgressIndicatorThemeData {
    return (
      context.maybeDependOn(ProgressIndicatorTheme)?.data ??
      Theme.of(context).progressIndicatorTheme ??
      new ProgressIndicatorThemeData()
    );
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new ProgressIndicatorTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
