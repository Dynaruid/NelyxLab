// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { allInsets } from '@nelyx/core/ui/geometry';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Row, Expanded, Padding, Text, DecoratedBox, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';
import { CupertinoButton } from './button.ts';
export class CupertinoNavigationBar extends StatelessWidget {
    constructor(readonly title: string, readonly onBack?: () => void) {
        super();
    }
    build(context: BuildContext): Widget {
        const theme = AppTheme.of(context);
        return new DecoratedBox(new Padding(allInsets(12), new Row([...(this.onBack ? [new SizedBox(80, undefined, new CupertinoButton('cupertino-back', 'Back', this.onBack))] : []), new Expanded(new Text(this.title, { fontSize: 22, color: theme.foreground }))], { spacing: 12, crossAlign: 'center' })), theme.surface);
    }
}
