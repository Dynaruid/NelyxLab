// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/desktop_text_selection_toolbar.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
// Flutter: packages/flutter/lib/src/material/desktop_text_selection_toolbar_button.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Padding, Column, SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import { DesktopTextSelectionToolbarLayoutDelegate } from '@nelyx/core/framework/widgets/desktop-text-selection-toolbar-layout-delegate';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { Color } from '@nelyx/core/ui/color';
import { Offset } from '@nelyx/core/ui/offset';
import { Size } from '@nelyx/core/ui/size';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { FontWeight } from '@nelyx/core/ui/typography';
import { kMinInteractiveDimension } from './constants.ts';
import { Material, MaterialType } from './material.ts';
import { TextButton } from './text-button.ts';
import { ContextMenuButtonFocus } from '@nelyx/core/framework/widgets/context-menu-controller';
import { Theme } from './theme.ts';

const screenPadding = 8;
const toolbarWidth = 222;
const buttonPadding = EdgeInsets.fromLTRB(20, 0, 20, 3);
const fontStyle = new TextStyle({
  inherit: false,
  fontSize: 14,
  letterSpacing: -0.15,
  fontWeight: FontWeight.w400,
});
const lightForeground = new Color(0xdd000000);
const darkForeground = new Color(0xffffffff);

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
    const top = MediaQuery.paddingOf(context).top + screenPadding;
    return new Padding(
      {
        left: screenPadding,
        top,
        right: screenPadding,
        bottom: screenPadding,
      },
      new CustomSingleChildLayout(
        new SizedBox(
          toolbarWidth,
          undefined,
          new Material({
            type: MaterialType.card,
            borderRadius: BorderRadius.circular(7),
            clipBehavior: 'antiAlias',
            elevation: 1,
            child: new Column(this.children, { mainSize: 'min' }),
          }),
        ),
        new DesktopTextSelectionToolbarLayoutDelegate({
          anchor: this.anchor.subtract(new Offset(screenPadding, top)),
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
    const color = (
      Theme.of(context).colorScheme.brightness === 'dark' ? darkForeground : lightForeground
    ).toARGB32();
    return new DesktopTextSelectionToolbarButton({
      key,
      onPressed,
      label: text,
      child: new Text(text, {
        style: fontStyle.copyWith({
          color: onPressed === null ? (color & 0x00ffffff) | 0x61000000 : color,
        }),
        overflow: 'ellipsis',
      }),
    });
  }
  build(context: BuildContext): Widget {
    const color =
      Theme.of(context).colorScheme.brightness === 'dark' ? darkForeground : lightForeground;
    return new SizedBox(
      Infinity,
      undefined,
      new ContextMenuButtonFocus(
        new TextButton({
          onPressed: this.onPressed,
          child: this.child,
          ...(this.label ? { semanticsLabel: this.label } : {}),
          style: TextButton.styleFrom({
            alignment: Alignment.centerLeft,
            enabledMouseCursor: SystemMouseCursors.basic,
            disabledMouseCursor: SystemMouseCursors.basic,
            foregroundColor: color,
            shape: new RoundedRectangleBorder(),
            minimumSize: new Size(kMinInteractiveDimension, 36),
            padding: buttonPadding,
          }),
        }),
        this.onPressed,
      ),
    );
  }
}
