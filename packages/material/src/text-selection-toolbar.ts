// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/text_selection_toolbar.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
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
import { Padding } from '@nelyx/core/framework/widgets/basic';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import {
  RenderTextSelectionToolbarItem,
  TextSelectionToolbarItem,
  TextSelectionToolbarLayoutDelegate,
} from '@nelyx/core/framework/widgets/text-selection-toolbar-layout-delegate';
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
import { Color } from '@nelyx/core/ui/color';
import { CupertinoTextSelectionToolbar } from '@nelyx/cupertino/text-selection-toolbar';
import { IconButton } from './icon-button.ts';
import { Icons } from './icons.ts';
import { defaultMaterialColorScheme } from './internal/theme/default-color-schemes.ts';
import { Material, MaterialType } from './material.ts';
import { Theme } from './theme.ts';
import { MaterialLocalizations } from './material-localizations.ts';

const toolbarHeight = 44;
const toolbarContentDistance = 8;

export type ToolbarBuilder = (context: BuildContext, child: Widget) => Widget;
export interface TextSelectionToolbarOptions extends WidgetOptions {
  readonly anchorAbove: Offset;
  readonly anchorBelow: Offset;
  readonly children: readonly Widget[];
  readonly toolbarBuilder?: ToolbarBuilder;
}
export class TextSelectionToolbar extends StatelessWidget {
  static readonly kHandleSize = 22;
  static readonly kToolbarContentDistanceBelow = TextSelectionToolbar.kHandleSize - 2;
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
      defaultSurface = colors.surface === defaultMaterialColorScheme(colors.brightness).surface,
      color = defaultSurface
        ? colors.brightness === 'dark'
          ? 0xff424242
          : 0xffffffff
        : colors.surface;
    return new Material({
      type: MaterialType.card,
      color: new Color(color),
      elevation: 1,
      borderRadius: BorderRadius.circular(toolbarHeight / 2),
      clipBehavior: 'antiAlias',
      child,
    });
  }
  build(context: BuildContext): Widget {
    const screenPadding = CupertinoTextSelectionToolbar.kToolbarScreenPadding;
    const above = this.anchorAbove.subtract(new Offset(0, toolbarContentDistance)),
      below = this.anchorBelow.add(
        new Offset(0, TextSelectionToolbar.kToolbarContentDistanceBelow),
      ),
      top = MediaQuery.paddingOf(context).top + screenPadding,
      adjustment = new Offset(screenPadding, top),
      fitsAbove = toolbarHeight <= above.dy - toolbarContentDistance - top;
    return new Padding(
      {
        left: screenPadding,
        top,
        right: screenPadding,
        bottom: screenPadding,
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
      nav = new Material({
        type: MaterialType.card,
        color: new Color(0),
        child: new IconButton({
          icon: new Icon(this.open ? Icons.arrow_back : Icons.more_vert),
          onPressed: () =>
            this.setState(() => {
              this.open = !this.open;
            }),
          tooltip: label,
        }),
      });
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
    super(children.map((child) => new TextSelectionToolbarItem(child)));
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
    const before = this.visible;
    this.visible = new Set();
    if (!nav) return constraints.smallest;
    const sized = this.open
      ? constraints.loosen()
      : new BoxConstraints(
          0,
          constraints.maxWidth,
          0,
          Math.min(toolbarHeight, constraints.maxHeight),
        );
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
    for (const [i, child] of children.entries()) {
      const visible = i === 0 ? last !== -1 : last === -1 || i > last === this.open;
      if (visible) this.visible.add(child);
      if (child instanceof RenderTextSelectionToolbarItem) child.setVisible(visible);
    }
    if (
      before.size !== this.visible.size ||
      [...before].some((child) => !this.visible.has(child))
    ) {
      this.markNeedsSemanticsUpdate();
    }
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
  override paintsChild(child: RenderObject): boolean {
    return this.visible.has(child);
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
