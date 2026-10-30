// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { ActionIconThemeData } from './action-icon-theme-data.ts';
export { ActionIconThemeData } from './action-icon-theme-data.ts';
export type { ActionIconThemeDataOptions } from './action-icon-theme-data.ts';
export class ActionIconTheme extends InheritedTheme {
  constructor(
    readonly data: ActionIconThemeData,
    child: Widget,
    options: WidgetOptions = {},
  ) {
    super(child, options.key ?? null);
  }
  static of(context: BuildContext): ActionIconThemeData | null {
    return context.maybeDependOn(ActionIconTheme)?.data ?? Theme.of(context).actionIconTheme;
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new ActionIconTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
