// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { ListTileThemeData } from './list-tile-theme-data.ts';
import type { ListTileThemeDataOptions } from './list-tile-theme-data.ts';
import { Theme } from './theme.ts';
export { ListTileThemeData } from './list-tile-theme-data.ts';
export type { ListTileThemeDataOptions } from './list-tile-theme-data.ts';
export class ListTileTheme extends InheritedTheme {
  constructor(
    readonly data: ListTileThemeData,
    child: Widget,
    options: WidgetOptions = {},
  ) {
    super(child, options.key ?? null);
  }
  static of(context: BuildContext): ListTileThemeData {
    return context.maybeDependOn(ListTileTheme)?.data ?? Theme.of(context).listTileTheme;
  }
  static merge(
    o: ListTileThemeDataOptions &
      WidgetOptions & {
        readonly child: Widget;
      },
  ): Widget {
    return new ListTileThemeMerge(o);
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    const d = this.data;
    return new ListTileTheme(
      new ListTileThemeData({
        dense: d.dense,
        shape: d.shape,
        style: d.style,
        selectedColor: d.selectedColor,
        iconColor: d.iconColor,
        textColor: d.textColor,
        contentPadding: d.contentPadding,
        tileColor: d.tileColor,
        selectedTileColor: d.selectedTileColor,
        enableFeedback: d.enableFeedback,
        horizontalTitleGap: d.horizontalTitleGap,
        minVerticalPadding: d.minVerticalPadding,
        minLeadingWidth: d.minLeadingWidth,
        isThreeLine: d.isThreeLine,
      }),
      child,
    );
  }
  updateShouldNotify(old: this): boolean {
    return !this.data.equals(old.data);
  }
}
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
class ListTileThemeMerge extends StatelessWidget {
  constructor(
    readonly options: ListTileThemeDataOptions &
      WidgetOptions & {
        readonly child: Widget;
      },
  ) {
    super(options.key ?? null);
  }
  build(context: BuildContext): Widget {
    return new ListTileTheme(ListTileTheme.of(context).copyWith(this.options), this.options.child, {
      key: this.options.key ?? null,
    });
  }
}
