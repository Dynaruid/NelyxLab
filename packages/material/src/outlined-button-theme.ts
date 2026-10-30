// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { OutlinedButtonThemeData } from './outlined-button-theme-data.ts';
export { OutlinedButtonThemeData } from './outlined-button-theme-data.ts';
export class OutlinedButtonTheme extends InheritedTheme {
  constructor(
    readonly data: OutlinedButtonThemeData,
    child: Widget,
    options: WidgetOptions = {},
  ) {
    super(child, options.key ?? null);
  }
  static of(context: BuildContext): OutlinedButtonThemeData {
    return (
      context.maybeDependOn(OutlinedButtonTheme)?.data ?? Theme.of(context).outlinedButtonTheme
    );
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new OutlinedButtonTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
