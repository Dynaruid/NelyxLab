// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/expansion_tile.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { CurveTween, Tween } from '@nelyx/core/framework/animation/tween';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { Center, ConstrainedBox, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { Expansible, ExpansibleController } from '@nelyx/core/framework/widgets/expansible';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { FadeTransition, RotationTransition } from '@nelyx/core/framework/widgets/transitions';
import { FontWeight } from '@nelyx/core/ui/typography';
import { CupertinoColors } from './colors.ts';
import { CupertinoLocalizations } from './cupertino-localizations.ts';
import { CupertinoIcons } from './icons.ts';
import { CupertinoListTile } from './list-tile.ts';
import { CupertinoTheme } from './theme.ts';

export { ExpansibleController };

const animationCurve = Curves.easeInOut;
const animationDuration = 250;
const iconFontSize = 15;
const headerHeight = 44;
const quarterTurn = new Tween({ begin: 0, end: 0.25 }).chain(
  new CurveTween({ curve: animationCurve }),
);

export enum ExpansionTileTransitionMode {
  fade = 'fade',
  scroll = 'scroll',
}

export interface CupertinoExpansionTileOptions extends WidgetOptions {
  readonly title: Widget;
  readonly child: Widget;
  readonly controller?: ExpansibleController | null;
  readonly transitionMode?: ExpansionTileTransitionMode;
}

export class CupertinoExpansionTile extends StatefulWidget {
  readonly title: Widget;
  readonly child: Widget;
  readonly controller: ExpansibleController | null;
  readonly transitionMode: ExpansionTileTransitionMode;

  constructor({
    title,
    child,
    controller = null,
    transitionMode = ExpansionTileTransitionMode.fade,
    key = null,
  }: CupertinoExpansionTileOptions) {
    super(key);
    this.title = title;
    this.child = child;
    this.controller = controller;
    this.transitionMode = transitionMode;
  }
  override createState(): State<CupertinoExpansionTile> {
    return new CupertinoExpansionTileState();
  }
}

class CupertinoExpansionTileState extends State<CupertinoExpansionTile> {
  private localController: ExpansibleController | null = null;
  private get controller(): ExpansibleController {
    return this.widget.controller ?? (this.localController ??= new ExpansibleController());
  }
  override didUpdateWidget(old: CupertinoExpansionTile): void {
    super.didUpdateWidget(old);
    if (this.widget.controller && old.controller === null) {
      this.localController?.dispose();
      this.localController = null;
    }
  }

  private readonly header = (context: BuildContext, animation: Animation<number>): Widget => {
    const expanded = this.controller.isExpanded;
    const strings = CupertinoLocalizations.of(context);
    const apple =
      FoundationPlatform.defaultTargetPlatform === 'iOS' ||
      FoundationPlatform.defaultTargetPlatform === 'macOS';
    const size = CupertinoTheme.of(context).textTheme.textStyle.fontSize ?? 17;
    const icon = new RotationTransition({
      turns: animation.drive(quarterTurn),
      child: new SizedBox(
        size,
        size,
        new Center(
          new Icon(CupertinoIcons.right_chevron, {
            color: CupertinoColors.activeBlue,
            size: iconFontSize,
            fontWeight: FontWeight.w900,
          }),
        ),
      ),
    });
    return new Semantics({
      expanded,
      hint: apple
        ? expanded
          ? strings.collapsedHint + '\n ' + strings.expansionTileExpandedHint
          : strings.expandedHint + '\n ' + strings.expansionTileCollapsedHint
        : null,
      onTapHint: expanded
        ? strings.expansionTileExpandedTapHint
        : strings.expansionTileCollapsedTapHint,
      child: new ConstrainedBox(
        new CupertinoListTile({
          title: this.widget.title,
          trailing: icon,
          onTap: () => this.controller.toggle(),
          backgroundColorActivated: CupertinoColors.transparent,
        }),
        new BoxConstraints(0, Infinity, headerHeight),
      ),
    });
  };

  override build(): Widget {
    const fade = this.widget.transitionMode === ExpansionTileTransitionMode.fade;
    return new Expansible({
      controller: this.controller,
      duration: animationDuration,
      curve: animationCurve,
      headerBuilder: this.header,
      bodyClipBehavior: fade ? 'none' : 'hardEdge',
      bodyBuilder: (_context, animation) =>
        fade
          ? new FadeTransition({
              opacity: animation,
              child: this.widget.child,
            })
          : this.widget.child,
    });
  }

  override dispose(): void {
    this.localController?.dispose();
    super.dispose();
  }
}
