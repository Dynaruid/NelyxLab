// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {
  StatelessWidget,
  StatefulWidget,
  State,
  MultiChildRenderObjectWidget,
  SingleChildRenderObjectWidget,
} from '@nelyx/core/framework/widgets/framework';
import { AnimatedSize } from '@nelyx/core/framework/widgets/animated-size';
import { UniqueKey } from '@nelyx/core/foundation/key';
import { RenderProxyBox } from '@nelyx/core/framework/rendering/boxes';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Padding, Text, ConstrainedBox, PhysicalModel } from '@nelyx/core/framework/widgets/basic';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import { TextSelectionToolbarLayoutDelegate } from '@nelyx/core/framework/widgets/text-selection-toolbar-layout-delegate';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import type { RenderObject, HitTestEntry } from '@nelyx/core/framework/rendering/object';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import { Offset } from '@nelyx/core/ui/offset';
import type { Offset as Point, Size, TransformMatrix } from '@nelyx/core/ui/geometry';
import {
  contains,
  inversePaintTransform,
  transform,
  multiply,
  identity,
} from '@nelyx/core/ui/geometry';
import type { SemanticsNode, Rect } from '@nelyx/core/ui/types';
import { Theme } from './theme.ts';
import { MaterialLocalizations } from './material-localizations.ts';
export type ToolbarBuilder = (context: BuildContext, child: Widget) => Widget;
export interface TextSelectionToolbarOptions extends WidgetOptions {
  readonly anchorAbove: Offset;
  readonly anchorBelow: Offset;
  readonly children: readonly Widget[];
  readonly toolbarBuilder?: ToolbarBuilder;
}
export class TextSelectionToolbar extends StatelessWidget {
  static readonly kHandleSize = 22;
  static readonly kToolbarContentDistanceBelow = 20;
  readonly anchorAbove: Offset;
  readonly anchorBelow: Offset;
  readonly children: readonly Widget[];
  readonly toolbarBuilder: ToolbarBuilder;
  constructor({
    anchorAbove,
    anchorBelow,
    children,
    toolbarBuilder = TextSelectionToolbar.defaultToolbarBuilder,
    key = null,
  }: TextSelectionToolbarOptions) {
    super(key);
    if (!children.length) throw new Error('TextSelectionToolbar requires children');
    this.anchorAbove = anchorAbove;
    this.anchorBelow = anchorBelow;
    this.children = Object.freeze([...children]);
    this.toolbarBuilder = toolbarBuilder;
  }
  static defaultToolbarBuilder(context: BuildContext, child: Widget): Widget {
    const colors = Theme.of(context).colorScheme,
      defaultSurface = colors.surface === (colors.brightness === 'dark' ? 0xff141218 : 0xfffef7ff),
      color = defaultSurface
        ? colors.brightness === 'dark'
          ? 0xff424242
          : 0xffffffff
        : colors.surface;
    return new PhysicalModel({
      color,
      elevation: 1,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: 'antiAlias',
      child,
    });
  }
  build(context: BuildContext): Widget {
    const above = this.anchorAbove.subtract(new Offset(0, 8)),
      below = this.anchorBelow.add(new Offset(0, 20)),
      top = MediaQuery.of(context).safeArea.top + 8,
      adjustment = new Offset(8, top),
      fitsAbove = 44 <= above.dy - 8 - top;
    return new Padding(
      {
        left: 8,
        top,
        right: 8,
        bottom: 8,
      },
      new CustomSingleChildLayout(
        new ToolbarOverflow({
          children: this.children,
          isAbove: fitsAbove,
          toolbarBuilder: this.toolbarBuilder,
        }),
        new TextSelectionToolbarLayoutDelegate({
          anchorAbove: above.subtract(adjustment),
          anchorBelow: below.subtract(adjustment),
          fitsAbove,
        }),
      ),
    );
  }
}
class ToolbarOverflow extends StatefulWidget {
  readonly children: readonly Widget[];
  readonly isAbove: boolean;
  readonly toolbarBuilder: ToolbarBuilder;
  constructor(options: {
    readonly children: readonly Widget[];
    readonly isAbove: boolean;
    readonly toolbarBuilder: ToolbarBuilder;
  }) {
    super();
    this.children = options.children;
    this.isAbove = options.isAbove;
    this.toolbarBuilder = options.toolbarBuilder;
  }
  createState(): State<ToolbarOverflow> {
    return new ToolbarOverflowState();
  }
}
class ToolbarOverflowState extends State<ToolbarOverflow> {
  private open = false;
  private containerKey = new UniqueKey();
  override didUpdateWidget(old: ToolbarOverflow): void {
    super.didUpdateWidget(old);
    if (
      old.children.length !== this.widget.children.length ||
      old.children.some((child, i) => child !== this.widget.children[i])
    ) {
      this.open = false;
      this.containerKey = new UniqueKey();
    }
  }
  build(context: BuildContext): Widget {
    const localizations = MaterialLocalizations.of(context),
      label = this.open ? localizations.backButtonTooltip : localizations.moreButtonTooltip,
      direction = Directionality.of(context),
      nav = new GestureDetector(
        new ConstrainedBox(
          new Text(this.open ? '←' : '⋮', {
            fontSize: 22,
            color: Theme.of(context).colorScheme.onSurface,
          }),
          BoxConstraints.tightFor(48, 44),
        ),
        {
          onTap: () =>
            this.setState(() => {
              this.open = !this.open;
            }),
          label,
          semanticsId: 'selection-toolbar-overflow',
        },
      );
    return new TrailingEdgeAlign(
      new AnimatedSize({
        duration: 140,
        child: this.widget.toolbarBuilder(
          context,
          new ToolbarItems(
            [nav, ...this.widget.children],
            this.open,
            this.widget.isAbove,
            direction,
          ),
        ),
      }),
      this.open,
      direction,
      this.containerKey,
    );
  }
}
class TrailingEdgeAlign extends SingleChildRenderObjectWidget {
  constructor(
    child: Widget,
    readonly open: boolean,
    readonly direction: 'ltr' | 'rtl',
    key: UniqueKey,
  ) {
    super(child, { key });
  }
  createRenderObject(): RenderTrailingEdgeAlign {
    return new RenderTrailingEdgeAlign(this.open, this.direction);
  }
  updateRenderObject(_context: BuildContext, render: RenderObject): void {
    if (!(render instanceof RenderTrailingEdgeAlign))
      throw new Error('Wrong trailing edge renderer');
    render.configure(this.open, this.direction);
  }
}
class RenderTrailingEdgeAlign extends RenderProxyBox {
  private closedWidth: number | null = null;
  constructor(
    private open: boolean,
    private direction: 'ltr' | 'rtl',
  ) {
    super();
  }
  configure(open: boolean, direction: 'ltr' | 'rtl'): void {
    this.assertCanMutateLayoutProperty();
    if (this.open !== open || this.direction !== direction) {
      this.open = open;
      this.direction = direction;
      this.markNeedsLayout();
    }
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    if (!this.child) return constraints.smallest;
    this.child.layout(constraints.loosen(), { parentUsesSize: true });
    if (!this.open && this.closedWidth === null) this.closedWidth = this.child.size.width;
    const size = constraints.constrain({
      width: Math.max(this.closedWidth ?? 0, this.child.size.width),
      height: this.child.size.height,
    });
    this.child.layoutOffset = {
      x: this.direction === 'rtl' ? 0 : size.width - this.child.size.width,
      y: 0,
    };
    return size;
  }
}
class ToolbarItems extends MultiChildRenderObjectWidget {
  constructor(
    children: readonly Widget[],
    readonly open: boolean,
    readonly above: boolean,
    readonly direction: 'ltr' | 'rtl',
  ) {
    super(children);
  }
  createRenderObject(): RenderToolbarItems {
    return new RenderToolbarItems(this.open, this.above, this.direction);
  }
  updateRenderObject(_context: BuildContext, render: RenderObject): void {
    if (!(render instanceof RenderToolbarItems)) throw new Error('Wrong toolbar renderer');
    render.configure(this.open, this.above, this.direction);
  }
}
/** Source Material overflow layout; hidden children cannot paint, hit, or expose semantics. */
class RenderToolbarItems extends RenderBox {
  private visible = new Set<RenderObject>();
  constructor(
    private open: boolean,
    private above: boolean,
    private direction: 'ltr' | 'rtl',
  ) {
    super();
  }
  configure(open: boolean, above: boolean, direction: 'ltr' | 'rtl'): void {
    this.assertCanMutateLayoutProperty();
    if (open !== this.open || above !== this.above || direction !== this.direction) {
      this.open = open;
      this.above = above;
      this.direction = direction;
      this.markNeedsLayout();
    }
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    const children = this.children,
      nav = children[0];
    this.visible.clear();
    if (!nav) return constraints.smallest;
    const sized = this.open
      ? constraints.loosen()
      : new BoxConstraints(0, constraints.maxWidth, 0, Math.min(44, constraints.maxHeight));
    let width = 0,
      last = -1;
    for (let i = 0; i < children.length; i++) {
      if (last !== -1 && !this.open) break;
      const child = children[i]!;
      child.layout(sized, { parentUsesSize: true });
      width += child.size.width;
      if (width > sized.maxWidth && last === -1) last = i - 1;
    }
    if (last !== -1 && last === children.length - 2 && width - nav.size.width <= sized.maxWidth)
      last = -1;
    for (let i = 0; i < children.length; i++)
      if (i === 0 ? last !== -1 : last === -1 || i > last === this.open)
        this.visible.add(children[i]!);
    const content = children.slice(1).filter((child) => this.visible.has(child));
    let result: Size;
    if (this.open) {
      let y = 0,
        max = 0;
      if (!this.above && this.visible.has(nav)) {
        nav.layoutOffset = { x: 0, y };
        y += nav.size.height;
        max = nav.size.width;
      }
      for (const child of content) {
        child.layoutOffset = { x: 0, y };
        y += child.size.height;
        max = Math.max(max, child.size.width);
      }
      if (this.above && this.visible.has(nav)) {
        nav.layoutOffset = { x: 0, y };
        y += nav.size.height;
        max = Math.max(max, nav.size.width);
      }
      result = constraints.constrain({ width: max, height: y });
      for (const child of content)
        child.layout(new BoxConstraints(result.width, result.width, 0, constraints.maxHeight), {
          parentUsesSize: true,
        });
    } else {
      let total = this.visible.has(nav) ? nav.size.width : 0,
        height = this.visible.has(nav) ? nav.size.height : 0;
      for (const child of content) {
        total += child.size.width;
        height = Math.max(height, child.size.height);
      }
      let x = this.direction === 'rtl' ? total : 0;
      for (const child of content) {
        if (this.direction === 'rtl') x -= child.size.width;
        child.layoutOffset = { x, y: 0 };
        if (this.direction === 'ltr') x += child.size.width;
      }
      nav.layoutOffset = { x: this.direction === 'rtl' ? 0 : x, y: 0 };
      result = constraints.constrain({ width: total, height });
    }
    return result;
  }
  override paint(context: PaintingContext): void {
    for (const child of this.children)
      if (this.visible.has(child)) context.paintChild(child, this.childTransform(child));
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
    clip?: Rect,
  ): void {
    for (const child of this.children)
      if (this.visible.has(child))
        child.collectSemantics(output, multiply(matrix, this.childTransform(child)), clip);
  }
}
