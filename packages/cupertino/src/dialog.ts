// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { allInsets } from '@nelyx/core/ui/geometry';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Column, Padding, Text, DecoratedBox, Align } from '@nelyx/core/framework/widgets/basic';
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';
import { CupertinoButton } from './button.ts';
export class CupertinoAlertDialog extends StatelessWidget {
  constructor(
    readonly title: string,
    readonly content: Widget,
    readonly onClose: () => void,
  ) {
    super();
  }
  build(context: BuildContext): Widget {
    const theme = AppTheme.of(context);
    return new Align(
      new Padding(
        allInsets(32),
        new DecoratedBox(
          new Padding(
            allInsets(20),
            new Column(
              [
                new Text(this.title, { fontSize: 22, color: theme.foreground }),
                this.content,
                new CupertinoButton('cupertino-dialog-close', 'Close', this.onClose),
              ],
              { spacing: 16, crossAlign: 'stretch' },
            ),
          ),
          theme.surface,
          14,
        ),
      ),
    );
  }
}
