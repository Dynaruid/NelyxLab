// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { SwitchThemeData } from './generated/theme/toggle-theme-data.generated.ts';
export class SwitchTheme extends InheritedTheme {
  constructor(
    readonly data: SwitchThemeData,
    child: Widget,
    options: WidgetOptions = {},
  ) {
    super(child, options.key ?? null);
  }
  static of(context: BuildContext): SwitchThemeData {
    return context.maybeDependOn(SwitchTheme)?.data ?? Theme.of(context).switchTheme;
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new SwitchTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
export { SwitchThemeData } from './generated/theme/toggle-theme-data.generated.ts';
export type { SwitchThemeOptions } from './generated/theme/toggle-theme-data.generated.ts';
