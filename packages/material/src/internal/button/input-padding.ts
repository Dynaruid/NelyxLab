// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { SingleChildRenderObjectWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { RenderShiftedBox } from '@nelyx/core/framework/rendering/shifted-box';
import type { HitTestEntry, TextBaseline } from '@nelyx/core/framework/rendering/object';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { Size, Offset, TransformMatrix } from '@nelyx/core/ui/geometry';
import { contains, identity, multiply } from '@nelyx/core/ui/geometry';
export class ButtonInputPadding extends SingleChildRenderObjectWidget {
    constructor(readonly minSize: Size, child: Widget) { super(child); }
    createRenderObject(): RenderButtonInputPadding { return new RenderButtonInputPadding(this.minSize); }
    updateRenderObject(_context: BuildContext, render: RenderButtonInputPadding): void { render.minSize = this.minSize; }
}
export class RenderButtonInputPadding extends RenderShiftedBox {
    constructor(private minimum: Size) { super(); }
    get minSize(): Size { return this.minimum; }
    set minSize(value: Size) { if (value.width === this.minimum.width && value.height === this.minimum.height)
        return; this.assertCanMutateLayoutProperty(); this.minimum = value; this.markNeedsLayout(); }
    /** @dartParam height double
     * @dartReturn double */
    protected override computeMinIntrinsicWidth(height: number): number { return this.child ? Math.max(this.child.getMinIntrinsicWidth(height), this.minimum.width) : 0; }
    /** @dartParam height double
     * @dartReturn double */
    protected override computeMaxIntrinsicWidth(height: number): number { return this.child ? Math.max(this.child.getMaxIntrinsicWidth(height), this.minimum.width) : 0; }
    /** @dartParam width double
     * @dartReturn double */
    protected override computeMinIntrinsicHeight(width: number): number { return this.child ? Math.max(this.child.getMinIntrinsicHeight(width), this.minimum.height) : 0; }
    /** @dartParam width double
     * @dartReturn double */
    protected override computeMaxIntrinsicHeight(width: number): number { return this.child ? Math.max(this.child.getMaxIntrinsicHeight(width), this.minimum.height) : 0; }
    protected override computeDryLayout(constraints: BoxConstraints): Size { const size = this.child?.getDryLayout(constraints); return size ? constraints.constrain({ width: Math.max(size.width, this.minimum.width), height: Math.max(size.height, this.minimum.height) }) : { width: 0, height: 0 }; }
    /** @dartReturn double? */
    protected override computeDryBaseline(constraints: BoxConstraints, baseline: TextBaseline): number | null { const child = this.child, value = child?.getDryBaseline(constraints, baseline) ?? null; if (!child || value === null)
        return null; return value + (this.getDryLayout(constraints).height - child.getDryLayout(constraints).height) / 2; }
    protected override performLayout(constraints: BoxConstraints): Size { const child = this.child; if (!child)
        return { width: 0, height: 0 }; child.layout(constraints, { parentUsesSize: true }); const size = constraints.constrain({ width: Math.max(child.size.width, this.minimum.width), height: Math.max(child.size.height, this.minimum.height) }); child.layoutOffset = { x: (size.width - child.size.width) / 2, y: (size.height - child.size.height) / 2 }; return size; }
    override hitTest(position: Offset, result: HitTestEntry[], toLocal: TransformMatrix = identity): boolean { if (!contains({ x: 0, y: 0, ...this.size }, position))
        return false; if (super.hitTest(position, result, toLocal))
        return true; const child = this.child; if (!child)
        return false; const center = { x: child.size.width / 2, y: child.size.height / 2 }; return child.hitTest(center, result, multiply([0, 0, 0, 0, center.x, center.y], toLocal)); }
}
RenderShiftedBox._registerGeometryLayoutSemantics(RenderButtonInputPadding.prototype);
