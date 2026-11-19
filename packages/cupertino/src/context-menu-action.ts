// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/context_menu_action.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import {
  ColoredBox,
  ConstrainedBox,
  Flexible,
  Padding,
  Row,
} from '@nelyx/core/framework/widgets/basic';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import type { IconData } from '@nelyx/core/framework/widgets/icon-data';
import { Color } from '@nelyx/core/ui/color';
import { FontWeight } from '@nelyx/core/ui/typography';
import { CupertinoColors, CupertinoDynamicColor } from './colors.ts';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import { contextMenuBackground } from './internal/context-menu-style.ts';

const pressedBackground = CupertinoDynamicColor.withBrightness({
  color: new Color(0xffdddddd),
  darkColor: new Color(0xff3f3f40),
});
const actionPadding = EdgeInsets.fromLTRB(15.5, 8, 17.5, 8);
const actionConstraints = new BoxConstraints(0, Infinity, 43);
const destructiveRed = new Color(0xffff3b30);
const defaultStyle = new TextStyle({
  inherit: false,
  fontFamily: 'CupertinoSystemText',
  fontSize: 16,
  fontWeight: FontWeight.w400,
  textBaseline: 'alphabetic',
});

export interface CupertinoContextMenuActionOptions extends WidgetOptions {
  readonly child: Widget;
  readonly isDefaultAction?: boolean;
  readonly isDestructiveAction?: boolean;
  readonly onPressed?: (() => void) | null;
  readonly trailingIcon?: IconData | null;
}

export class CupertinoContextMenuAction extends StatelessWidget {
  readonly child: Widget;
  readonly isDefaultAction: boolean;
  readonly isDestructiveAction: boolean;
  readonly onPressed: (() => void) | null;
  readonly trailingIcon: IconData | null;

  constructor({
    child,
    isDefaultAction = false,
    isDestructiveAction = false,
    onPressed = null,
    trailingIcon = null,
    key = null,
  }: CupertinoContextMenuActionOptions) {
    super(key);
    this.child = child;
    this.isDefaultAction = isDefaultAction;
    this.isDestructiveAction = isDestructiveAction;
    this.onPressed = onPressed;
    this.trailingIcon = trailingIcon;
  }

  override build(context: BuildContext): Widget {
    const foreground =
      !this.isDefaultAction && this.isDestructiveAction
        ? destructiveRed
        : resolveCupertinoColor(CupertinoColors.label, context);
    const style = defaultStyle.copyWith({
      color: foreground.toARGB32(),
      fontWeight: this.isDefaultAction ? FontWeight.w600 : FontWeight.w400,
    });
    const background = resolveCupertinoColor(contextMenuBackground, context);
    const pressed = resolveCupertinoColor(pressedBackground, context);
    const trailing = this.trailingIcon
      ? new Icon(this.trailingIcon, { color: foreground, size: 21 })
      : null;
    const contents = new Padding(
      actionPadding,
      new DefaultTextStyle(
        style,
        new Row([new Flexible(this.child), ...(trailing ? [trailing] : [])], {
          mainAxisAlignment: 'spaceBetween',
        }),
      ),
    );
    return new ControlInteraction(
      (_context, state) =>
        new ConstrainedBox(
          new ColoredBox({
            color: (state.pressed ? pressed : background).toARGB32(),
            child: contents,
          }),
          actionConstraints,
        ),
      { onPressed: this.onPressed, semantics: { button: true } },
    );
  }
}
