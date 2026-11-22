// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter material/text_selection.dart and desktop_text_selection.dart
// at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { TextSelectionControls } from '@nelyx/core/framework/widgets/text-selection';
import type { ClipboardStatus } from '@nelyx/core/framework/widgets/text-selection';
import type { ValueListenable } from '@nelyx/core/foundation/notifier';
import type { TextSelectionPoint } from '@nelyx/core/framework/rendering/editable';
import type { TextSelectionDelegate } from '@nelyx/core/services/text-input';
import { TextSelectionHandleType } from '@nelyx/core/framework/rendering/selection';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { TextSelectionTheme } from './text-selection-theme.ts';
import { SizedBox, Text, Transform } from '@nelyx/core/framework/widgets/basic';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { Size } from '@nelyx/core/ui/size';
import type { Size as CanvasSize } from '@nelyx/core/ui/geometry';
import { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import { Path } from '@nelyx/core/ui/path';
import { Paint } from '@nelyx/core/ui/paint';
import type { Canvas } from '@nelyx/core/ui/canvas';
import { TextSelectionToolbar } from './text-selection-toolbar.ts';
import { TextSelectionToolbarTextButton } from './text-selection-toolbar-text-button.ts';
import {
  DesktopTextSelectionToolbar,
  DesktopTextSelectionToolbarButton,
} from './desktop-text-selection-toolbar.ts';
import { MaterialLocalizations } from './material-localizations.ts';

const handleSize = 22;
const toolbarContentDistance = 8;
const toolbarContentDistanceBelow = handleSize - 2;

function canSelectEntireText(delegate: TextSelectionDelegate): boolean {
  const { text, selection } = delegate.textEditingValue;
  return (
    delegate.selectAllEnabled &&
    text.length > 0 &&
    (selection.start !== 0 || selection.end !== text.length)
  );
}

function selectionLabels(context: BuildContext): Readonly<Record<string, string>> {
  const localizations = MaterialLocalizations.of(context);
  return {
    cut: localizations.cutButtonLabel,
    copy: localizations.copyButtonLabel,
    paste: localizations.pasteButtonLabel,
    selectAll: localizations.selectAllButtonLabel,
  };
}
class MaterialHandlePainter extends CustomPainter {
  constructor(readonly color: number) {
    super();
  }
  paint(canvas: Canvas, size: CanvasSize): void {
    const radius = size.width / 2,
      path = new Path();
    path.addOval(Rect.fromLTWH(0, 0, size.width, size.width));
    path.addRect(Rect.fromLTWH(0, 0, radius, radius));
    canvas.drawPath(path, new Paint({ color: this.color }));
  }
  shouldRepaint(old: CustomPainter): boolean {
    return !(old instanceof MaterialHandlePainter) || old.color !== this.color;
  }
}
export class MaterialTextSelectionHandleControls extends TextSelectionControls {
  override getHandleSize(_textLineHeight: number): Size {
    return new Size(handleSize, handleSize);
  }
  override getHandleAnchor(type: TextSelectionHandleType, _textLineHeight: number): Offset {
    return type === TextSelectionHandleType.collapsed
      ? new Offset(handleSize / 2, -4)
      : type === TextSelectionHandleType.left
        ? new Offset(handleSize, 0)
        : Offset.zero;
  }
  override buildHandle(
    context: BuildContext,
    type: TextSelectionHandleType,
    _textLineHeight: number,
    onTap?: (() => void) | null,
  ): Widget {
    const handle = new SizedBox(
      handleSize,
      handleSize,
      new CustomPaint(
        new GestureDetector(undefined, {
          behavior: HitTestBehavior.translucent,
          ...(onTap ? { onTap } : {}),
        }),
        {
          painter: new MaterialHandlePainter(
            TextSelectionTheme.of(context).selectionHandleColor ??
              Theme.of(context).colorScheme.primary,
          ),
        },
      ),
    );
    return type === TextSelectionHandleType.left
      ? Transform.rotate(handle, Math.PI / 2)
      : type === TextSelectionHandleType.collapsed
        ? Transform.rotate(handle, Math.PI / 4)
        : handle;
  }
}
export const materialTextSelectionHandleControls = new MaterialTextSelectionHandleControls();
/** The source desktop handle mixin intentionally has no visible handles. */
export class DesktopTextSelectionHandleControls extends TextSelectionControls {
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
export const desktopTextSelectionHandleControls = new DesktopTextSelectionHandleControls();

export class MaterialTextSelectionControls extends MaterialTextSelectionHandleControls {
  override canSelectAll(delegate: TextSelectionDelegate): boolean {
    return canSelectEntireText(delegate);
  }

  override buildToolbar(
    context: BuildContext,
    region: Rect,
    textLineHeight: number,
    midpoint: Offset,
    endpoints: readonly TextSelectionPoint[],
    delegate: TextSelectionDelegate,
    clipboard: ValueListenable<ClipboardStatus> | null,
    lastSecondaryTapDown: Offset | null,
  ): Widget {
    const start = endpoints[0];
    const end = endpoints.at(-1);
    if (!start || !end) return SizedBox.shrink();
    const x = region.left + midpoint.dx;
    const anchorAbove =
      lastSecondaryTapDown ??
      new Offset(
        x,
        region.top + Math.max(0, start.point.dy - textLineHeight) - toolbarContentDistance,
      );
    const anchorBelow =
      lastSecondaryTapDown ??
      new Offset(x, region.top + end.point.dy + toolbarContentDistanceBelow);
    return this.buildToolbarItems(context, delegate, clipboard, (context, items) => {
      const labels = selectionLabels(context);
      return new TextSelectionToolbar({
        anchorAbove,
        anchorBelow,
        children: items.map(
          (item, index) =>
            new TextSelectionToolbarTextButton({
              padding: TextSelectionToolbarTextButton.getPadding(index, items.length),
              alignment: AlignmentDirectional.centerStart,
              onPressed: item.onPressed,
              child: new Text(labels[item.type.name] ?? ''),
            }),
        ),
      });
    });
  }
}

export const materialTextSelectionControls = new MaterialTextSelectionControls();

export class DesktopTextSelectionControls extends DesktopTextSelectionHandleControls {
  override canSelectAll(delegate: TextSelectionDelegate): boolean {
    return canSelectEntireText(delegate);
  }

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
      const labels = selectionLabels(context);
      return new DesktopTextSelectionToolbar({
        anchor:
          lastSecondaryTapDown ??
          new Offset(
            Math.max(
              padding.left,
              Math.min(media.width - padding.right, midpoint.dx - region.left),
            ),
            midpoint.dy - region.top,
          ),
        children: items.map((item) =>
          DesktopTextSelectionToolbarButton.text({
            context,
            onPressed: item.onPressed,
            text: labels[item.type.name] ?? '',
          }),
        ),
      });
    });
  }
}

export const desktopTextSelectionControls = new DesktopTextSelectionControls();
