// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source four-slot geometry on the current Core render protocol.
import { MultiChildRenderObjectWidget, SingleChildRenderObjectWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { RenderBox as CoreRenderBox, RenderObject } from '@nelyx/core/framework/rendering/object';
import { RenderProxyBox } from '@nelyx/core/framework/rendering/boxes';
import type { TextBaseline, HitTestEntry } from '@nelyx/core/framework/rendering/object';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import type { Offset, Size, TransformMatrix } from '@nelyx/core/ui/geometry';
import { identity, multiply, transform, inversePaintTransform, contains } from '@nelyx/core/ui/geometry';
import { invariant } from '@nelyx/core/foundation/errors';
import type { VisualDensity } from "../../theme-data.ts";
import { ListTileTitleAlignment } from "../../generated/list/list-tile-types.ts";
type RenderBox = CoreRenderBox<RenderObject>;
export interface ListTileRenderOptions {
    readonly leading: Widget | null;
    readonly title: Widget;
    readonly subtitle: Widget | null;
    readonly trailing: Widget | null;
    readonly isDense: boolean;
    readonly isThreeLine: boolean;
    readonly visualDensity: VisualDensity;
    readonly textDirection: 'ltr' | 'rtl';
    readonly titleBaselineType: TextBaseline;
    readonly subtitleBaselineType: TextBaseline | null;
    readonly horizontalTitleGap: number;
    readonly minVerticalPadding: number;
    readonly minLeadingWidth: number;
    readonly minTileHeight: number | null;
    readonly titleAlignment: ListTileTitleAlignment;
}
interface TileSizes {
    readonly titleY: number;
    readonly textConstraints: BoxConstraints;
    readonly size: Size;
    readonly positions: readonly (Offset | null)[];
}
export function listTileChildY(alignment: ListTileTitleAlignment, childHeight: number, tileHeight: number, isThreeLine: boolean, minVerticalPadding: number, isLeading: boolean): number {
    if (alignment === ListTileTitleAlignment.threeLine)
        return listTileChildY(isThreeLine ? ListTileTitleAlignment.top : ListTileTitleAlignment.center, childHeight, tileHeight, isThreeLine, minVerticalPadding, isLeading);
    if (alignment === ListTileTitleAlignment.titleHeight)
        return tileHeight > 72 ? 16 : isLeading ? Math.min((tileHeight - childHeight) / 2, 16) : (tileHeight - childHeight) / 2;
    if (alignment === ListTileTitleAlignment.top)
        return minVerticalPadding;
    if (alignment === ListTileTitleAlignment.center)
        return (tileHeight - childHeight) / 2;
    if (alignment === ListTileTitleAlignment.bottom)
        return tileHeight - childHeight - minVerticalPadding;
    throw new TypeError('Unknown ListTileTitleAlignment');
}
export class RenderListTile extends CoreRenderBox {
    constructor(private options: ListTileRenderOptions) {
        super();
    }
    protected override get childCountLimit(): number {
        return 4;
    }
    configure(options: ListTileRenderOptions): void {
        this.options = options;
        this.markNeedsLayout();
    }
    private get leading(): RenderBox | null {
        return this.options.leading === null ? null : this.children[0]!;
    }
    private get title(): RenderBox {
        return this.children[1]!;
    }
    private get subtitle(): RenderBox | null {
        return this.options.subtitle === null ? null : this.children[2]!;
    }
    private get trailing(): RenderBox | null {
        return this.options.trailing === null ? null : this.children[3]!;
    }
    private get orderedChildren(): readonly RenderBox[] {
        return [this.leading, this.title, this.subtitle, this.trailing].filter((r): r is RenderBox => r !== null);
    }
    private get gap(): number {
        return this.options.horizontalTitleGap + this.options.visualDensity.horizontal * 2;
    }
    private get targetHeight(): number {
        const o = this.options;
        return o.minTileHeight ?? o.visualDensity.baseSizeAdjustment.dy + (o.isThreeLine ? (o.isDense ? 76 : 88) : this.subtitle !== null ? (o.isDense ? 64 : 72) : (o.isDense ? 48 : 56));
    }
    private width(height: number, max: boolean): number {
        const get = (r: RenderBox | null) => r === null ? 0 : max ? r.getMaxIntrinsicWidth(height) : r.getMinIntrinsicWidth(height), leading = this.leading;
        return (leading === null ? 0 : Math.max(get(leading), this.options.minLeadingWidth) + this.gap) + Math.max(get(this.title), get(this.subtitle)) + (this.trailing?.getMaxIntrinsicWidth(height) ?? 0);
    }
    protected override computeMinIntrinsicWidth(height: number): number {
        return this.width(height, false);
    }
    protected override computeMaxIntrinsicWidth(height: number): number {
        return this.width(height, true);
    }
    protected override computeMinIntrinsicHeight(width: number): number {
        return Math.max(this.targetHeight, this.title.getMinIntrinsicHeight(width) + (this.subtitle?.getMinIntrinsicHeight(width) ?? 0) + 2 * this.options.minVerticalPadding);
    }
    protected override computeMaxIntrinsicHeight(width: number): number {
        return this.computeMinIntrinsicHeight(width);
    }
    protected override computeDistanceToActualBaseline(baseline: TextBaseline): number | null {
        const b = this.title.getDistanceToActualBaseline(baseline);
        return b === null ? null : b + this.title.layoutOffset.y;
    }
    private sizes(constraints: BoxConstraints, dry: boolean): TileSizes {
        const o = this.options, loose = constraints.loosen(), tileWidth = loose.maxWidth;
        invariant(Number.isFinite(tileWidth), 'unbounded-list-tile', 'ListTile requires a bounded width');
        const icons = loose.enforce(new BoxConstraints(0, Infinity, 0, (o.isDense ? 48 : 56) + o.visualDensity.baseSizeAdjustment.dy)), layout = (r: RenderBox, c: BoxConstraints): Size => {
            if (dry)
                return r.getDryLayout(c);
            r.layout(c, { parentUsesSize: true });
            return r.size;
        }, baseline = (r: RenderBox, c: BoxConstraints, b: TextBaseline): number | null => dry ? r.getDryBaseline(c, b) : r.getDistanceToBaseline(b, { onlyReal: true });
        const leading = this.leading, trailing = this.trailing, leadingSize = leading === null ? null : layout(leading, icons), trailingSize = trailing === null ? null : layout(trailing, icons);
        invariant(tileWidth === 0 || leadingSize?.width !== tileWidth && trailingSize?.width !== tileWidth, 'overflowed-list-tile-icon', 'Leading or trailing widget consumes the entire ListTile width');
        const titleStart = leadingSize === null ? 0 : Math.max(o.minLeadingWidth, leadingSize.width) + this.gap, trailingWidth = trailingSize === null ? 0 : Math.max(trailingSize.width + this.gap, 32), textConstraints = loose.tighten(tileWidth - titleStart - trailingWidth), titleHeight = layout(this.title, textConstraints).height, ltr = o.textDirection === 'ltr', subtitle = this.subtitle, positions: (Offset | null)[] = [null, null, null, null];
        let titleY: number, tileHeight: number;
        if (subtitle === null) {
            tileHeight = Math.max(this.targetHeight, titleHeight + 2 * o.minVerticalPadding);
            titleY = (tileHeight - titleHeight) / 2;
        }
        else {
            const subtitleHeight = layout(subtitle, textConstraints).height, titleBaseline = baseline(this.title, textConstraints, o.titleBaselineType) ?? titleHeight;
            invariant(o.subtitleBaselineType !== null, 'missing-subtitle-baseline', 'ListTile subtitle requires a baseline type');
            const subtitleBaseline = baseline(subtitle, textConstraints, o.subtitleBaselineType) ?? subtitleHeight, targetTitleY = (o.isThreeLine ? (o.isDense ? 22 : 28) : (o.isDense ? 28 : 32)) - titleBaseline, targetSubtitleY = (o.isThreeLine ? (o.isDense ? 42 : 48) : (o.isDense ? 48 : 52)) + o.visualDensity.vertical * 2 - subtitleBaseline, overlap = Math.max(targetTitleY + titleHeight - targetSubtitleY, 0) / 2, idealTitleY = targetTitleY - overlap, idealSubtitleY = targetSubtitleY + overlap, compact = idealTitleY < o.minVerticalPadding || idealSubtitleY + subtitleHeight + o.minVerticalPadding > this.targetHeight;
            positions[2] = { x: ltr ? titleStart : trailingWidth, y: compact ? o.minVerticalPadding + titleHeight : idealSubtitleY };
            tileHeight = compact ? 2 * o.minVerticalPadding + titleHeight + subtitleHeight : this.targetHeight;
            titleY = compact ? o.minVerticalPadding : idealTitleY;
        }
        positions[1] = { x: ltr ? titleStart : trailingWidth, y: titleY };
        if (leadingSize)
            positions[0] = { x: ltr ? 0 : tileWidth - leadingSize.width, y: listTileChildY(o.titleAlignment, leadingSize.height, tileHeight, o.isThreeLine, o.minVerticalPadding, true) };
        if (trailingSize)
            positions[3] = { x: ltr ? tileWidth - trailingSize.width : 0, y: listTileChildY(o.titleAlignment, trailingSize.height, tileHeight, o.isThreeLine, o.minVerticalPadding, false) };
        return {
            titleY, textConstraints, size: { width: tileWidth, height: tileHeight }, positions
        };
    }
    protected override computeDryLayout(c: BoxConstraints): Size {
        return c.constrain(this.sizes(c, true).size);
    }
    protected override computeDryBaseline(c: BoxConstraints, b: TextBaseline): number | null {
        const s = this.sizes(c, true), value = this.title.getDryBaseline(s.textConstraints, b);
        return value === null ? null : value + s.titleY;
    }
    protected override performLayout(c: BoxConstraints): Size {
        const s = this.sizes(c, false);
        for (let i = 0; i < 4; i++) {
            const child = this.children[i]!;
            const position = s.positions[i];
            if (position)
                child.layoutOffset = position;
            else {
                child.layout(BoxConstraints.tightFor(0, 0), { parentUsesSize: true });
                child.layoutOffset = { x: 0, y: 0 };
            }
        }
        return c.constrain(s.size);
    }
    protected override hitTestSelf(_position: Offset): boolean {
        return true;
    }
    override hitTest(position: Offset, result: HitTestEntry[], toLocal: TransformMatrix = identity): boolean {
        if (!contains({
            x: 0, y: 0, ...this.size
        }, position))
            return false;
        for (const child of this.orderedChildren) {
            const matrix = inversePaintTransform(this.childTransform(child));
            if (matrix && child.hitTest(transform(matrix, position), result, multiply(matrix, toLocal)))
                break;
        }
        result.push({ target: this, transform: toLocal });
        return true;
    }
    override paint(context: PaintingContext): void {
        for (const child of this.orderedChildren)
            this.paintChild(context, child);
    }
}
export class ListTileRenderWidget extends MultiChildRenderObjectWidget {
    constructor(readonly options: ListTileRenderOptions) {
        super([options.leading ?? SizedBox.shrink(), options.title, options.subtitle ?? SizedBox.shrink(), options.trailing ?? SizedBox.shrink()].map(child => new ListTileSlot(child)));
    }
    createRenderObject(): RenderObject {
        return new RenderListTile(this.options);
    }
    override updateRenderObject(_context: BuildContext, render: RenderObject): void {
        invariant(render instanceof RenderListTile, 'invalid-list-tile-owner', 'ListTile requires its owning four-slot RenderBox');
        render.configure(this.options);
    }
}
// Each source slot owns one persistent proxy. Replacing a slot's Widget retires
// that slot's old render child before insertion, without transient fifth children
// in the fixed-capacity list renderer or moving sibling State/focus owners.
class ListTileSlot extends SingleChildRenderObjectWidget {
    createRenderObject(): RenderObject {
        return new RenderProxyBox();
    }
}
