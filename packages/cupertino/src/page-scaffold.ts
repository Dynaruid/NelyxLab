// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/page_scaffold.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { Curves } from '@nelyx/core/framework/animation/curves';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { InheritedWidget, StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import {
  ColoredBox,
  Column,
  Expanded,
  DecoratedBox,
  Padding,
  Positioned,
  Stack,
} from '@nelyx/core/framework/widgets/basic';
import { AppTheme, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import type { PreferredSizeWidget } from '@nelyx/core/framework/widgets/preferred-size';
import { withStatusBarScrollTarget } from '@nelyx/core/framework/widgets/primary-scroll-controller';
import { ScrollNotificationObserver } from '@nelyx/core/framework/widgets/scroll-notification-observer';
import { Color } from '@nelyx/core/ui/color';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import { CupertinoNavigationBar } from './nav-bar.ts';
import { CupertinoTheme } from './theme.ts';

export interface ObstructingPreferredSizeWidget extends PreferredSizeWidget {
  shouldFullyObstruct(context: BuildContext): boolean;
}

export interface CupertinoPageScaffoldOptions extends WidgetOptions {
  readonly navigationBar?: ObstructingPreferredSizeWidget | null;
  readonly backgroundColor?: CupertinoColor | null;
  readonly resizeToAvoidBottomInset?: boolean;
  readonly child: Widget;
}

export class CupertinoPageScaffoldBackgroundColor extends InheritedWidget {
  readonly color: Color;

  constructor({
    color,
    child,
    key = null,
  }: WidgetOptions & { readonly color: Color; readonly child: Widget }) {
    super(child, key);
    this.color = color;
  }

  static maybeOf(context: BuildContext): Color | null {
    return context.maybeDependOn(CupertinoPageScaffoldBackgroundColor)?.color ?? null;
  }

  override updateShouldNotify(old: CupertinoPageScaffoldBackgroundColor): boolean {
    return !this.color.equals(old.color);
  }
}

export class CupertinoPageScaffold extends StatelessWidget {
  readonly title: string;
  readonly body: Widget;
  readonly onBack: (() => void) | undefined;
  readonly options: Readonly<CupertinoPageScaffoldOptions> | null;

  constructor(options: CupertinoPageScaffoldOptions);
  constructor(title: string, body: Widget, onBack?: () => void);
  constructor(first: string | CupertinoPageScaffoldOptions, body?: Widget, onBack?: () => void) {
    super(typeof first === 'string' ? null : (first.key ?? null));
    this.title = typeof first === 'string' ? first : '';
    this.body = typeof first === 'string' ? body! : first.child;
    this.onBack = onBack;
    this.options = typeof first === 'string' ? null : Object.freeze({ ...first });
  }

  get child(): Widget {
    return this.body;
  }

  override build(context: BuildContext): Widget {
    if (this.options) {
      const { navigationBar, backgroundColor, resizeToAvoidBottomInset = true } = this.options;
      const theme = CupertinoTheme.of(context);
      const background =
        backgroundColor == null
          ? new Color(theme.scaffoldBackgroundColor)
          : resolveCupertinoColor(backgroundColor, context);
      const data = MediaQuery.of(context);
      const padding = MediaQuery.paddingOf(context);
      const insets = MediaQuery.viewInsetsOf(context);
      const top = navigationBar ? navigationBar.preferredSize.height + padding.top : 0;
      const obstructed = navigationBar?.shouldFullyObstruct(context) ?? false;
      const bottom = resizeToAvoidBottomInset ? insets.bottom : 0;
      const bodyData = obstructed
        ? MediaQuery.removePadding({ context, removeTop: true, child: this.child }).data
        : navigationBar
          ? { ...data, padding: padding.copyWith({ top }) }
          : data;
      const content = new Padding(
        EdgeInsets.only({ top: obstructed ? top : 0, bottom }),
        new MediaQuery(
          resizeToAvoidBottomInset
            ? { ...bodyData, viewInsets: insets.copyWith({ bottom: 0 }), keyboardInset: 0 }
            : bodyData,
          this.child,
        ),
      );
      const page = new ScrollNotificationObserver({
        child: new ColoredBox({
          color: background.toARGB32(),
          child: new CupertinoPageScaffoldBackgroundColor({
            color: background,
            child: new Stack(
              [
                content,
                ...(navigationBar
                  ? [
                      new Positioned(MediaQuery.withNoTextScaling({ child: navigationBar }), {
                        left: 0,
                        right: 0,
                        top: 0,
                        height: top,
                      }),
                    ]
                  : []),
              ],
              { fit: 'expand' },
            ),
          }),
        }),
      });
      return withStatusBarScrollTarget(context, page, 500, Curves.linearToEaseOut);
    }

    const theme = AppTheme.of(context);
    const page = new DecoratedBox(
      new Column([new CupertinoNavigationBar(this.title, this.onBack), new Expanded(this.body)], {
        mainSize: 'max',
        crossAlign: 'stretch',
      }),
      theme.background,
    );
    return withStatusBarScrollTarget(context, page, 500, Curves.linearToEaseOut);
  }
}
