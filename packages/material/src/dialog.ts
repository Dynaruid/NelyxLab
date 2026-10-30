// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';
import { allInsets } from '@nelyx/core/ui/geometry';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Column, Padding, Text, DecoratedBox, Align } from '@nelyx/core/framework/widgets/basic';
import { createDialogRoute } from '@nelyx/core/framework/widgets/dialog';
import type { DialogRouteOptions } from '@nelyx/core/framework/widgets/dialog';
import type { NavigatorController } from '@nelyx/core/framework/widgets/navigation';
import { FilledButton } from './filled-button.ts';
export class AlertDialog extends StatelessWidget {
  constructor(
    readonly id: string,
    readonly title: string,
    readonly content: Widget,
    readonly onClose: () => void,
  ) {
    super();
  }
  build(context: BuildContext): Widget {
    const theme = AppTheme.of(context);
    const content = new Column(
      [
        new Text(this.title, { fontSize: 24, color: theme.foreground }),
        this.content,
        new FilledButton(this.id + '-close', 'Close', this.onClose),
      ],
      { spacing: 20, crossAlign: 'stretch' },
    );
    const card = new DecoratedBox(new Padding(allInsets(20), content), theme.surface, theme.radius);
    return new Align(new Padding(allInsets(24), card));
  }
}
export function showDialog<T>(
  navigator: NavigatorController,
  builder: (context: BuildContext) => Widget,
  options: Omit<DialogRouteOptions, 'builder'> = {},
): Promise<T | undefined> {
  return navigator.push(createDialogRoute<T>({ ...options, builder }));
}
