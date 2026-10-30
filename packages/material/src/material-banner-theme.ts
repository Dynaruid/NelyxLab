// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { MaterialBannerThemeData } from './material-banner-theme-data.ts';
export { MaterialBannerThemeData } from './material-banner-theme-data.ts';
export type { MaterialBannerThemeDataOptions } from './material-banner-theme-data.ts';
export class MaterialBannerTheme extends InheritedTheme {
  readonly data: MaterialBannerThemeData;
  constructor(
    data: MaterialBannerThemeData | null = null,
    child: Widget,
    options: WidgetOptions = {},
  ) {
    super(child, options.key ?? null);
    if (data !== null && !(data instanceof MaterialBannerThemeData))
      throw new TypeError('Expected canonical MaterialBannerThemeData');
    this.data = data ?? new MaterialBannerThemeData();
  }
  static of(context: BuildContext): MaterialBannerThemeData {
    return context.maybeDependOn(MaterialBannerTheme)?.data ?? Theme.of(context).bannerTheme;
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new MaterialBannerTheme(this.data, child);
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
