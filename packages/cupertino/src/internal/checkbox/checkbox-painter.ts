// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import type { Canvas } from '@nelyx/core/ui/canvas';
import { Paint } from '@nelyx/core/ui/paint';
import { Path } from '@nelyx/core/ui/path';
import { Rect } from '@nelyx/core/ui/rect';
import { Offset } from '@nelyx/core/ui/offset';
import type { Size } from '@nelyx/core/ui/geometry';
import type { Color } from '@nelyx/core/ui/color';
import type { OutlinedBorder, BorderSide } from '@nelyx/core/framework/painting/borders';
import { LinearGradient } from '@nelyx/core/framework/painting/gradient';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { CupertinoColors } from "../../colors.ts";
import { _kDarkGradientOpacities, _kDisabledDarkGradientOpacities, _kPressedOverlayOpacity } from "../../generated/checkbox/checkbox-defaults.generated.ts";
export interface CupertinoCheckboxPaintValues {
    readonly activeColor: Color;
    readonly inactiveColor: Color;
    readonly checkColor: Color;
    readonly focusColor: Color;
    readonly side: BorderSide;
    readonly shape: OutlinedBorder;
    readonly brightness: 'light' | 'dark' | null;
    readonly isActive: boolean;
}
export interface CupertinoCheckboxPainterOptions extends CupertinoCheckboxPaintValues {
    readonly value: boolean | null;
    readonly downPosition: Offset | null;
    readonly isFocused: boolean;
}
export class CupertinoCheckboxPainter extends CustomPainter {
    constructor(readonly options: CupertinoCheckboxPainterOptions) {
        super();
    }
    private interior(canvas: Canvas, outer: Rect, paint: Paint): void {
        const shape = this.options.shape;
        if (shape.preferPaintInterior)
            shape.paintInterior(canvas, outer, paint);
        else
            canvas.drawPath(shape.getOuterPath(outer), paint);
    }
    private box(canvas: Canvas, outer: Rect, paint: Paint, color: Color): void {
        const o = this.options;
        if (o.brightness === 'dark' && !(o.isActive && (o.value ?? true))) {
            const opacities = o.isActive ? _kDarkGradientOpacities : _kDisabledDarkGradientOpacities, gradient = new LinearGradient({
                begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [color.withOpacity(opacities[0]!.value).toARGB32(), color.withOpacity(opacities[1]!.value).toARGB32()]
            });
            this.interior(canvas, outer, new Paint({ shader: gradient.createShader(outer) }));
        }
        else
            this.interior(canvas, outer, paint);
        o.shape.copyWith({ side: o.side }).paint(canvas, outer);
    }
    paint(canvas: Canvas, size: Size): void {
        const o = this.options, origin = new Offset((size.width - 14) / 2, (size.height - 14) / 2), outer = Rect.fromLTWH(origin.dx, origin.dy, 14, 14), stroke = new Paint({
            color: o.checkColor.toARGB32(), style: 'stroke', strokeWidth: 2, strokeCap: 'round'
        });
        this.box(canvas, outer, new Paint({ color: (o.value !== false && o.isActive ? o.activeColor : o.inactiveColor).toARGB32() }), o.value !== false && o.isActive ? o.activeColor : o.inactiveColor);
        if (o.value === true) {
            const path = new Path();
            path.moveTo(origin.dx + 14 * .22, origin.dy + 14 * .54);
            path.lineTo(origin.dx + 14 * .4, origin.dy + 14 * .75);
            path.moveTo(origin.dx + 14 * .4, origin.dy + 14 * .75);
            path.lineTo(origin.dx + 14 * .78, origin.dy + 14 * .25);
            canvas.drawPath(path, stroke);
        }
        else if (o.value === null)
            canvas.drawLine(new Offset(origin.dx + 14 * .25, origin.dy + 7), new Offset(origin.dx + 14 * .75, origin.dy + 7), stroke);
        if (o.downPosition !== null)
            this.interior(canvas, outer, new Paint({ color: (o.brightness === 'light' ? CupertinoColors.black : CupertinoColors.white).withOpacity(_kPressedOverlayOpacity).toARGB32() }));
        if (o.isFocused)
            this.box(canvas, outer.inflate(1), new Paint({
                color: o.focusColor.toARGB32(), style: 'stroke', strokeWidth: 3.5
            }), o.focusColor);
    }
    shouldRepaint(_old: CupertinoCheckboxPainter): boolean {
        return true;
    }
}
