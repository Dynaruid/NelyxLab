// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from "@nelyx/core/framework/widgets/inherited-theme";
import type { BuildContext, Widget, WidgetOptions } from "@nelyx/core/framework/widgets/framework";
import { Theme } from "./theme.ts";
import { CarouselViewThemeData } from "./carousel-view-theme-data.ts";
export { CarouselViewThemeData } from "./carousel-view-theme-data.ts";
export type { CarouselViewThemeDataOptions } from "./carousel-view-theme-data.ts";
export class CarouselViewTheme extends InheritedTheme {
  constructor(readonly data: CarouselViewThemeData, child: Widget, options: WidgetOptions = {}) { super(child, options.key ?? null);  }
  static of(context: BuildContext): CarouselViewThemeData { return context.maybeDependOn(CarouselViewTheme)?.data ?? Theme.of(context).carouselViewTheme; }
  wrap(_context: BuildContext, child: Widget): Widget { return new CarouselViewTheme(this.data, child); }
  updateShouldNotify(old: this): boolean { return !this.data.equals(old.data); }
}
