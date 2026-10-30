// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { PopupMenuThemeData } from './popup-menu-theme-data.ts';
export { PopupMenuThemeData } from './popup-menu-theme-data.ts';
export type { PopupMenuThemeDataOptions } from './popup-menu-theme-data.ts';
export class PopupMenuTheme extends InheritedTheme {
  readonly data: PopupMenuThemeData;
  constructor(data: PopupMenuThemeData, child: Widget, options: WidgetOptions = {}) {
    super(child, options.key ?? null);
    if (!(data instanceof PopupMenuThemeData))
      throw new TypeError('Expected canonical PopupMenuThemeData');
    this.data = data;
  }
  static of(context: BuildContext): PopupMenuThemeData {
    return context.maybeDependOn(PopupMenuTheme)?.data ?? Theme.of(context).popupMenuTheme;
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new PopupMenuTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
