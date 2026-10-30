// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {
  StatelessWidget,
  StatefulWidget,
  State,
  MultiChildRenderObjectWidget,
  SingleChildRenderObjectWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Padding, Center, ColoredBox } from '@nelyx/core/framework/widgets/basic';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import { TextSelectionToolbarLayoutDelegate } from '@nelyx/core/framework/widgets/text-selection-toolbar-layout-delegate';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { RenderProxyBox } from '@nelyx/core/framework/rendering/boxes';
import type { RenderObject, HitTestEntry } from '@nelyx/core/framework/rendering/object';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import { Offset } from '@nelyx/core/ui/offset';
import { RRect } from '@nelyx/core/ui/rrect';
import { Rect } from '@nelyx/core/ui/rect';
import { Path } from '@nelyx/core/ui/path';
import { Paint } from '@nelyx/core/ui/paint';
import type { Offset as Point, Size, TransformMatrix } from '@nelyx/core/ui/geometry';
import {
  contains,
  inversePaintTransform,
  transform,
  multiply,
  identity,
} from '@nelyx/core/ui/geometry';
import type { SemanticsNode, Rect as Bounds } from '@nelyx/core/ui/types';
import { CupertinoTheme } from './theme.ts';
import { CupertinoTextSelectionToolbarButton } from './text-selection-toolbar-button.ts';
import { BoxShadow } from '@nelyx/core/framework/painting/box-shadow';
import { AnimatedSize } from '@nelyx/core/framework/widgets/animated-size';
import { FadeTransition } from '@nelyx/core/framework/widgets/transitions';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { Curves } from '@nelyx/core/framework/animation/curves';
export type CupertinoToolbarBuilder = (
  context: BuildContext,
  anchorAbove: Offset,
  anchorBelow: Offset,
  child: Widget,
) => Widget;
export interface CupertinoTextSelectionToolbarOptions extends WidgetOptions {
  readonly anchorAbove: Offset;
  readonly anchorBelow: Offset;
  readonly children: readonly Widget[];
  readonly toolbarBuilder?: CupertinoToolbarBuilder;
}
export class CupertinoTextSelectionToolbar extends StatelessWidget {
  static readonly kToolbarScreenPadding = 8;
  readonly anchorAbove: Offset;
  readonly anchorBelow: Offset;
  readonly children: readonly Widget[];
  readonly toolbarBuilder: CupertinoToolbarBuilder;
  constructor({
    anchorAbove,
    anchorBelow,
    children,
    toolbarBuilder = CupertinoTextSelectionToolbar.defaultToolbarBuilder,
    key = null,
  }: CupertinoTextSelectionToolbarOptions) {
    super(key);
    if (!children.length) throw new Error('CupertinoTextSelectionToolbar requires children');
    this.anchorAbove = anchorAbove;
    this.anchorBelow = anchorBelow;
    this.children = Object.freeze([...children]);
    this.toolbarBuilder = toolbarBuilder;
  }
  static defaultToolbarBuilder(
    context: BuildContext,
    above: Offset,
    below: Offset,
    child: Widget,
  ): Widget {
    const dark = CupertinoTheme.of(context).brightness === 'dark';
    return new ToolbarShape(
      new ColoredBox({ color: dark ? 0xff222222 : 0xfff6f6f6, child }),
      above,
      below,
      dark ? null : 0x33000000,
    );
  }
  build(context: BuildContext): Widget {
    const media = MediaQuery.of(context),
      top = media.safeArea.top + 8,
      left = media.safeArea.left + 26,
      right = media.width - media.safeArea.right - 26,
      clamp = (x: number) => Math.max(left, Math.min(right, x)),
      above = new Offset(clamp(this.anchorAbove.dx), this.anchorAbove.dy - 8 - top),
      below = new Offset(clamp(this.anchorBelow.dx), this.anchorBelow.dy + 8 - top);
    return new Padding(
      {
        left: 8,
        top,
        right: 8,
        bottom: 8,
      },
      new CustomSingleChildLayout(
        new ToolbarContent(this.children, above, below, this.toolbarBuilder),
        new TextSelectionToolbarLayoutDelegate({ anchorAbove: above, anchorBelow: below }),
      ),
    );
  }
}
class ToolbarContent extends StatefulWidget {
  constructor(
    readonly children: readonly Widget[],
    readonly above: Offset,
    readonly below: Offset,
    readonly builder: CupertinoToolbarBuilder,
  ) {
    super();
  }
  createState(): State<ToolbarContent> {
    return new ToolbarContentState();
  }
}
interface Paging {
  next: boolean;
  previous: boolean;
}
class ToolbarContentState extends TickerProviderStateMixin<ToolbarContent> {
  private page = 0;
  private nextPage: number | null = null;
  private controller!: AnimationController;
  private readonly paging: Paging = { next: false, previous: false };
  override initState(): void {
    super.initState();
    this.controller = new AnimationController({
      value: 1,
      vsync: this,
      duration: 125,
    });
  }
  private readonly statusChanged = (status: AnimationStatus) => {
    if (status !== AnimationStatus.dismissed || this.nextPage === null) return;
    this.setState(() => {
      this.page = this.nextPage!;
      this.nextPage = null;
    });
    this.controller.forward();
    this.controller.removeStatusListener(this.statusChanged);
  };
  private move(delta: number): void {
    if (delta > 0 ? this.paging.next : this.paging.previous) {
      this.controller.reverse();
      this.controller.addStatusListener(this.statusChanged);
      this.nextPage = this.page + delta;
    }
  }
  override didUpdateWidget(old: ToolbarContent): void {
    super.didUpdateWidget(old);
    if (
      old.children.length !== this.widget.children.length ||
      old.children.some((v, i) => v !== this.widget.children[i])
    ) {
      this.page = 0;
      this.nextPage = null;
      this.controller.forward();
      this.controller.removeStatusListener(this.statusChanged);
    }
  }
  override dispose(): void {
    this.controller.dispose();
    super.dispose();
  }
  build(context: BuildContext): Widget {
    const dark = CupertinoTheme.of(context).brightness === 'dark',
      center = (child: Widget) => new Center(child, { widthFactor: 1, heightFactor: 1 }),
      button = (delta: number) =>
        center(
          new CupertinoTextSelectionToolbarButton({
            onPressed: () => this.move(delta),
            child: new Chevron(delta < 0, dark ? 0xffffffff : 0xff000000),
          }),
        ),
      media = MediaQuery.of(context);
    return this.widget.builder(
      context,
      this.widget.above,
      this.widget.below,
      new FadeTransition({
        opacity: this.controller,
        child: new AnimatedSize({
          duration: 125,
          curve: Curves.decelerate,
          child: new GestureDetector(
            new ToolbarItems(
              [button(-1), button(1), ...this.widget.children.map(center)],
              this.page,
              this.paging,
              1 / media.scale,
              dark ? 0xff424242 : 0xffd6d6d6,
            ),
            {
              onHorizontalDragEnd: (details) => {
                const velocity = details.primaryVelocity ?? 0;
                if (Math.abs(velocity) > 0) this.move(velocity < 0 ? 1 : -1);
              },
            },
          ),
        }),
      }),
    );
  }
}
class Chevron extends SingleChildRenderObjectWidget {
  constructor(
    readonly left: boolean,
    readonly color: number,
  ) {
    super(undefined);
  }
  createRenderObject(): RenderChevron {
    return new RenderChevron(this.left, this.color);
  }
  updateRenderObject(_context: BuildContext, render: RenderObject): void {
    if (!(render instanceof RenderChevron)) throw new Error('Wrong chevron renderer');
    render.configure(this.left, this.color);
  }
}
class RenderChevron extends RenderBox {
  constructor(
    private left: boolean,
    private color: number,
  ) {
    super();
  }
  configure(left: boolean, color: number): void {
    this.left = left;
    this.color = color;
    this.markNeedsPaint();
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    return constraints.constrain({ width: 10, height: 10 });
  }
  protected override computeMinIntrinsicWidth(): number {
    return 10;
  }
  protected override computeMaxIntrinsicWidth(): number {
    return 10;
  }
  protected override computeMinIntrinsicHeight(): number {
    return 10;
  }
  protected override computeMaxIntrinsicHeight(): number {
    return 10;
  }
  override paint(context: PaintingContext): void {
    const s = this.size.height,
      offset = (s / 4) * (this.left ? 1 : -1),
      first = new Offset(s / 2 + offset, 0),
      middle = new Offset((this.left ? 0 : s) + offset, s / 2),
      last = new Offset(s / 2 + offset, s),
      paint = new Paint({
        color: this.color,
        style: 'stroke',
        strokeWidth: 2,
        strokeCap: 'round',
        strokeJoin: 'round',
      });
    context.drawLine(first, middle, paint);
    context.drawLine(middle, last, paint);
  }
}
class ToolbarItems extends MultiChildRenderObjectWidget {
  constructor(
    children: readonly Widget[],
    readonly page: number,
    readonly paging: Paging,
    readonly divider: number,
    readonly color: number,
  ) {
    super(children);
  }
  createRenderObject(): RenderToolbarItems {
    return new RenderToolbarItems(this.page, this.paging, this.divider, this.color);
  }
  updateRenderObject(_context: BuildContext, render: RenderObject): void {
    if (!(render instanceof RenderToolbarItems))
      throw new Error('Wrong Cupertino toolbar renderer');
    render.configure(this.page, this.divider, this.color);
  }
}
class RenderToolbarItems extends RenderBox {
  private visible = new Set<RenderObject>();
  constructor(
    private page: number,
    private paging: Paging,
    private divider: number,
    private color: number,
  ) {
    super();
  }
  configure(page: number, divider: number, color: number): void {
    this.assertCanMutateLayoutProperty();
    if (page !== this.page || divider !== this.divider || color !== this.color) {
      this.page = page;
      this.divider = divider;
      this.color = color;
      this.markNeedsLayout();
    }
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    const [back, next, ...items] = this.children;
    this.visible.clear();
    if (!back || !next) return constraints.smallest;
    let height = 0;
    for (const child of this.children)
      height = Math.max(height, child.getMaxIntrinsicHeight(constraints.maxWidth));
    const slot = new BoxConstraints(0, constraints.maxWidth, height, height);
    back.layout(slot, { parentUsesSize: true });
    next.layout(slot, { parentUsesSize: true });
    let x = 0,
      current = 0,
      width = 0;
    for (let i = 0; i < items.length; i++) {
      if (current > this.page) break;
      const child = items[i]!,
        reserved =
          current === 0
            ? i === items.length - 1
              ? 0
              : next.size.width
            : back.size.width + next.size.width;
      child.layout(
        new BoxConstraints(0, Math.max(0, constraints.maxWidth - reserved), height, height),
        { parentUsesSize: true },
      );
      if (x + reserved + child.size.width > constraints.maxWidth) {
        current++;
        x = back.size.width + this.divider;
        child.layout(
          new BoxConstraints(
            0,
            Math.max(0, constraints.maxWidth - back.size.width - next.size.width),
            height,
            height,
          ),
          { parentUsesSize: true },
        );
      }
      child.layoutOffset = { x, y: 0 };
      x += child.size.width + this.divider;
      if (current === this.page) {
        this.visible.add(child);
        width = x;
      }
    }
    if (current > 0) {
      if (this.page !== current) {
        next.layoutOffset = { x: width, y: 0 };
        this.visible.add(next);
        width += next.size.width;
      }
      if (this.page > 0) {
        back.layoutOffset = { x: 0, y: 0 };
        this.visible.add(back);
      }
    } else width -= this.divider;
    this.paging.next = this.page !== current;
    this.paging.previous = this.page > 0;
    return constraints.constrain({ width: Math.max(0, width), height });
  }
  override paint(context: PaintingContext): void {
    for (const child of this.children)
      if (this.visible.has(child)) {
        context.paintChild(child, this.childTransform(child));
        const x = child.layoutOffset.x;
        if (x > 0)
          context.drawRect(
            {
              x: x - this.divider,
              y: 0,
              width: this.divider,
              height: this.size.height,
            },
            new Paint({ color: this.color }),
          );
      }
  }
  override hitTest(
    position: Point,
    result: HitTestEntry[],
    toLocal: TransformMatrix = identity,
  ): boolean {
    if (
      !contains(
        {
          x: 0,
          y: 0,
          ...this.size,
        },
        position,
      )
    )
      return false;
    for (const child of [...this.children].reverse())
      if (this.visible.has(child)) {
        const matrix = inversePaintTransform(this.childTransform(child));
        if (matrix && child.hitTest(transform(matrix, position), result, multiply(matrix, toLocal)))
          return true;
      }
    return false;
  }
  override visitChildrenForSemantics(visitor: (child: RenderObject) => void): void {
    for (const child of this.children) if (this.visible.has(child)) visitor(child);
  }
  override collectSemantics(
    output: SemanticsNode[],
    matrix: TransformMatrix = identity,
    clip?: Bounds,
  ): void {
    for (const child of this.children)
      if (this.visible.has(child))
        child.collectSemantics(output, multiply(matrix, this.childTransform(child)), clip);
  }
}
class ToolbarShape extends SingleChildRenderObjectWidget {
  constructor(
    child: Widget,
    readonly above: Offset,
    readonly below: Offset,
    readonly shadow: number | null,
  ) {
    super(child);
  }
  createRenderObject(): RenderToolbarShape {
    return new RenderToolbarShape(this.above, this.below, this.shadow);
  }
  updateRenderObject(_context: BuildContext, render: RenderObject): void {
    if (!(render instanceof RenderToolbarShape)) throw new Error('Wrong toolbar shape');
    render.configure(this.above, this.below, this.shadow);
  }
}
class RenderToolbarShape extends RenderProxyBox {
  constructor(
    private above: Offset,
    private below: Offset,
    private shadow: number | null,
  ) {
    super();
  }
  configure(above: Offset, below: Offset, shadow: number | null): void {
    this.assertCanMutateLayoutProperty();
    this.above = above;
    this.below = below;
    this.shadow = shadow;
    this.markNeedsLayout();
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    if (!this.child) return constraints.smallest;
    this.child.layout(new BoxConstraints(30).enforce(constraints.loosen()), {
      parentUsesSize: true,
    });
    this.child.layoutOffset = { x: 0, y: this.above.dy >= this.child.size.height - 7 ? -7 : 0 };
    return constraints.constrain({
      width: this.child.size.width,
      height: Math.max(0, this.child.size.height - 7),
    });
  }
  override paint(context: PaintingContext): void {
    if (!this.child) return;
    const above = this.above.dy >= this.child.size.height - 7,
      anchor = above ? this.above : this.below,
      global = this.localToGlobal(Offset.zero),
      tip = Math.max(15, Math.min(this.size.width - 15, anchor.dx - global.x)),
      top = above ? 0 : 7,
      bottom = above ? this.size.height - 7 : this.size.height,
      right = this.size.width,
      r = RRect.fromRectXY(Rect.fromLTRB(0, top, right, bottom), 8, 8).scaleRadii(),
      path = new Path();
    if (right < 30) path.addRRect(r);
    else {
      const base = above ? bottom : top;
      path.moveTo(tip + (above ? 7 : -7), base);
      path.lineTo(tip, base + (above ? 7 : -7));
      path.lineTo(tip + (above ? -7 : 7), base);
      // Source arcTo quarter circles represented exactly as rational conics.
      const corners = [
        () => {
          path.lineTo(right, r.bottom - r.brRadiusY);
          path.conicTo(right, r.bottom, right - r.brRadiusX, r.bottom, Math.SQRT1_2);
        },
        () => {
          path.lineTo(r.left + r.blRadiusX, r.bottom);
          path.conicTo(r.left, r.bottom, r.left, r.bottom - r.blRadiusY, Math.SQRT1_2);
        },
        () => {
          path.lineTo(r.left, r.top + r.tlRadiusY);
          path.conicTo(r.left, r.top, r.left + r.tlRadiusX, r.top, Math.SQRT1_2);
        },
        () => {
          path.lineTo(right - r.trRadiusX, r.top);
          path.conicTo(right, r.top, right, r.top + r.trRadiusY, Math.SQRT1_2);
        },
      ];
      for (let i = 0; i < 4; i++) corners[(i + (above ? 1 : 3)) % 4]!();
      path.close();
    }
    if (this.shadow !== null)
      context.drawRRect(
        RRect.fromRectXY(Rect.fromLTRB(0, top, right, bottom + 7), 8, 8),
        new BoxShadow({ color: this.shadow, blurRadius: 15 }).toPaint(),
      );
    context.save();
    try {
      context.clipPath(path);
      super.paint(context);
    } finally {
      context.restore();
    }
  }
  override hitTest(
    position: Point,
    result: HitTestEntry[],
    toLocal: TransformMatrix = identity,
  ): boolean {
    if (
      !this.child ||
      !contains(
        {
          x: this.child.layoutOffset.x,
          y: this.child.layoutOffset.y + 7,
          width: this.child.size.width,
          height: Math.max(0, this.child.size.height - 14),
        },
        position,
      )
    )
      return false;
    return super.hitTest(position, result, toLocal);
  }
}
