// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional cupertino/radio.dart painter on canonical Core Canvas/Path/gradient owners.
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Size } from '@nelyx/core/ui/geometry';
import type { Color } from '@nelyx/core/ui/color';
import { Paint } from '@nelyx/core/ui/paint';
import { Path } from '@nelyx/core/ui/path';
import { Rect } from '@nelyx/core/ui/rect';
import { Offset } from '@nelyx/core/ui/offset';
import { LinearGradient } from '@nelyx/core/framework/painting/gradient';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { CupertinoColors } from '../../colors.ts';
import { _size, _kOuterRadius, _kInnerRadius, _kDisabledOuterColor, _kPressedOverlayOpacity, _kCheckmarkStrokeWidth, _kFocusOutlineStrokeWidth, _kBorderOutlineStrokeWidth, _kDarkGradientOpacities, _kDisabledDarkGradientOpacities } from '../../generated/radio/radio-defaults.generated.ts';

export interface CupertinoRadioPaintValues {
    readonly activeColor: Color;
    readonly inactiveColor: Color;
    readonly fillColor: Color;
    readonly borderColor: Color;
    readonly focusColor: Color;
    readonly brightness: 'light' | 'dark' | null;
    readonly isActive: boolean;
}
export interface CupertinoRadioPainterOptions extends CupertinoRadioPaintValues {
    readonly selected: boolean;
    readonly checkmarkStyle: boolean;
    readonly downPosition: Offset | null;
    readonly isFocused: boolean;
}
export class CupertinoRadioPainter extends CustomPainter {
    constructor(readonly options: CupertinoRadioPainterOptions) { super(); }
    private outer(canvas: Canvas, center: Offset, color: Color, gradient: boolean): void {
        if (gradient) {
            const opacities = this.options.isActive ? _kDarkGradientOpacities : _kDisabledDarkGradientOpacities;
            const rect = Rect.fromCircle({ center, radius: _kOuterRadius });
            const shader = new LinearGradient({ begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [color.withOpacity(opacities[0]!.value).toARGB32(), color.withOpacity(opacities[1]!.value).toARGB32()] }).createShader(rect);
            const path = new Path(); path.addOval(rect);
            canvas.drawPath(path, new Paint({ shader }));
        } else canvas.drawCircle(center, _kOuterRadius, new Paint({ color: color.toARGB32() }));
    }
    private border(canvas: Canvas, center: Offset): void {
        canvas.drawCircle(center, _kOuterRadius, new Paint({ color: this.options.borderColor.toARGB32(), style: 'stroke', strokeWidth: _kBorderOutlineStrokeWidth }));
    }
    private pressed(canvas: Canvas, center: Offset): void {
        if (this.options.downPosition !== null) canvas.drawCircle(center, _kOuterRadius, new Paint({ color: (this.options.brightness === 'light' ? CupertinoColors.black : CupertinoColors.white).withOpacity(_kPressedOverlayOpacity).toARGB32() }));
    }
    paint(canvas: Canvas, size: Size): void {
        const o = this.options, center = new Offset(size.width / 2, size.height / 2);
        if (o.checkmarkStyle) {
            if (o.selected) {
                const path = new Path(), width = _size.width, origin = new Offset(center.dx - width / 2, center.dy - width / 2);
                const paint = new Paint({ color: o.activeColor.toARGB32(), style: 'stroke', strokeWidth: _kCheckmarkStrokeWidth, strokeCap: 'round' });
                path.moveTo(origin.dx + width * .25, origin.dy + width * .52);
                path.lineTo(origin.dx + width * .46, origin.dy + width * .75);
                canvas.drawPath(path, paint);
                path.moveTo(origin.dx + width * .46, origin.dy + width * .75);
                path.lineTo(origin.dx + width * .85, origin.dy + width * .29);
                canvas.drawPath(path, paint);
            }
        } else if (o.selected) {
            this.outer(canvas, center, o.activeColor, o.brightness === 'dark' && !o.isActive);
            this.pressed(canvas, center);
            canvas.drawCircle(center, _kInnerRadius, new Paint({ color: o.fillColor.toARGB32() }));
            if (!o.isActive) this.border(canvas, center);
        } else {
            this.outer(canvas, center, o.isActive ? o.inactiveColor : _kDisabledOuterColor, o.brightness === 'dark');
            this.pressed(canvas, center);
            this.border(canvas, center);
        }
        if (o.isFocused) canvas.drawCircle(center, _kOuterRadius + _kFocusOutlineStrokeWidth / 2, new Paint({ color: o.focusColor.toARGB32(), style: 'stroke', strokeWidth: _kFocusOutlineStrokeWidth }));
    }
    shouldRepaint(_old: CupertinoRadioPainter): boolean { return true; }
}
