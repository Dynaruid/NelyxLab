// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Column, Expanded, DecoratedBox } from '@nelyx/core/framework/widgets/basic';
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';
import { CupertinoNavigationBar } from './nav-bar.ts';
export class CupertinoPageScaffold extends StatelessWidget {
    constructor(readonly title: string, readonly body: Widget, readonly onBack?: () => void) {
        super();
    }
    build(context: BuildContext): Widget {
        const theme = AppTheme.of(context);
        return new DecoratedBox(new Column([new CupertinoNavigationBar(this.title, this.onBack), new Expanded(this.body)], { mainSize: 'max', crossAlign: 'stretch' }), theme.background);
    }
}
