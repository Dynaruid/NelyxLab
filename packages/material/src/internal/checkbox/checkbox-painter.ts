// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional port of _CheckboxPainter and ToggleablePainter.paintRadialReaction.
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import type { Canvas } from '@nelyx/core/ui/canvas';
import { Paint } from '@nelyx/core/ui/paint';
import { Path } from '@nelyx/core/ui/path';
import { Rect } from '@nelyx/core/ui/rect';
import { Offset } from '@nelyx/core/ui/offset';
import type { Size } from '@nelyx/core/ui/geometry';
import { Color } from '@nelyx/core/ui/color';
import { sourceColorLerp } from '@nelyx/core/ui/color-source';
import { BorderSide, OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import type { ToggleableMotion } from '@nelyx/core/framework/widgets/toggleable-control';
export interface CheckboxPaintValues {
    readonly activeColor: Color;
    readonly inactiveColor: Color;
    readonly checkColor: Color;
    readonly activeSide: BorderSide;
    readonly inactiveSide: BorderSide;
    readonly shape: OutlinedBorder;
    readonly activeReactionColor: Color;
    readonly inactiveReactionColor: Color;
    readonly hoverColor: Color;
    readonly focusColor: Color;
    readonly splashRadius: number;
}
export interface CheckboxPainterOptions extends CheckboxPaintValues, ToggleableMotion {
    readonly value: boolean | null;
    readonly position: number;
    readonly isFocused: boolean;
    readonly isHovered: boolean;
}
export class CheckboxPainter extends CustomPainter {
    constructor(readonly options: CheckboxPainterOptions) {
        super();
    }
    private box(canvas: Canvas, outer: Rect, paint: Paint, side: BorderSide): void {
        const shape = this.options.shape;
        if (shape.preferPaintInterior)
            shape.paintInterior(canvas, outer, paint);
        else
            canvas.drawPath(shape.getOuterPath(outer), paint);
        shape.copyWith({ side }).paint(canvas, outer);
    }
    private check(canvas: Canvas, origin: Offset, t: number, paint: Paint): void {
        const start = new Offset(18 * .15, 18 * .45), mid = new Offset(18 * .4, 18 * .7), end = new Offset(18 * .85, 18 * .25), path = new Path();
        path.moveTo(origin.dx + start.dx, origin.dy + start.dy);
        if (t < .5) {
            const m = Offset.lerp(start, mid, t * 2)!;
            path.lineTo(origin.dx + m.dx, origin.dy + m.dy);
        }
        else {
            const e = Offset.lerp(mid, end, (t - .5) * 2)!;
            path.lineTo(origin.dx + mid.dx, origin.dy + mid.dy);
            path.lineTo(origin.dx + e.dx, origin.dy + e.dy);
        }
        canvas.drawPath(path, paint);
    }
    private dash(canvas: Canvas, origin: Offset, t: number, paint: Paint): void {
        const start = new Offset(18 * .2, 9), mid = new Offset(9, 9), end = new Offset(18 * .8, 9), a = Offset.lerp(start, mid, 1 - t)!, b = Offset.lerp(mid, end, t)!;
        canvas.drawLine(origin.add(a), origin.add(b), paint);
    }
    paint(canvas: Canvas, size: Size): void {
        const o = this.options, origin = new Offset((size.width - 18) / 2, (size.height - 18) / 2);
        if (o.isFocused || o.isHovered || o.reaction !== 0 || o.reactionFocusFade !== 0 || o.reactionHoverFade !== 0) {
            const color = sourceColorLerp(sourceColorLerp(sourceColorLerp(o.inactiveReactionColor, o.activeReactionColor, o.position), o.hoverColor, o.reactionHoverFade), o.focusColor, o.reactionFocusFade)!, radius = o.isFocused || o.isHovered ? o.splashRadius : o.splashRadius * o.reaction;
            if (radius > 0)
                canvas.drawCircle(new Offset(size.width / 2, size.height / 2), radius, new Paint({ color: color.toARGB32() }));
        }
        const stroke = new Paint({
            color: o.checkColor.toARGB32(), style: 'stroke', strokeWidth: 2
        }), normalized = o.positionStatus === AnimationStatus.forward || o.positionStatus === AnimationStatus.completed ? o.position : 1 - o.position;
        const color = (t: number) => t >= .25 ? o.activeColor : sourceColorLerp(o.inactiveColor, o.activeColor, t * 4)!;
        if (o.previousValue === false || o.value === false) {
            const t = o.value === false ? 1 - normalized : normalized, inset = 1 - Math.abs(t - .5) * 2, outer = Rect.fromLTWH(origin.dx + inset, origin.dy + inset, 18 - inset * 2, 18 - inset * 2);
            this.box(canvas, outer, new Paint({ color: color(t).toARGB32() }), t <= .5 ? BorderSide.lerp(o.inactiveSide, o.activeSide, t) : o.activeSide);
            if (t > .5) {
                if (o.previousValue === null || o.value === null)
                    this.dash(canvas, origin, (t - .5) * 2, stroke);
                else
                    this.check(canvas, origin, (t - .5) * 2, stroke);
            }
        }
        else {
            this.box(canvas, Rect.fromLTWH(origin.dx, origin.dy, 18, 18), new Paint({ color: o.activeColor.toARGB32() }), o.activeSide);
            const first = normalized <= .5, t = first ? 1 - normalized * 2 : (normalized - .5) * 2, value = first ? o.previousValue : o.value;
            if (value === true)
                this.check(canvas, origin, t, stroke);
            else
                this.dash(canvas, origin, t, stroke);
        }
    }
    shouldRepaint(_old: CheckboxPainter): boolean {
        return true;
    }
}
