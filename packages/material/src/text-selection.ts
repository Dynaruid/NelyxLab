// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned material/text_selection.dart handle geometry and painting, with
// source selection theme colors. Menus are built by contextMenuBuilder.
import { TextSelectionControls } from '@nelyx/core/framework/widgets/text-selection';
import { TextSelectionHandleType } from '@nelyx/core/framework/rendering/selection';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Theme } from './theme.ts';
import { TextSelectionTheme } from './text-selection-theme.ts';
import { SizedBox, Transform } from '@nelyx/core/framework/widgets/basic';
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
class MaterialHandlePainter extends CustomPainter {
    constructor(readonly color: number) {
        super();
    }
    paint(canvas: Canvas, size: CanvasSize): void {
        const radius = size.width / 2, path = new Path();
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
        return new Size(22, 22);
    }
    override getHandleAnchor(type: TextSelectionHandleType, _textLineHeight: number): Offset {
        return type === TextSelectionHandleType.collapsed ? new Offset(11, -4) : type === TextSelectionHandleType.left ? new Offset(22, 0) : Offset.zero;
    }
    override buildHandle(context: BuildContext, type: TextSelectionHandleType, _textLineHeight: number, onTap?: (() => void) | null): Widget {
        const handle = new SizedBox(22, 22, new CustomPaint(new GestureDetector(undefined, { behavior: HitTestBehavior.translucent, ...(onTap ? { onTap } : {}) }), { painter: new MaterialHandlePainter(TextSelectionTheme.of(context).selectionHandleColor ?? Theme.of(context).colorScheme.primary) }));
        return type === TextSelectionHandleType.left ? Transform.rotate(handle, Math.PI / 2) : type === TextSelectionHandleType.collapsed ? Transform.rotate(handle, Math.PI / 4) : handle;
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
