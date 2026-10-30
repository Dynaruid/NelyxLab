// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';
import { allInsets } from '@nelyx/core/ui/geometry';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Column, Row, Expanded, Padding, Text } from '@nelyx/core/framework/widgets/basic';
import { Material as MaterialSurface } from './material.ts';
import { Color } from '@nelyx/core/ui/color';
export class Scaffold extends StatelessWidget {
  constructor(
    readonly title: string,
    readonly body: Widget,
    readonly trailing?: Widget,
  ) {
    super();
  }
  build(context: BuildContext): Widget {
    const theme = AppTheme.of(context);
    return new MaterialSurface({
      color: new Color(theme.background),
      child: new Padding(
        allInsets(20),
        new Column(
          [
            new Row(
              [
                new Expanded(new Text(this.title, { fontSize: 28, color: theme.foreground })),
                ...(this.trailing ? [this.trailing] : []),
              ],
              { spacing: 12 },
            ),
            new Expanded(this.body),
          ],
          {
            spacing: 20,
            crossAlign: 'stretch',
            mainSize: 'max',
          },
        ),
      ),
    });
  }
}
