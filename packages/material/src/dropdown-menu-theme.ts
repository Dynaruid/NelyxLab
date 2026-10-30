// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { DropdownMenuThemeData } from './dropdown-menu-theme-data.ts';
export { DropdownMenuThemeData } from './dropdown-menu-theme-data.ts';
export type { DropdownMenuThemeDataOptions } from './dropdown-menu-theme-data.ts';
export class DropdownMenuTheme extends InheritedTheme {
  readonly data: DropdownMenuThemeData;
  constructor(data: DropdownMenuThemeData, child: Widget, options: WidgetOptions = {}) {
    super(child, options.key ?? null);
    if (!(data instanceof DropdownMenuThemeData))
      throw new TypeError('Expected canonical DropdownMenuThemeData');
    this.data = data;
  }
  static maybeOf(context: BuildContext): DropdownMenuThemeData | null {
    return context.maybeDependOn(DropdownMenuTheme)?.data ?? null;
  }
  static of(context: BuildContext): DropdownMenuThemeData {
    return DropdownMenuTheme.maybeOf(context) ?? Theme.of(context).dropdownMenuTheme;
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new DropdownMenuTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
