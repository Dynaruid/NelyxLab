// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/text_selection_toolbar_button.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
// Flutter: packages/flutter/lib/src/cupertino/desktop_text_selection_toolbar_button.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { Text, SizedBox } from '@nelyx/core/framework/widgets/basic';
import type { ContextMenuButtonItem } from '@nelyx/core/framework/widgets/context-menu-button-item';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import type { Canvas } from '@nelyx/core/ui/canvas';
import { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { Offset } from '@nelyx/core/ui/offset';
import { Path } from '@nelyx/core/ui/path';
import { Paint } from '@nelyx/core/ui/paint';
import { FontWeight } from '@nelyx/core/ui/typography';
import { CupertinoButton } from './button.ts';
import { CupertinoColors, CupertinoDynamicColor } from './colors.ts';
import { CupertinoLocalizations } from './cupertino-localizations.ts';
import { CupertinoTheme } from './theme.ts';

const mobileStyle = new TextStyle({
  inherit: false,
  fontSize: 15,
  letterSpacing: -0.15,
  fontWeight: FontWeight.w400,
});
const desktopStyle = mobileStyle.copyWith({ fontSize: 14 });
const mobilePadding = EdgeInsets.symmetric({ vertical: 18, horizontal: 16 });
const desktopPadding = EdgeInsets.fromLTRB(8, 2, 8, 5);
const toolbarTextColor = CupertinoDynamicColor.withBrightness({
  color: CupertinoColors.black,
  darkColor: CupertinoColors.white,
});
const toolbarPressedColor = CupertinoDynamicColor.withBrightness({
  color: new Color(0x10000000),
  darkColor: new Color(0x10ffffff),
});

export interface CupertinoTextSelectionToolbarButtonOptions extends WidgetOptions {
  readonly child?: Widget | null;
  readonly onPressed?: (() => void) | null;
  readonly text?: string | null;
  readonly buttonItem?: ContextMenuButtonItem | null;
}
export class CupertinoTextSelectionToolbarButton extends StatefulWidget {
  readonly child: Widget | null;
  readonly onPressed: (() => void) | null;
  readonly text: string | null;
  readonly buttonItem: ContextMenuButtonItem | null;
  constructor({
    key = null,
    child = null,
    onPressed = null,
    text = null,
    buttonItem = null,
  }: CupertinoTextSelectionToolbarButtonOptions) {
    super(key);
    this.child = child;
    this.onPressed = buttonItem?.onPressed ?? onPressed;
    this.text = text;
    this.buttonItem = buttonItem;
  }
  static text(
    options: {
      readonly text: string;
      readonly onPressed?: (() => void) | null;
    } & WidgetOptions,
  ): CupertinoTextSelectionToolbarButton {
    return new CupertinoTextSelectionToolbarButton(options);
  }
  static buttonItem(
    options: {
      readonly buttonItem: ContextMenuButtonItem;
    } & WidgetOptions,
  ): CupertinoTextSelectionToolbarButton {
    return new CupertinoTextSelectionToolbarButton(options);
  }
  static getButtonLabel(context: BuildContext, item: ContextMenuButtonItem): string {
    if (item.label !== null) return item.label;
    const l = CupertinoLocalizations.of(context);
    switch (item.type.name) {
      case 'cut':
        return l.cutButtonLabel;
      case 'copy':
        return l.copyButtonLabel;
      case 'paste':
        return l.pasteButtonLabel;
      case 'selectAll':
        return l.selectAllButtonLabel;
      case 'lookUp':
        return l.lookUpButtonLabel;
      case 'searchWeb':
        return l.searchWebButtonLabel;
      case 'share':
        return l.shareButtonLabel;
      default:
        return '';
    }
  }
  createState(): State<CupertinoTextSelectionToolbarButton> {
    return new CupertinoToolbarButtonState();
  }
}
class CupertinoToolbarButtonState extends State<CupertinoTextSelectionToolbarButton> {
  private pressed = false;

  override didUpdateWidget(old: CupertinoTextSelectionToolbarButton): void {
    super.didUpdateWidget(old);
    if (this.widget.onPressed === null) this.pressed = false;
  }

  override deactivate(): void {
    this.pressed = false;
    super.deactivate();
  }

  build(context: BuildContext): Widget {
    const { text, buttonItem, onPressed, child } = this.widget;
    const label =
      text ??
      (buttonItem ? CupertinoTextSelectionToolbarButton.getButtonLabel(context, buttonItem) : '');
    const resolvedColor = toolbarTextColor.resolveFrom(context).toARGB32();
    const content =
      child ??
      (buttonItem?.type.name === 'liveTextInput'
        ? new SizedBox(
            13,
            13,
            new CustomPaint(undefined, {
              painter: new LiveTextIconPainter(resolvedColor),
            }),
          )
        : new Text(label, {
            style: mobileStyle.copyWith({
              color: onPressed
                ? resolvedColor
                : CupertinoColors.inactiveGray.resolveFrom(context).toARGB32(),
            }),
            overflow: 'ellipsis',
          }));
    return new CupertinoButton({
      child: content,
      onPressed,
      onHighlightChanged: (pressed) => {
        if (this.mounted && this.widget.onPressed && this.pressed !== pressed)
          this.setState(() => {
            this.pressed = pressed;
          });
      },
      ...(label ? { semanticsLabel: label } : {}),
      color: this.pressed ? toolbarPressedColor : CupertinoColors.transparent,
      disabledColor: CupertinoColors.transparent,
      padding: mobilePadding,
      pressedOpacity: 1,
    });
  }
}
class LiveTextIconPainter extends CustomPainter {
  constructor(readonly color: number) {
    super();
  }
  paint(canvas: Canvas, size: Size): void {
    const paint = new Paint({
        color: this.color,
        strokeCap: 'round',
        strokeJoin: 'round',
        strokeWidth: 1,
        style: 'stroke',
      }),
      x = -size.width / 2,
      y = -size.height / 2,
      path = new Path();
    path.moveTo(x, y + 3.5);
    path.lineTo(x, y + 1);
    path.conicTo(x, y, x + 1, y, Math.SQRT1_2);
    path.lineTo(x + 3.5, y);
    canvas.save();
    try {
      canvas.translate(size.width / 2, size.height / 2);
      for (let i = 0; i < 4; i++) {
        canvas.drawPath(path, paint);
        canvas.transform([0, 1, -1, 0, 0, 0]);
      }
      for (const [y, end] of [
        [-3, 3],
        [0, 3],
        [3, 1],
      ])
        canvas.drawLine(new Offset(-3, y!), new Offset(end!, y!), paint);
    } finally {
      canvas.restore();
    }
  }
  shouldRepaint(old: CustomPainter): boolean {
    return !(old instanceof LiveTextIconPainter) || old.color !== this.color;
  }
}
export class CupertinoDesktopTextSelectionToolbarButton extends CupertinoTextSelectionToolbarButton {
  static override text(
    options: {
      readonly text: string;
      readonly onPressed?: (() => void) | null;
    } & WidgetOptions,
  ): CupertinoDesktopTextSelectionToolbarButton {
    return new CupertinoDesktopTextSelectionToolbarButton(options);
  }
  static override buttonItem(
    options: {
      readonly buttonItem: ContextMenuButtonItem;
    } & WidgetOptions,
  ): CupertinoDesktopTextSelectionToolbarButton {
    return new CupertinoDesktopTextSelectionToolbarButton(options);
  }
  override createState(): State<CupertinoDesktopTextSelectionToolbarButton> {
    return new DesktopButtonState();
  }
}
class DesktopButtonState extends State<CupertinoDesktopTextSelectionToolbarButton> {
  private hovered = false;

  build(context: BuildContext): Widget {
    const theme = CupertinoTheme.of(context);
    const { text, buttonItem, onPressed, child } = this.widget;
    const label =
      text ??
      (buttonItem ? CupertinoTextSelectionToolbarButton.getButtonLabel(context, buttonItem) : '');
    const foreground = this.hovered
      ? theme.primaryContrastingColor
      : toolbarTextColor.resolveFrom(context).toARGB32();
    const content =
      child ??
      new Text(label, {
        style: desktopStyle.copyWith({ color: foreground }),
        overflow: 'ellipsis',
      });
    return new SizedBox(
      Infinity,
      undefined,
      new MouseRegion(
        new CupertinoButton({
          child: content,
          onPressed,
          ...(label ? { semanticsLabel: label } : {}),
          ...(this.hovered ? { color: theme.primaryColor } : {}),
          alignment: Alignment.centerLeft,
          borderRadius: 4,
          minSize: 0,
          padding: desktopPadding,
          pressedOpacity: 0.7,
        }),
        {
          onEnter: () =>
            this.setState(() => {
              this.hovered = true;
            }),
          onExit: () =>
            this.setState(() => {
              this.hovered = false;
            }),
        },
      ),
    );
  }
}
