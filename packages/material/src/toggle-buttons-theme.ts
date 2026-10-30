// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { ToggleButtonsThemeData } from './toggle-buttons-theme-data.ts';
export { ToggleButtonsThemeData } from './toggle-buttons-theme-data.ts';
export type { ToggleButtonsThemeDataOptions } from './toggle-buttons-theme-data.ts';
export class ToggleButtonsTheme extends InheritedTheme {
  readonly data: ToggleButtonsThemeData;
  constructor(data: ToggleButtonsThemeData, child: Widget, options: WidgetOptions = {}) {
    super(child, options.key ?? null);
    if (!(data instanceof ToggleButtonsThemeData))
      throw new TypeError('Expected canonical ToggleButtonsThemeData');
    this.data = data;
  }
  static of(context: BuildContext): ToggleButtonsThemeData {
    return context.maybeDependOn(ToggleButtonsTheme)?.data ?? Theme.of(context).toggleButtonsTheme;
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new ToggleButtonsTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
