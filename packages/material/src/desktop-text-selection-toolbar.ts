// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import {
  Padding,
  Column,
  SizedBox,
  PhysicalModel,
  ConstrainedBox,
  Text,
  Align,
} from '@nelyx/core/framework/widgets/basic';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import { DesktopTextSelectionToolbarLayoutDelegate } from '@nelyx/core/framework/widgets/desktop-text-selection-toolbar-layout-delegate';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { Offset } from '@nelyx/core/ui/offset';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { Theme } from './theme.ts';
export class DesktopTextSelectionToolbar extends StatelessWidget {
  readonly anchor: Offset;
  readonly children: readonly Widget[];
  constructor({
    key = null,
    anchor,
    children,
  }: {
    readonly anchor: Offset;
    readonly children: readonly Widget[];
  } & WidgetOptions) {
    super(key);
    if (!children.length) throw new Error('DesktopTextSelectionToolbar requires children');
    this.anchor = anchor;
    this.children = Object.freeze([...children]);
  }
  build(context: BuildContext): Widget {
    const top = MediaQuery.of(context).safeArea.top + 8;
    return new Padding(
      {
        left: 8,
        top,
        right: 8,
        bottom: 8,
      },
      new CustomSingleChildLayout(
        new SizedBox(
          222,
          undefined,
          new PhysicalModel({
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(7),
            clipBehavior: 'antiAlias',
            elevation: 1,
            child: new Column(this.children, { mainSize: 'min', crossAlign: 'stretch' }),
          }),
        ),
        new DesktopTextSelectionToolbarLayoutDelegate({
          anchor: this.anchor.subtract(new Offset(8, top)),
        }),
      ),
    );
  }
}
export class DesktopTextSelectionToolbarButton extends StatelessWidget {
  readonly onPressed: (() => void) | null;
  readonly child: Widget;
  readonly label: string;
  constructor({
    key = null,
    onPressed,
    child,
    label = '',
  }: {
    readonly onPressed: (() => void) | null;
    readonly child: Widget;
    readonly label?: string;
  } & WidgetOptions) {
    super(key);
    this.onPressed = onPressed;
    this.child = child;
    this.label = label;
  }
  static text({
    context,
    onPressed,
    text,
    key = null,
  }: {
    readonly context: BuildContext;
    readonly onPressed: (() => void) | null;
    readonly text: string;
  } & WidgetOptions): DesktopTextSelectionToolbarButton {
    return new DesktopTextSelectionToolbarButton({
      key,
      onPressed,
      label: text,
      child: new Text(text, {
        fontSize: 14,
        style: new TextStyle({ letterSpacing: -0.15 }),
        color: Theme.of(context).brightness === 'dark' ? 0xffffffff : 0xdd000000,
        overflow: 'ellipsis',
      }),
    });
  }
  build(_context: BuildContext): Widget {
    const body = new GestureDetector(
      new SizedBox(
        Infinity,
        undefined,
        new ConstrainedBox(
          new Padding(
            {
              left: 20,
              top: 0,
              right: 20,
              bottom: 3,
            },
            new Align(this.child, { alignment: { x: -1, y: 0 }, heightFactor: 1 }),
          ),
          new BoxConstraints(48, Infinity, 36),
        ),
      ),
      {
        ...(this.onPressed ? { onTap: this.onPressed } : {}),
        excludeFromSemantics: true,
        behavior: HitTestBehavior.opaque,
      },
    );
    return new Semantics({
      button: true,
      label: this.label,
      enabled: this.onPressed !== null,
      onTap: this.onPressed,
      excludeSemantics: true,
      child: body,
    });
  }
}
