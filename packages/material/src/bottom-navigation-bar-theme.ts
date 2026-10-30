// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { BottomNavigationBarThemeData } from './bottom-navigation-bar-theme-data.ts';
export { BottomNavigationBarThemeData } from './bottom-navigation-bar-theme-data.ts';
export type { BottomNavigationBarThemeDataOptions } from './bottom-navigation-bar-theme-data.ts';
export class BottomNavigationBarTheme extends InheritedWidget {
  readonly data: BottomNavigationBarThemeData;
  constructor(data: BottomNavigationBarThemeData, child: Widget, options: WidgetOptions = {}) {
    super(child, options.key ?? null);
    if (!(data instanceof BottomNavigationBarThemeData))
      throw new TypeError('Expected canonical BottomNavigationBarThemeData');
    this.data = data;
  }
  static of(context: BuildContext): BottomNavigationBarThemeData {
    return (
      context.maybeDependOn(BottomNavigationBarTheme)?.data ??
      Theme.of(context).bottomNavigationBarTheme
    );
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
