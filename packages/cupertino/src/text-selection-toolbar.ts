// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/text_selection_toolbar.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
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
import {
  RenderTextSelectionToolbarItem,
  TextSelectionToolbarItem,
  TextSelectionToolbarLayoutDelegate,
} from '@nelyx/core/framework/widgets/text-selection-toolbar-layout-delegate';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { RenderProxyBox } from '@nelyx/core/framework/rendering/boxes';
import type { RenderObject, HitTestEntry } from '@nelyx/core/framework/rendering/object';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { ClipPathLayer, LayerHandle } from '@nelyx/core/framework/rendering/layer';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import { Offset } from '@nelyx/core/ui/offset';
import { Color } from '@nelyx/core/ui/color';
import { RRect } from '@nelyx/core/ui/rrect';
import { Rect } from '@nelyx/core/ui/rect';
import { Path } from '@nelyx/core/ui/path';
import { Paint } from '@nelyx/core/ui/paint';
import type { Offset as Point, Size, TransformMatrix } from '@nelyx/core/ui/geometry';
import type { TextBaseline } from '@nelyx/core/ui/typography';
import {
  contains,
  inversePaintTransform,
  transform,
  multiply,
  identity,
} from '@nelyx/core/ui/geometry';
import type { SemanticsNode, Rect as Bounds } from '@nelyx/core/ui/types';
import { CupertinoColors, CupertinoDynamicColor } from './colors.ts';
import { CupertinoTheme } from './theme.ts';
import { CupertinoTextSelectionToolbarButton } from './text-selection-toolbar-button.ts';
import { BoxShadow } from '@nelyx/core/framework/painting/box-shadow';
import { AnimatedSize } from '@nelyx/core/framework/widgets/animated-size';
import { FadeTransition } from '@nelyx/core/framework/widgets/transitions';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { Curves } from '@nelyx/core/framework/animation/curves';

const toolbarRadius = 8;
const toolbarContentDistance = 8;
const toolbarArrowHalfWidth = 7;
const toolbarArrowHeight = 7;
const toolbarMinimumWidth = 2 * (toolbarArrowHalfWidth + toolbarRadius);
const arrowScreenPadding = 26;
const chevronSize = 10;
const chevronThickness = 2;
const toolbarTransitionDuration = 125;
const backgroundColor = CupertinoDynamicColor.withBrightness({
  color: new Color(0xfff6f6f6),
  darkColor: new Color(0xff222222),
});
const dividerColor = CupertinoDynamicColor.withBrightness({
  color: new Color(0xffd6d6d6),
  darkColor: new Color(0xff424242),
});
const chevronColor = CupertinoDynamicColor.withBrightness({
  color: CupertinoColors.black,
  darkColor: CupertinoColors.white,
});

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
      new ColoredBox({ color: backgroundColor.resolveFrom(context).toARGB32(), child }),
      above,
      below,
      dark ? null : 0x33000000,
    );
  }
  build(context: BuildContext): Widget {
    const { kToolbarScreenPadding: padding } = CupertinoTextSelectionToolbar;
    const mediaPadding = MediaQuery.paddingOf(context),
      top = mediaPadding.top + padding,
      left = mediaPadding.left + arrowScreenPadding,
      right = MediaQuery.of(context).width - mediaPadding.right - arrowScreenPadding,
      clamp = (x: number) => Math.max(left, Math.min(right, x)),
      above = new Offset(
        clamp(this.anchorAbove.dx),
        this.anchorAbove.dy - toolbarContentDistance - top,
      ),
      below = new Offset(
        clamp(this.anchorBelow.dx),
        this.anchorBelow.dy + toolbarContentDistance - top,
      );
    return new Padding(
      {
        left: padding,
        top,
        right: padding,
        bottom:
          Math.max(MediaQuery.paddingOf(context).bottom, MediaQuery.viewInsetsOf(context).bottom) +
          padding,
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
  page: number;
  next: boolean;
  previous: boolean;
}
class ToolbarContentState extends TickerProviderStateMixin<ToolbarContent> {
  private page = 0;
  private nextPage: number | null = null;
  private controller!: AnimationController;
  private readonly paging: Paging = { page: 0, next: false, previous: false };
  override initState(): void {
    super.initState();
    this.controller = new AnimationController({
      value: 1,
      vsync: this,
      duration: toolbarTransitionDuration,
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
    if (this.nextPage === null && (delta > 0 ? this.paging.next : this.paging.previous)) {
      this.nextPage = this.paging.page + delta;
      this.controller.addStatusListener(this.statusChanged);
      this.controller.reverse();
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
    const color = chevronColor.resolveFrom(context).toARGB32(),
      center = (child: Widget) => new Center(child, { widthFactor: 1, heightFactor: 1 }),
      button = (delta: number) =>
        center(
          new CupertinoTextSelectionToolbarButton({
            onPressed: () => this.move(delta),
            child: new Chevron(delta < 0, color),
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
          duration: toolbarTransitionDuration,
          curve: Curves.decelerate,
          child: new GestureDetector(
            new ToolbarItems(
              [button(-1), button(1), ...this.widget.children.map(center)],
              this.page,
              this.paging,
              1 / media.scale,
              dividerColor.resolveFrom(context).toARGB32(),
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
    return constraints.constrain({ width: chevronSize, height: chevronSize });
  }
  protected override computeMinIntrinsicWidth(): number {
    return chevronSize;
  }
  protected override computeMaxIntrinsicWidth(): number {
    return chevronSize;
  }
  protected override computeMinIntrinsicHeight(): number {
    return chevronSize;
  }
  protected override computeMaxIntrinsicHeight(): number {
    return chevronSize;
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
        strokeWidth: chevronThickness,
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
    super(children.map((child) => new TextSelectionToolbarItem(child)));
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
    const before = this.visible;
    this.visible = new Set();
    if (!back || !next) return constraints.smallest;
    let height = 0;
    for (const child of this.children)
      height = Math.max(height, child.getMaxIntrinsicHeight(constraints.maxWidth));
    height = constraints.constrainHeight(height);
    const slot = new BoxConstraints(0, constraints.maxWidth, height, height);
    back.layout(slot, { parentUsesSize: true });
    next.layout(slot, { parentUsesSize: true });
    let x = 0;
    let current = 0;
    let hasNext = false;
    const pageItems: RenderObject[] = [];
    for (let i = 0; i < items.length; i++) {
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
      if (pageItems.length > 0 && x + reserved + child.size.width > constraints.maxWidth) {
        if (current === this.page) {
          hasNext = true;
          break;
        }
        current++;
        pageItems.length = 0;
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
      pageItems.push(child);
    }
    for (const child of pageItems) this.visible.add(child);
    let width = Math.max(0, x - this.divider);
    if (hasNext) {
      next.layoutOffset = { x, y: 0 };
      this.visible.add(next);
      width = x + next.size.width;
    }
    if (current > 0) {
      back.layoutOffset = { x: 0, y: 0 };
      this.visible.add(back);
    }
    this.paging.page = current;
    this.paging.next = hasNext;
    this.paging.previous = current > 0;
    for (const child of this.children) {
      if (child instanceof RenderTextSelectionToolbarItem)
        child.setVisible(this.visible.has(child));
    }
    if (
      before.size !== this.visible.size ||
      [...before].some((child) => !this.visible.has(child))
    ) {
      this.markNeedsSemanticsUpdate();
    }
    return constraints.constrain({ width, height });
  }
  override paintsChild(child: RenderObject): boolean {
    return this.visible.has(child);
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
  private readonly pathLayer = new LayerHandle<ClipPathLayer>();

  constructor(
    private above: Offset,
    private below: Offset,
    private shadow: number | null,
  ) {
    super();
  }
  configure(above: Offset, below: Offset, shadow: number | null): void {
    this.assertCanMutateLayoutProperty();
    if (!above.equals(this.above) || !below.equals(this.below)) {
      this.above = above;
      this.below = below;
      this.markNeedsLayout();
    }
    if (shadow !== this.shadow) {
      this.shadow = shadow;
      this.markNeedsPaint();
    }
  }

  private childConstraints(constraints: BoxConstraints): BoxConstraints {
    return new BoxConstraints(toolbarMinimumWidth).enforce(constraints.loosen());
  }

  private isAbove(childHeight: number): boolean {
    return this.above.dy >= childHeight - toolbarArrowHeight;
  }

  protected override computeDryBaseline(
    constraints: BoxConstraints,
    baseline: TextBaseline,
  ): number | null {
    const child = this.child;
    if (!child) return null;
    const inner = this.childConstraints(constraints);
    const result = child.getDryBaseline(inner, baseline);
    if (result === null) return null;
    return result - (this.isAbove(child.getDryLayout(inner).height) ? toolbarArrowHeight : 0);
  }

  protected override performLayout(constraints: BoxConstraints): Size {
    if (!this.child) return constraints.smallest;
    this.child.layout(this.childConstraints(constraints), {
      parentUsesSize: true,
    });
    this.child.layoutOffset = {
      x: 0,
      y: this.isAbove(this.child.size.height) ? -toolbarArrowHeight : 0,
    };
    return constraints.constrain({
      width: this.child.size.width,
      height: Math.max(0, this.child.size.height - toolbarArrowHeight),
    });
  }
  override paint(context: PaintingContext): void {
    if (!this.child) {
      this.pathLayer.dispose();
      return;
    }
    const above = this.isAbove(this.child.size.height),
      anchor = above ? this.above : this.below,
      tipMargin = toolbarRadius + toolbarArrowHalfWidth,
      tip = Math.max(
        tipMargin,
        Math.min(this.size.width - tipMargin, this.globalToLocal(anchor).x),
      ),
      top = above ? 0 : Math.min(toolbarArrowHeight, this.size.height),
      bottom = above ? Math.max(0, this.size.height - toolbarArrowHeight) : this.size.height,
      right = this.size.width,
      r = RRect.fromRectXY(
        Rect.fromLTRB(0, top, right, bottom),
        toolbarRadius,
        toolbarRadius,
      ).scaleRadii(),
      path = new Path();
    if (right < toolbarMinimumWidth) path.addRRect(r);
    else {
      const base = above ? bottom : top;
      const direction = above ? 1 : -1;
      path.moveTo(tip + direction * toolbarArrowHalfWidth, base);
      path.lineTo(tip, base + direction * toolbarArrowHeight);
      path.lineTo(tip - direction * toolbarArrowHalfWidth, base);
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
        RRect.fromRectXY(
          Rect.fromLTRB(0, top, right, bottom + toolbarArrowHeight),
          toolbarRadius,
          toolbarRadius,
        ),
        new BoxShadow({ color: this.shadow, blurRadius: 15 }).toPaint(),
      );
    const layer = this.pathLayer.layer ?? new ClipPathLayer();
    this.pathLayer.layer = layer;
    layer.clipPath = path;
    layer.clipBehavior = 'antiAlias';
    context.pushLayer(layer, (inner) => super.paint(inner), undefined, {
      x: 0,
      y: 0,
      ...this.size,
    });
  }

  override detach(): void {
    try {
      super.detach();
    } finally {
      if (!this.attached) this.pathLayer.dispose();
    }
  }

  override dispose(): void {
    try {
      super.dispose();
    } finally {
      if (this.debugDisposed) this.pathLayer.dispose();
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
          y: this.child.layoutOffset.y + toolbarArrowHeight,
          width: this.child.size.width,
          height: Math.max(0, this.child.size.height - 2 * toolbarArrowHeight),
        },
        position,
      )
    )
      return false;
    return super.hitTest(position, result, toLocal);
  }
}
