// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/drawer_header.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { Curves } from '@nelyx/core/framework/animation/curves';
import type { Curve } from '@nelyx/core/framework/animation/curves';
import { Border } from '@nelyx/core/framework/painting/box-border';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import type { Decoration } from '@nelyx/core/framework/painting/decoration';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Container } from '@nelyx/core/framework/widgets/container';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { AnimatedContainer } from '@nelyx/core/framework/widgets/implicit-animations';
import { Divider } from './divider.ts';
import { debugCheckHasMaterial } from './debug.ts';
import { Durations } from './motion.ts';
import { Theme } from './theme.ts';

const drawerHeaderHeight = 161;
const defaultMargin = EdgeInsets.only({ bottom: 8 });
const defaultPadding = EdgeInsets.fromLTRB(16, 16, 16, 8);

export interface DrawerHeaderOptions extends WidgetOptions {
  readonly child: Widget | null;
  readonly decoration?: Decoration | null;
  readonly margin?: EdgeInsetsGeometry | null;
  readonly padding?: EdgeInsetsGeometry;
  readonly duration?: number;
  readonly curve?: Curve;
}

export class DrawerHeader extends StatelessWidget {
  readonly options: Readonly<DrawerHeaderOptions>;

  constructor(options: DrawerHeaderOptions) {
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
  }

  override build(context: BuildContext): Widget {
    debugCheckHasMaterial(context);
    const {
      child,
      curve = Curves.fastOutSlowIn,
      decoration = null,
      duration = Durations.medium1,
      margin = defaultMargin,
      padding = defaultPadding,
    } = this.options;
    const statusBarHeight = MediaQuery.paddingOf(context).top;
    const style = Theme.of(context).textTheme.bodyLarge!;
    return new Container({
      height: statusBarHeight + drawerHeaderHeight,
      margin,
      decoration: new BoxDecoration({
        border: new Border({ bottom: Divider.createBorderSide(context) }),
      }),
      child: new AnimatedContainer({
        curve,
        duration,
        decoration,
        padding: padding.add(EdgeInsets.only({ top: statusBarHeight })),
        child: child
          ? new DefaultTextStyle(
              style,
              MediaQuery.removePadding({ context, child, removeTop: true }),
            )
          : null,
      }),
    });
  }
}
