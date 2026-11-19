// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/grid_tile_bar.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { Column, Expanded, Padding, Row } from '@nelyx/core/framework/widgets/basic';
import { Container } from '@nelyx/core/framework/widgets/container';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import type { Color } from '@nelyx/core/ui/color';
import { Colors } from './colors.ts';
import { Theme } from './theme.ts';
import { ThemeData } from './theme-data.ts';

export interface GridTileBarOptions extends WidgetOptions {
  readonly backgroundColor?: Color | null;
  readonly leading?: Widget | null;
  readonly title?: Widget | null;
  readonly subtitle?: Widget | null;
  readonly trailing?: Widget | null;
}

export class GridTileBar extends StatelessWidget {
  readonly options: Readonly<GridTileBarOptions>;

  constructor(options: GridTileBarOptions = {}) {
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
  }

  override build(): Widget {
    const { backgroundColor, leading, title, subtitle, trailing } = this.options;
    const dark = ThemeData.dark();
    const titleStyle = dark.textTheme.titleMedium!;
    const styled = (style: TextStyle, child: Widget) =>
      new DefaultTextStyle(style, child, { softWrap: false, overflow: 'ellipsis' });
    const children: Widget[] = [];
    if (leading) children.push(new Padding(EdgeInsetsDirectional.only({ end: 8 }), leading));
    if (title && subtitle)
      children.push(
        new Expanded(
          new Column([styled(titleStyle, title), styled(dark.textTheme.bodySmall!, subtitle)], {
            mainAxisAlignment: 'center',
            crossAxisAlignment: 'start',
          }),
        ),
      );
    else if (title || subtitle)
      children.push(new Expanded(styled(titleStyle, (title ?? subtitle)!)));
    if (trailing) children.push(new Padding(EdgeInsetsDirectional.only({ start: 8 }), trailing));
    return new Container({
      color: backgroundColor?.toARGB32() ?? null,
      height: title && subtitle ? 68 : 48,
      padding: EdgeInsetsDirectional.only({ start: leading ? 8 : 16, end: trailing ? 8 : 16 }),
      child: new Theme({
        data: dark,
        child: IconTheme.merge({
          data: new IconThemeData({ color: Colors.white }),
          child: new Row(children),
        }),
      }),
    });
  }
}
