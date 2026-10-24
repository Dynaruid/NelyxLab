// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned chip.dart private layout/hit/paint on the current Core render protocol.
import { MultiChildRenderObjectWidget, SingleChildRenderObjectWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { RenderBox, RenderObject } from '@nelyx/core/framework/rendering/object';
import type { PipelineOwner, HitTestEntry, TextBaseline } from '@nelyx/core/framework/rendering/object';
import { RenderConstrainedBox, RenderProxyBox } from '@nelyx/core/framework/rendering/boxes';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import type { SemanticsConfiguration } from '@nelyx/core/framework/semantics/semantics';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { Color } from '@nelyx/core/ui/color';
import { Paint } from '@nelyx/core/ui/paint';
import { Path } from '@nelyx/core/ui/path';
import { Rect } from '@nelyx/core/ui/rect';
import { Offset } from '@nelyx/core/ui/offset';
import type { Size, TransformMatrix } from '@nelyx/core/ui/geometry';
import { identity, multiply, contains } from '@nelyx/core/ui/geometry';
import { invariant } from '@nelyx/core/foundation/errors';
import type { VisualDensity } from "../../theme-data.ts";
export interface ChipRenderTheme {
    readonly avatar: Widget;
    readonly label: Widget;
    readonly deleteIcon: Widget;
    readonly brightness: 'light' | 'dark';
    readonly padding: EdgeInsets;
    readonly visualDensity: VisualDensity;
    readonly labelPadding: EdgeInsets;
    readonly showAvatar: boolean;
    readonly showCheckmark: boolean;
    readonly checkmarkColor: Color | null;
    readonly canTapBody: boolean;
}
export interface ChipRenderOptions {
    readonly theme: ChipRenderTheme;
    readonly checkmarkAnimation: Animation<number>;
    readonly avatarDrawerAnimation: Animation<number>;
    readonly deleteDrawerAnimation: Animation<number>;
    readonly enableAnimation: Animation<number>;
    readonly avatarBorder: ShapeBorder;
    readonly avatarBoxConstraints: BoxConstraints | null;
    readonly deleteIconBoxConstraints: BoxConstraints | null;
}
interface ChipSizes {
    readonly overall: Size; /** @dartType double */
    readonly content: number;
    readonly densityY: number;
    readonly avatar: Size;
    readonly label: Size;
    readonly deleteIcon: Size;
    readonly labelConstraints: BoxConstraints;
}
export class ChipRenderWidget extends MultiChildRenderObjectWidget {
    constructor(readonly options: ChipRenderOptions) {
        super([options.theme.avatar, options.theme.label, options.theme.deleteIcon]);
    }
    createRenderObject(context: BuildContext): RenderObject {
        return new RenderChip(this.options, Directionality.of(context));
    }
    override updateRenderObject(context: BuildContext, render: RenderObject): void {
        invariant(render instanceof RenderChip, 'invalid-chip-render', 'Chip requires its owning render box');
        render.configure(this.options, Directionality.of(context));
    }
}
export function hitIsOnDeleteIcon(padding: EdgeInsets, labelPadding: EdgeInsets, position: {
    readonly x: number;
    readonly y: number;
}, chipSize: Size, deleteButtonSize: Size, direction: 'ltr' | 'rtl'): boolean {
    const width = chipSize.width - padding.horizontal, x = position.x - padding.left, accessible = Math.min(width * .499, Math.min(labelPadding.right + deleteButtonSize.width, 24 + deleteButtonSize.width / 2));
    return direction === 'ltr' ? x >= width - accessible : x <= accessible;
}
export class RenderChip extends RenderBox {
    private options: ChipRenderOptions;
    private direction: 'ltr' | 'rtl';
    private deleteRect = Rect.zero;
    private pressRect = Rect.zero;
    private readonly layoutChanged = () => {
        if (this.attached)
            this.markNeedsLayout();
    };
    private readonly paintChanged = () => {
        if (this.attached)
            this.markNeedsPaint();
    };
    constructor(options: ChipRenderOptions, direction: 'ltr' | 'rtl') {
        super();
        this.options = options;
        this.direction = direction;
    }
    protected override get childCountLimit(): number {
        return 3;
    }
    get theme(): ChipRenderTheme {
        return this.options.theme;
    }
    get avatar(): RenderBox<RenderObject> {
        return this.children[0]!;
    }
    get label(): RenderBox<RenderObject> {
        return this.children[1]!;
    }
    get deleteIcon(): RenderBox<RenderObject> {
        return this.children[2]!;
    }
    get deleteIconShowing(): boolean {
        return !this.options.deleteDrawerAnimation.isDismissed;
    }
    private listen(options: ChipRenderOptions, add: boolean): void {
        const method = add ? 'addListener' : 'removeListener';
        options.checkmarkAnimation[method](this.paintChanged);
        options.avatarDrawerAnimation[method](this.layoutChanged);
        options.deleteDrawerAnimation[method](this.layoutChanged);
        options.enableAnimation[method](this.paintChanged);
    }
    configure(options: ChipRenderOptions, direction: 'ltr' | 'rtl'): void {
        if (this.attached)
            this.listen(this.options, false);
        this.options = options;
        this.direction = direction;
        if (this.attached)
            this.listen(options, true);
        this.markNeedsLayout();
        this.markNeedsPaint();
    }
    override attach(owner: PipelineOwner): void {
        const was = this.attached;
        super.attach(owner);
        if (!was)
            this.listen(this.options, true);
    }
    override detach(): void {
        this.listen(this.options, false);
        super.detach();
    }
    protected override computeMinIntrinsicWidth(height: number): number {
        return this.theme.padding.horizontal + this.theme.labelPadding.horizontal + this.avatar.getMinIntrinsicWidth(height) + this.label.getMinIntrinsicWidth(height) + this.deleteIcon.getMinIntrinsicWidth(height);
    }
    protected override computeMaxIntrinsicWidth(height: number): number {
        return this.theme.padding.horizontal + this.theme.labelPadding.horizontal + this.avatar.getMaxIntrinsicWidth(height) + this.label.getMaxIntrinsicWidth(height) + this.deleteIcon.getMaxIntrinsicWidth(height);
    }
    protected override computeMinIntrinsicHeight(width: number): number {
        return Math.max(32, this.theme.padding.vertical + this.theme.labelPadding.vertical + this.label.getMinIntrinsicHeight(width));
    }
    protected override computeMaxIntrinsicHeight(width: number): number {
        return this.computeMinIntrinsicHeight(width);
    }
    protected override computeDistanceToActualBaseline(baseline: TextBaseline): number | null {
        const value = this.label.getDistanceToActualBaseline(baseline);
        return value === null ? null : value + this.label.layoutOffset.y;
    }
    private sizes(constraints: BoxConstraints, dry: boolean): ChipSizes {
        const t = this.theme, o = this.options, inner = constraints.loosen(), raw = this.label.getDryLayout(inner), content = Math.max(32 - t.padding.vertical + t.labelPadding.vertical, raw.height + t.labelPadding.vertical), layout = (child: RenderBox<RenderObject>, c: BoxConstraints): Size => {
            if (dry)
                return child.getDryLayout(c);
            child.layout(c, { parentUsesSize: true });
            return child.size;
        }, avatarBox = layout(this.avatar, o.avatarBoxConstraints ?? BoxConstraints.tightFor(content, content)), avatar = { width: !t.showCheckmark && !t.showAvatar ? 0 : (t.showAvatar ? avatarBox.width : content) * o.avatarDrawerAnimation.value, height: !t.showCheckmark && !t.showAvatar ? content : avatarBox.height }, deleteBox = layout(this.deleteIcon, o.deleteIconBoxConstraints ?? BoxConstraints.tightFor(content, content)), deleteIcon = { width: this.deleteIconShowing ? deleteBox.width * o.deleteDrawerAnimation.value : 0, height: this.deleteIconShowing ? deleteBox.height : content }, free = Math.max(0, inner.maxWidth - avatar.width - deleteIcon.width - t.labelPadding.horizontal - t.padding.horizontal), labelConstraints = new BoxConstraints(0, Number.isFinite(free) ? free : raw.width, raw.height, content), labelBox = layout(this.label, labelConstraints), label = { width: labelBox.width + t.labelPadding.horizontal, height: labelBox.height + t.labelPadding.vertical }, densityY = t.visualDensity.baseSizeAdjustment.dy / 2;
        return {
            overall: { width: avatar.width + label.width + deleteIcon.width, height: content + densityY }, content, densityY, avatar, label, deleteIcon, labelConstraints
        };
    }
    protected override computeDryLayout(constraints: BoxConstraints): Size {
        const s = this.sizes(constraints, true);
        return constraints.constrain({ width: s.overall.width + this.theme.padding.horizontal, height: s.overall.height + this.theme.padding.vertical });
    }
    protected override computeDryBaseline(constraints: BoxConstraints, baseline: TextBaseline): number | null {
        const s = this.sizes(constraints, true), value = this.label.getDryBaseline(s.labelConstraints, baseline);
        return value === null ? null : value + (s.content - s.label.height + s.densityY) / 2 + this.theme.padding.top + this.theme.labelPadding.top;
    }
    protected override performLayout(constraints: BoxConstraints): Size {
        const s = this.sizes(constraints, false), t = this.theme, center = (size: Size, x: number) => ({ x: x - (this.direction === 'rtl' ? size.width : 0), y: (s.content - size.height + s.densityY) / 2 });
        let avatar = { x: 0, y: 0 }, label = { x: 0, y: 0 }, deleteIcon = { x: 0, y: 0 };
        if (this.direction === 'rtl') {
            let start = s.overall.width;
            if (t.showCheckmark || t.showAvatar) {
                avatar = center(s.avatar, start);
                start -= s.avatar.width;
            }
            label = center(s.label, start);
            start -= s.label.width;
            if (this.deleteIconShowing) {
                this.deleteRect = Rect.fromLTWH(0, 0, s.deleteIcon.width + t.padding.right, s.overall.height + t.padding.vertical);
                deleteIcon = center(s.deleteIcon, start);
            }
            else
                this.deleteRect = Rect.zero;
            this.pressRect = t.canTapBody ? Rect.fromLTWH(this.deleteRect.width, 0, s.overall.width - this.deleteRect.width + t.padding.horizontal, s.overall.height + t.padding.vertical) : Rect.zero;
        }
        else {
            let start = 0;
            if (t.showCheckmark || t.showAvatar) {
                avatar = center(s.avatar, start - this.avatar.size.width + s.avatar.width);
                start += s.avatar.width;
            }
            label = center(s.label, start);
            start += s.label.width;
            this.pressRect = t.canTapBody ? Rect.fromLTWH(0, 0, this.deleteIconShowing ? start + t.padding.left : s.overall.width + t.padding.horizontal, s.overall.height + t.padding.vertical) : Rect.zero;
            start -= this.deleteIcon.size.width - s.deleteIcon.width;
            if (this.deleteIconShowing) {
                deleteIcon = center(s.deleteIcon, start);
                this.deleteRect = Rect.fromLTWH(start + t.padding.left, 0, s.deleteIcon.width + t.padding.right, s.overall.height + t.padding.vertical);
            }
            else
                this.deleteRect = Rect.zero;
        }
        label.y += ((s.label.height - t.labelPadding.vertical) - this.label.size.height) / 2;
        this.avatar.layoutOffset = { x: t.padding.left + avatar.x, y: t.padding.top + avatar.y };
        this.label.layoutOffset = { x: t.padding.left + label.x + t.labelPadding.left, y: t.padding.top + label.y + t.labelPadding.top };
        this.deleteIcon.layoutOffset = { x: t.padding.left + deleteIcon.x, y: t.padding.top + deleteIcon.y };
        return constraints.constrain({ width: s.overall.width + t.padding.horizontal, height: s.overall.height + t.padding.vertical });
    }
    protected override hitTestSelf(position: {
        readonly x: number;
        readonly y: number;
    }): boolean {
        return this.deleteRect.contains(position) || this.pressRect.contains(position);
    }
    override hitTest(position: {
        readonly x: number;
        readonly y: number;
    }, result: HitTestEntry[], toLocal: TransformMatrix = identity): boolean {
        if (!contains({
            x: 0, y: 0, ...this.size
        }, position))
            return false;
        const child = hitIsOnDeleteIcon(this.theme.padding, this.theme.labelPadding, position, this.size, this.deleteIcon.size, this.direction) ? this.deleteIcon : this.label, center = { x: child.size.width / 2, y: child.size.height / 2 }, matrix: TransformMatrix = [0, 0, 0, 0, center.x, center.y];
        return child.hitTest(center, result, multiply(matrix, toLocal)) || this.hitTestSelf(position);
    }
    private boxRect(child: RenderBox<RenderObject>): Rect {
        return Rect.fromLTWH(child.layoutOffset.x, child.layoutOffset.y, child.size.width, child.size.height);
    }
    private get disabledColor(): Color {
        const color = new Color(this.theme.brightness === 'light' ? 0xffffffff : 0xff000000);
        return this.options.enableAnimation.isCompleted ? new Color(0xffffffff) : Color.lerp(color.withAlpha(0x61), color, this.options.enableAnimation.value)!;
    }
    private paintGroup(context: PaintingContext, child: RenderBox<RenderObject>, paint: () => void): void {
        const color = this.disabledColor, layer = color.alpha !== 255;
        if (layer)
            context.saveLayer(this.boxRect(child).inflate(20), new Paint({ color: color.toARGB32() }));
        try {
            paint();
        }
        finally {
            if (layer)
                context.restore();
        }
    }
    private paintCheck(context: PaintingContext): void {
        const t = this.theme, o = this.options, animation = o.checkmarkAnimation;
        if (!t.showCheckmark || animation.isDismissed)
            return;
        if (t.showAvatar) {
            const rect = this.boxRect(this.avatar), paint = new Paint({ color: Color.lerp(new Color(0x00000000), new Color(0x60191919), animation.value)!.toARGB32(), blendMode: 'srcATop' });
            if (o.avatarBorder.preferPaintInterior)
                o.avatarBorder.paintInterior(context, rect, paint);
            else
                context.drawPath(o.avatarBorder.getOuterPath(rect), paint);
        }
        const fallback = t.brightness === 'light' ? t.showAvatar ? 0xffffffff : 0xde000000 : t.showAvatar ? 0xff000000 : 0xdeffffff, base = t.checkmarkColor ?? new Color(fallback), reverse = animation.status === AnimationStatus.reverse, color = reverse ? Color.lerp(new Color(0x00000000), base, animation.value)! : base, phase = reverse ? 1 : animation.value;
        if (phase === 0)
            return;
        const size = this.avatar.size.height * .75, origin = { x: this.avatar.layoutOffset.x + this.avatar.size.height * .125, y: this.avatar.layoutOffset.y + this.avatar.size.height * .125 }, start = { x: size * .15, y: size * .45 }, mid = { x: size * .4, y: size * .7 }, end = { x: size * .85, y: size * .25 }, path = new Path();
        path.moveTo(origin.x + start.x, origin.y + start.y);
        if (phase < .5) {
            const q = phase * 2;
            path.lineTo(origin.x + start.x + (mid.x - start.x) * q, origin.y + start.y + (mid.y - start.y) * q);
        }
        else {
            const q = (phase - .5) * 2;
            path.lineTo(origin.x + mid.x, origin.y + mid.y);
            path.lineTo(origin.x + mid.x + (end.x - mid.x) * q, origin.y + mid.y + (end.y - mid.y) * q);
        }
        context.drawPath(path, new Paint({
            color: color.toARGB32(), style: 'stroke', strokeWidth: 2 * this.avatar.size.height / 24
        }));
    }
    override paint(context: PaintingContext): void {
        if (this.theme.showAvatar || !this.options.avatarDrawerAnimation.isDismissed)
            this.paintGroup(context, this.avatar, () => {
                this.paintChild(context, this.avatar);
                this.paintCheck(context);
            });
        if (this.deleteIconShowing)
            this.paintGroup(context, this.deleteIcon, () => this.paintChild(context, this.deleteIcon));
        this.paintGroup(context, this.label, () => this.paintChild(context, this.label));
    }
}
export class ChipRedirectingHitDetectionWidget extends SingleChildRenderObjectWidget {
    constructor(child: Widget, readonly constraints: BoxConstraints) {
        super(child);
    }
    createRenderObject(): RenderObject {
        return new RenderChipRedirectingHitDetection(this.constraints);
    }
    override updateRenderObject(_context: BuildContext, render: RenderObject): void {
        invariant(render instanceof RenderChipRedirectingHitDetection, 'invalid-chip-hit-render', 'Chip tap padding requires its owning render box');
        render.additionalConstraints = this.constraints;
    }
}
class RenderChipRedirectingHitDetection extends RenderConstrainedBox {
    override hitTest(position: {
        readonly x: number;
        readonly y: number;
    }, result: HitTestEntry[], toLocal: TransformMatrix = identity): boolean {
        if (!contains({
            x: 0, y: 0, ...this.size
        }, position) || !this.child)
            return false;
        const center = { x: position.x, y: this.size.height / 2 }, matrix: TransformMatrix = [0, 0, 0, 0, center.x, center.y];
        return this.child.hitTest(center, result, multiply(matrix, toLocal));
    }
}
export class EnsureMinSemanticsSize extends SingleChildRenderObjectWidget {
    constructor(child: Widget, readonly semanticSize: Size) {
        super(child);
    }
    createRenderObject(): RenderObject {
        return new RenderEnsureMinSemanticsSize(this.semanticSize);
    }
    override updateRenderObject(_context: BuildContext, render: RenderObject): void {
        invariant(render instanceof RenderEnsureMinSemanticsSize, 'invalid-chip-semantics-render', 'Chip delete semantics requires its owning render box');
        render.semanticSize = this.semanticSize;
    }
}
class RenderEnsureMinSemanticsSize extends RenderProxyBox {
    constructor(private minimum: Size) {
        super();
    }
    get semanticSize(): Size {
        return this.minimum;
    }
    set semanticSize(value: Size) {
        if (value.width === this.minimum.width && value.height === this.minimum.height)
            return;
        this.minimum = value;
        this.markNeedsSemanticsUpdate();
    }
    protected override get hasSourceSemanticsConfiguration(): boolean {
        return true;
    }
    override describeSemanticsConfiguration(config: SemanticsConfiguration): void {
        super.describeSemanticsConfiguration(config);
        config.isSemanticBoundary = true;
        config.isButton = true;
    }
    override get semanticBounds(): Rect {
        return Rect.fromCenter({
            center: new Offset(this.size.width / 2, this.size.height / 2), width: Math.max(this.minimum.width, this.size.width), height: Math.max(this.minimum.height, this.size.height)
        });
    }
}
