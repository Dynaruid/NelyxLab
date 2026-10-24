// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional port of radio.dart _RadioPainter and ToggleablePainter radial reaction.
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import type { Canvas } from '@nelyx/core/ui/canvas';
import { Paint } from '@nelyx/core/ui/paint';
import { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import type { Size } from '@nelyx/core/ui/geometry';
import type { Color } from '@nelyx/core/ui/color';
import { sourceColorLerp } from '@nelyx/core/ui/color-source';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { CircleBorder } from '@nelyx/core/framework/painting/circle-border';
import type { ToggleableMotion } from '@nelyx/core/framework/widgets/toggleable-control';

export interface RadioPaintValues {
    readonly activeColor: Color;
    readonly inactiveColor: Color;
    readonly activeBackgroundColor: Color;
    readonly inactiveBackgroundColor: Color;
    readonly activeSide: BorderSide;
    readonly inactiveSide: BorderSide;
    readonly activeReactionColor: Color;
    readonly inactiveReactionColor: Color;
    readonly hoverColor: Color;
    readonly focusColor: Color;
    readonly splashRadius: number;
    readonly innerRadius: number;
}
export interface RadioPainterOptions extends RadioPaintValues, ToggleableMotion {
    readonly position: number;
    readonly isFocused: boolean;
    readonly isHovered: boolean;
}
export class RadioPainter extends CustomPainter {
    constructor(readonly options: RadioPainterOptions) { super(); }
    paint(canvas: Canvas, size: Size): void {
        const o = this.options, center = new Offset(size.width / 2, size.height / 2);
        if (o.reaction !== 0 || o.reactionFocusFade !== 0 || o.reactionHoverFade !== 0) {
            const color = sourceColorLerp(sourceColorLerp(sourceColorLerp(o.inactiveReactionColor, o.activeReactionColor, o.position), o.hoverColor, o.reactionHoverFade), o.focusColor, o.reactionFocusFade)!;
            const radius = o.isFocused || o.isHovered ? o.splashRadius : o.splashRadius * o.reaction;
            if (radius > 0) canvas.drawCircle(center, radius, new Paint({ color: color.toARGB32() }));
        }
        canvas.drawCircle(center, 8, new Paint({ color: sourceColorLerp(o.inactiveBackgroundColor, o.activeBackgroundColor, o.position)!.toARGB32() }));
        new CircleBorder({ side: BorderSide.lerp(o.inactiveSide, o.activeSide, o.position) }).paint(canvas, Rect.fromCircle({ center, radius: 8 }));
        if (o.position > 0) canvas.drawCircle(center, o.innerRadius * o.position, new Paint({ color: sourceColorLerp(o.inactiveColor, o.activeColor, o.position)!.toARGB32() }));
    }
    shouldRepaint(_old: RadioPainter): boolean { return true; }
}
