// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned cupertino/text_selection.dart handle geometry and painting. Nelyx's
// Source CupertinoTheme supplies the independently configurable handle color.
import { TextSelectionControls } from '@nelyx/core/framework/widgets/text-selection';
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
        return new Offset(size.width / 2, type === TextSelectionHandleType.left ? size.height : type === TextSelectionHandleType.right ? textLineHeight : textLineHeight + (size.height - textLineHeight) / 2);
    }
    override buildHandle(context: BuildContext, type: TextSelectionHandleType, textLineHeight: number, _onTap?: (() => void) | null): Widget {
        const size = this.getHandleSize(textLineHeight);
        if (type === TextSelectionHandleType.collapsed)
            return new SizedBox(size.width, size.height);
        const handle = new SizedBox(size.width, size.height, new CustomPaint(undefined, { painter: new CupertinoHandlePainter(CupertinoTheme.of(context).selectionHandleColor) }));
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
export const cupertinoDesktopTextSelectionHandleControls = new CupertinoDesktopTextSelectionHandleControls();
