// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter cupertino/text_selection.dart and desktop_text_selection.dart
// at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { TextSelectionControls } from '@nelyx/core/framework/widgets/text-selection';
import type { ClipboardStatus } from '@nelyx/core/framework/widgets/text-selection';
import type { ValueListenable } from '@nelyx/core/foundation/notifier';
import type { TextSelectionPoint } from '@nelyx/core/framework/rendering/editable';
import type { TextSelectionDelegate } from '@nelyx/core/services/text-input';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { TextSelectionHandleType } from '@nelyx/core/framework/rendering/selection';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { CupertinoTheme } from './theme.ts';
import { SizedBox, Transform } from '@nelyx/core/framework/widgets/basic';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { Size } from '@nelyx/core/ui/size';
import type { Size as CanvasSize } from '@nelyx/core/ui/geometry';
import { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import { Path } from '@nelyx/core/ui/path';
import { Paint } from '@nelyx/core/ui/paint';
import type { Canvas } from '@nelyx/core/ui/canvas';
import { CupertinoTextSelectionToolbar } from './text-selection-toolbar.ts';
import { CupertinoDesktopTextSelectionToolbar } from './desktop-text-selection-toolbar.ts';
import {
  CupertinoTextSelectionToolbarButton,
  CupertinoDesktopTextSelectionToolbarButton,
} from './text-selection-toolbar-button.ts';
import type { ContextMenuButtonItem } from '@nelyx/core/framework/widgets/context-menu-button-item';

const arrowScreenPadding = 26;

function separatedButtons(
  context: BuildContext,
  items: readonly ContextMenuButtonItem[],
  buildButton: (item: ContextMenuButtonItem) => Widget,
): readonly Widget[] {
  const divider = new SizedBox(1 / MediaQuery.of(context).scale);
  return items.flatMap((item, index) =>
    index === 0 ? [buildButton(item)] : [divider, buildButton(item)],
  );
}
class CupertinoHandlePainter extends CustomPainter {
  constructor(readonly color: number) {
    super();
  }
  paint(canvas: Canvas, size: CanvasSize): void {
    const path = new Path();
    path.addOval(Rect.fromLTWH(0, 0, 12, 12));
    path.addRect(Rect.fromLTWH(5, 10.5, 2, size.height - 10.5));
    canvas.drawPath(path, new Paint({ color: this.color }));
  }
  shouldRepaint(old: CustomPainter): boolean {
    return !(old instanceof CupertinoHandlePainter) || old.color !== this.color;
  }
}
export class CupertinoTextSelectionHandleControls extends TextSelectionControls {
  override getHandleSize(textLineHeight: number): Size {
    return new Size(12, textLineHeight + 10.5);
  }
  override getHandleAnchor(type: TextSelectionHandleType, textLineHeight: number): Offset {
    const size = this.getHandleSize(textLineHeight);
    return new Offset(
      size.width / 2,
      type === TextSelectionHandleType.left
        ? size.height
        : type === TextSelectionHandleType.right
          ? textLineHeight
          : textLineHeight + (size.height - textLineHeight) / 2,
    );
  }
  override buildHandle(
    context: BuildContext,
    type: TextSelectionHandleType,
    textLineHeight: number,
    _onTap?: (() => void) | null,
  ): Widget {
    const size = this.getHandleSize(textLineHeight);
    if (type === TextSelectionHandleType.collapsed) return new SizedBox(size.width, size.height);
    const handle = new SizedBox(
      size.width,
      size.height,
      new CustomPaint(undefined, {
        painter: new CupertinoHandlePainter(CupertinoTheme.of(context).selectionHandleColor),
      }),
    );
    return type === TextSelectionHandleType.right ? Transform.rotate(handle, Math.PI) : handle;
  }
}
export const cupertinoTextSelectionHandleControls = new CupertinoTextSelectionHandleControls();
/** The source desktop handle mixin intentionally has no visible handles. */
export class CupertinoDesktopTextSelectionHandleControls extends TextSelectionControls {
  override getHandleSize(_height: number): Size {
    return Size.zero;
  }
  override getHandleAnchor(_type: TextSelectionHandleType, _height: number): Offset {
    return Offset.zero;
  }
  override buildHandle(): Widget {
    return SizedBox.shrink();
  }
}
export const cupertinoDesktopTextSelectionHandleControls =
  new CupertinoDesktopTextSelectionHandleControls();

export class CupertinoTextSelectionControls extends CupertinoTextSelectionHandleControls {
  override buildToolbar(
    context: BuildContext,
    region: Rect,
    textLineHeight: number,
    midpoint: Offset,
    endpoints: readonly TextSelectionPoint[],
    delegate: TextSelectionDelegate,
    clipboard: ValueListenable<ClipboardStatus> | null,
    _lastSecondaryTapDown: Offset | null,
  ): Widget {
    const start = endpoints[0];
    const end = endpoints.at(-1);
    if (!start || !end) return SizedBox.shrink();
    return this.buildToolbarItems(context, delegate, clipboard, (context, items) => {
      const media = MediaQuery.of(context);
      const padding = MediaQuery.paddingOf(context);
      const x = Math.max(
        arrowScreenPadding + padding.left,
        Math.min(media.width - padding.right - arrowScreenPadding, midpoint.dx + region.left),
      );
      return new CupertinoTextSelectionToolbar({
        anchorAbove: new Offset(x, region.top + Math.max(0, start.point.dy - textLineHeight)),
        anchorBelow: new Offset(x, region.top + end.point.dy),
        children: separatedButtons(context, items, (buttonItem) =>
          CupertinoTextSelectionToolbarButton.buttonItem({ buttonItem }),
        ),
      });
    });
  }
}

export const cupertinoTextSelectionControls = new CupertinoTextSelectionControls();

export class CupertinoDesktopTextSelectionControls extends CupertinoDesktopTextSelectionHandleControls {
  override buildToolbar(
    context: BuildContext,
    region: Rect,
    _textLineHeight: number,
    midpoint: Offset,
    _endpoints: readonly TextSelectionPoint[],
    delegate: TextSelectionDelegate,
    clipboard: ValueListenable<ClipboardStatus> | null,
    lastSecondaryTapDown: Offset | null,
  ): Widget {
    return this.buildToolbarItems(context, delegate, clipboard, (context, items) => {
      const media = MediaQuery.of(context);
      const padding = MediaQuery.paddingOf(context);
      return new CupertinoDesktopTextSelectionToolbar({
        anchor:
          lastSecondaryTapDown ??
          new Offset(
            Math.max(
              padding.left,
              Math.min(media.width - padding.right, midpoint.dx - region.left),
            ),
            midpoint.dy - region.top,
          ),
        children: separatedButtons(context, items, (buttonItem) =>
          CupertinoDesktopTextSelectionToolbarButton.buttonItem({ buttonItem }),
        ),
      });
    });
  }
}

export const cupertinoDesktopTextSelectionControls = new CupertinoDesktopTextSelectionControls();
