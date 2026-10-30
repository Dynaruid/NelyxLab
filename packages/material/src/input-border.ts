// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Standard input borders on the canonical Core shape/path/canvas owners.
import { ShapeBorder, BorderSide } from '@nelyx/core/framework/painting/borders';
import type { ShapeBorderOptions } from '@nelyx/core/framework/painting/borders';
import { BoxBorder } from '@nelyx/core/framework/painting/box-border';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { Path } from '@nelyx/core/ui/path';
import { Rect } from '@nelyx/core/ui/rect';
import { Offset } from '@nelyx/core/ui/offset';
import { Radius } from '@nelyx/core/ui/radius';
import type { RRect } from '@nelyx/core/ui/rrect';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Paint } from '@nelyx/core/ui/paint';
import { invariant } from '@nelyx/core/foundation/errors';
import { hashValues } from '@nelyx/core/framework/painting/value-equality';
import { lerpDouble } from '@nelyx/core/internal/ui/lerp-double.generated';

export interface InputBorderOptions { readonly borderSide?: BorderSide; }
export interface InputBorderPaintOptions extends ShapeBorderOptions {
    /** @dartType double? */
    readonly gapStart?: number | null;
    /** @dartType double */
    readonly gapExtent?: number;
    /** @dartType double */
    readonly gapPercentage?: number;
}
let noInputBorder: InputBorder | null = null;
export abstract class InputBorder extends ShapeBorder {
    static get none(): InputBorder { return noInputBorder ??= new NoInputBorder(); }
    readonly borderSide: BorderSide;
    constructor({ borderSide = BorderSide.none }: InputBorderOptions = {}) {
        super();
        if (!(borderSide instanceof BorderSide)) throw new TypeError('InputBorder requires the canonical Core BorderSide');
        this.borderSide = borderSide;
    }
    abstract copyWith(options?: { readonly borderSide?: BorderSide | null }): InputBorder;
    abstract get isOutline(): boolean;
    /** @dartParam gapStart double?
     * @dartParam gapExtent double
     * @dartParam gapPercentage double */
    abstract override paint(canvas: Canvas, rect: Rect, options?: InputBorderPaintOptions): void;
}
class NoInputBorder extends InputBorder {
    constructor() { super(); Object.freeze(this); }
    copyWith(_options: { readonly borderSide?: BorderSide | null } = {}): InputBorder { return InputBorder.none; }
    get isOutline(): boolean { return false; }
    get dimensions(): EdgeInsetsGeometry { return EdgeInsets.zero; }
    /** @dartParam t double */
    scale(_t: number): InputBorder { return InputBorder.none; }
    getInnerPath(rect: Rect, _options: ShapeBorderOptions = {}): Path { const path = new Path(); path.addRect(rect); return path; }
    getOuterPath(rect: Rect, options: ShapeBorderOptions = {}): Path { return this.getInnerPath(rect, options); }
    override hitTest(rect: Rect, position: Offset, _options: ShapeBorderOptions = {}): boolean { return rect.contains(position); }
    override paintInterior(canvas: Canvas, rect: Rect, paint: Paint, _options: ShapeBorderOptions = {}): void { canvas.drawRect(rect, paint); }
    override get preferPaintInterior(): boolean { return true; }
    /** @dartParam gapStart double?
     * @dartParam gapExtent double
     * @dartParam gapPercentage double */
    paint(_canvas: Canvas, _rect: Rect, _options: InputBorderPaintOptions = {}): void {}
}
export interface UnderlineInputBorderOptions extends InputBorderOptions { readonly borderRadius?: BorderRadius; }
export interface UnderlineInputBorderCopyOptions { readonly borderSide?: BorderSide | null; readonly borderRadius?: BorderRadius | null; }
const underlineRadius = BorderRadius.only({ topLeft: Radius.circular(4), topRight: Radius.circular(4) });
export class UnderlineInputBorder extends InputBorder {
    readonly borderRadius: BorderRadius;
    constructor({ borderSide = new BorderSide(), borderRadius = underlineRadius }: UnderlineInputBorderOptions = {}) {
        super({ borderSide });
        if (!(borderRadius instanceof BorderRadius)) throw new TypeError('UnderlineInputBorder requires BorderRadius');
        this.borderRadius = borderRadius;
        if (new.target === UnderlineInputBorder) Object.freeze(this);
    }
    get isOutline(): boolean { return false; }
    copyWith({ borderSide = null, borderRadius = null }: UnderlineInputBorderCopyOptions = {}): UnderlineInputBorder {
        return new UnderlineInputBorder({ borderSide: borderSide ?? this.borderSide, borderRadius: borderRadius ?? this.borderRadius });
    }
    get dimensions(): EdgeInsetsGeometry { return EdgeInsets.only({ bottom: this.borderSide.width }); }
    /** @dartParam t double */
    scale(t: number): UnderlineInputBorder { return new UnderlineInputBorder({ borderSide: this.borderSide.scale(t) }); }
    getInnerPath(rect: Rect, _options: ShapeBorderOptions = {}): Path {
        const path = new Path(); path.addRect(Rect.fromLTWH(rect.left, rect.top, rect.width, Math.max(0, rect.height - this.borderSide.width))); return path;
    }
    getOuterPath(rect: Rect, { textDirection = null }: ShapeBorderOptions = {}): Path {
        const path = new Path(); path.addRRect(this.borderRadius.resolve(textDirection).toRRect(rect)); return path;
    }
    override hitTest(rect: Rect, position: Offset, { textDirection = null }: ShapeBorderOptions = {}): boolean { return this.borderRadius.resolve(textDirection).toRRect(rect).contains(position); }
    override paintInterior(canvas: Canvas, rect: Rect, paint: Paint, { textDirection = null }: ShapeBorderOptions = {}): void {
        canvas.drawRRect(this.borderRadius.resolve(textDirection).toRRect(rect), paint);
    }
    override get preferPaintInterior(): boolean { return true; }
    /** @dartParam t double */
    override lerpFrom(a: ShapeBorder | null, t: number): ShapeBorder | null {
        return a instanceof UnderlineInputBorder ? new UnderlineInputBorder({ borderSide: BorderSide.lerp(a.borderSide, this.borderSide, t), borderRadius: BorderRadius.lerp(a.borderRadius, this.borderRadius, t)! }) : super.lerpFrom(a, t);
    }
    /** @dartParam t double */
    override lerpTo(b: ShapeBorder | null, t: number): ShapeBorder | null {
        return b instanceof UnderlineInputBorder ? new UnderlineInputBorder({ borderSide: BorderSide.lerp(this.borderSide, b.borderSide, t), borderRadius: BorderRadius.lerp(this.borderRadius, b.borderRadius, t)! }) : super.lerpTo(b, t);
    }
    /** @dartParam gapStart double?
     * @dartParam gapExtent double
     * @dartParam gapPercentage double */
    paint(canvas: Canvas, rect: Rect, { textDirection = null }: InputBorderPaintOptions = {}): void {
        if (this.borderSide.style === 'none') return;
        if (!this.borderRadius.bottomLeft.equals(Radius.zero) || !this.borderRadius.bottomRight.equals(Radius.zero)) {
            const maximum = Radius.circular(rect.height / 2);
            BoxBorder.paintNonUniformBorder(canvas, rect, {
                textDirection,
                borderRadius: BorderRadius.only({ bottomLeft: this.borderRadius.bottomLeft.clamp({ maximum }), bottomRight: this.borderRadius.bottomRight.clamp({ maximum }) }),
                bottom: this.borderSide.copyWith({ strokeAlign: BorderSide.strokeAlignInside }),
                color: this.borderSide.color,
            });
        } else {
            const offset = new Offset(0, this.borderSide.width / 2);
            canvas.drawLine(rect.bottomLeft.subtract(offset), rect.bottomRight.subtract(offset), this.borderSide.toPaint());
        }
    }
    equals(other: unknown): boolean { return this === other || other instanceof UnderlineInputBorder && other.constructor === this.constructor && other.borderSide.equals(this.borderSide) && other.borderRadius.equals(this.borderRadius); }
    /** @dartReturn int */
    get hashCode(): number { return hashValues(this.borderSide, this.borderRadius); }
}
export interface OutlineInputBorderOptions extends UnderlineInputBorderOptions {
    /** @dartType double */
    readonly gapPadding?: number;
}
export interface OutlineInputBorderCopyOptions extends UnderlineInputBorderCopyOptions {
    /** @dartType double? */
    readonly gapPadding?: number | null;
}
export class OutlineInputBorder extends InputBorder {
    readonly borderRadius: BorderRadius;
    /** @dartType double */
    readonly gapPadding: number;
    /** @dartParam gapPadding double */
    constructor({ borderSide = new BorderSide(), borderRadius = BorderRadius.circular(4), gapPadding = 4 }: OutlineInputBorderOptions = {}) {
        super({ borderSide });
        invariant(gapPadding >= 0, 'invalid-input-gap-padding', 'Input border gap padding must be non-negative');
        if (!(borderRadius instanceof BorderRadius)) throw new TypeError('OutlineInputBorder requires BorderRadius');
        this.borderRadius = borderRadius; this.gapPadding = gapPadding;
        if (new.target === OutlineInputBorder) Object.freeze(this);
    }
    get isOutline(): boolean { return true; }
    /** @dartParam gapPadding double? */
    copyWith({ borderSide = null, borderRadius = null, gapPadding = null }: OutlineInputBorderCopyOptions = {}): OutlineInputBorder {
        return new OutlineInputBorder({ borderSide: borderSide ?? this.borderSide, borderRadius: borderRadius ?? this.borderRadius, gapPadding: gapPadding ?? this.gapPadding });
    }
    get dimensions(): EdgeInsetsGeometry { return EdgeInsets.all(this.borderSide.strokeInset); }
    /** @dartParam t double */
    scale(t: number): OutlineInputBorder { return new OutlineInputBorder({ borderSide: this.borderSide.scale(t), borderRadius: this.borderRadius.multiply(t), gapPadding: this.gapPadding * t }); }
    /** @dartParam t double */
    override lerpFrom(a: ShapeBorder | null, t: number): ShapeBorder | null {
        return a instanceof OutlineInputBorder ? new OutlineInputBorder({ borderRadius: BorderRadius.lerp(a.borderRadius, this.borderRadius, t)!, borderSide: BorderSide.lerp(a.borderSide, this.borderSide, t), gapPadding: a.gapPadding }) : super.lerpFrom(a, t);
    }
    /** @dartParam t double */
    override lerpTo(b: ShapeBorder | null, t: number): ShapeBorder | null {
        return b instanceof OutlineInputBorder ? new OutlineInputBorder({ borderRadius: BorderRadius.lerp(this.borderRadius, b.borderRadius, t)!, borderSide: BorderSide.lerp(this.borderSide, b.borderSide, t), gapPadding: b.gapPadding }) : super.lerpTo(b, t);
    }
    getInnerPath(rect: Rect, { textDirection = null }: ShapeBorderOptions = {}): Path {
        const path = new Path(); path.addRRect(this.borderRadius.resolve(textDirection).toRRect(rect).deflate(this.borderSide.strokeInset)); return path;
    }
    getOuterPath(rect: Rect, { textDirection = null }: ShapeBorderOptions = {}): Path {
        const path = new Path(); path.addRRect(this.borderRadius.resolve(textDirection).toRRect(rect)); return path;
    }
    override hitTest(rect: Rect, position: Offset, { textDirection = null }: ShapeBorderOptions = {}): boolean { return this.borderRadius.resolve(textDirection).toRRect(rect).contains(position); }
    override paintInterior(canvas: Canvas, rect: Rect, paint: Paint, { textDirection = null }: ShapeBorderOptions = {}): void { canvas.drawRRect(this.borderRadius.resolve(textDirection).toRRect(rect), paint); }
    override get preferPaintInterior(): boolean { return true; }
    /** @dartParam outerWidth double
     * @dartParam start double
     * @dartParam extent double */
    private gapBorderPath(center: RRect, outerWidth: number, start: number, extent: number): Path {
        const r = center.scaleRadii();
        const tl = Rect.fromLTWH(r.left, r.top, r.tlRadiusX * 2, r.tlRadiusY * 2);
        const tr = Rect.fromLTWH(r.right - r.trRadiusX * 2, r.top, r.trRadiusX * 2, r.trRadiusY * 2);
        const br = Rect.fromLTWH(r.right - r.brRadiusX * 2, r.bottom - r.brRadiusY * 2, r.brRadiusX * 2, r.brRadiusY * 2);
        const bl = Rect.fromLTWH(r.left, r.bottom - r.blRadiusY * 2, r.blRadiusX * 2, r.blRadiusY * 2);
        const cornerArcSweep = Math.PI / 2, path = new Path(), clamp = (v: number) => Math.max(0, Math.min(1, v));
        if (!r.tlRadius.equals(Radius.zero)) path.addArc(tl, Math.PI, Math.acos(clamp(1 - start / r.tlRadiusX)));
        else path.moveTo(r.left + this.borderSide.strokeOffset / 2, r.top);
        if (start > r.tlRadiusX) path.lineTo(start, r.top);
        const trStart = 3 * Math.PI / 2;
        if (start + extent < outerWidth - r.trRadiusX) {
            path.moveTo(start + extent, r.top); path.lineTo(r.right - r.trRadiusX, r.top);
            if (!r.trRadius.equals(Radius.zero)) path.addArc(tr, trStart, cornerArcSweep);
        } else if (start + extent < outerWidth) {
            const dx = outerWidth - (start + extent), sweep = Math.asin(clamp(1 - dx / r.trRadiusX));
            path.addArc(tr, trStart + sweep, cornerArcSweep - sweep);
        }
        if (!r.brRadius.equals(Radius.zero)) path.moveTo(r.right, r.top + r.trRadiusY);
        path.lineTo(r.right, r.bottom - r.brRadiusY);
        if (!r.brRadius.equals(Radius.zero)) path.addArc(br, 0, cornerArcSweep);
        path.lineTo(r.left + r.blRadiusX, r.bottom);
        if (!r.blRadius.equals(Radius.zero)) path.addArc(bl, Math.PI / 2, cornerArcSweep);
        path.lineTo(r.left, r.top + r.tlRadiusY);
        return path;
    }
    /** @dartParam gapStart double?
     * @dartParam gapExtent double
     * @dartParam gapPercentage double */
    paint(canvas: Canvas, rect: Rect, { gapStart = null, gapExtent = 0, gapPercentage = 0, textDirection = null }: InputBorderPaintOptions = {}): void {
        invariant(gapPercentage >= 0 && gapPercentage <= 1, 'invalid-input-gap-percentage', 'Input gap percentage must be within [0,1]');
        invariant([this.borderRadius.topLeft, this.borderRadius.topRight, this.borderRadius.bottomLeft, this.borderRadius.bottomRight].every(radius => radius.x === radius.y), 'elliptical-input-border', 'Outline input border corners must be circular');
        const paint = this.borderSide.toPaint(), outer = this.borderRadius.toRRect(rect), center = outer.inflate(this.borderSide.strokeOffset / 2);
        if (gapStart === null || gapExtent <= 0 || gapPercentage === 0) canvas.drawRRect(center, paint);
        else {
            if (textDirection === null) throw new TypeError('An input border label gap requires textDirection');
            const extent = lerpDouble(0, gapExtent + this.gapPadding * 2, gapPercentage)!;
            const start = textDirection === 'rtl' ? gapStart + this.gapPadding - extent : gapStart - this.gapPadding;
            canvas.drawPath(this.gapBorderPath(center, outer.width, Math.max(0, start), extent), paint);
        }
    }
    equals(other: unknown): boolean { return this === other || other instanceof OutlineInputBorder && other.constructor === this.constructor && other.borderSide.equals(this.borderSide) && other.borderRadius.equals(this.borderRadius) && other.gapPadding === this.gapPadding; }
    /** @dartReturn int */
    get hashCode(): number { return hashValues(this.borderSide, this.borderRadius, this.gapPadding); }
}
