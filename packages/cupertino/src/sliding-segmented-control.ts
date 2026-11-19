// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { valueEquals } from '@nelyx/core/framework/painting/value-equality';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Center, Padding } from '@nelyx/core/framework/widgets/basic';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { Focus } from '@nelyx/core/framework/widgets/focus-scope';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import type { FocusOptions } from '@nelyx/core/framework/widgets/focus-scope';
import {
  MultiChildRenderObjectWidget,
  State,
  StatefulWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { MergeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { KeyDownEvent } from '@nelyx/core/services/hardware-keyboard';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { Color } from '@nelyx/core/ui/color';
import type { Offset, Size } from '@nelyx/core/ui/geometry';
import { Paint } from '@nelyx/core/ui/paint';
import { Rect } from '@nelyx/core/ui/rect';
import { FontWeight } from '@nelyx/core/ui/typography';
import { CupertinoColors, CupertinoDynamicColor } from './colors.ts';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';

const defaultThumbColor = CupertinoDynamicColor.withBrightness({
  color: new Color(0xffffffff),
  darkColor: new Color(0xff636366),
});
const defaultPadding = EdgeInsets.symmetric({ horizontal: 3, vertical: 2 });
const labelPadding = EdgeInsets.symmetric({ horizontal: 10 });
const separatorPaint = new Paint({ color: 0x4d8e8e93 });
const none = new Set<never>();

export interface CupertinoSlidingSegmentedControlOptions<T extends {}> extends WidgetOptions {
  readonly children: ReadonlyMap<T, Widget>;
  readonly onValueChanged: (value: T | null) => void;
  readonly disabledChildren?: ReadonlySet<T>;
  readonly groupValue?: T | null;
  readonly backgroundColor?: CupertinoColor;
  readonly proportionalWidth?: boolean;
  readonly thumbColor?: CupertinoColor;
  readonly padding?: EdgeInsetsGeometry;
  readonly isMomentary?: boolean;
}

export class CupertinoSlidingSegmentedControl<T extends {}> extends StatefulWidget {
  readonly children: ReadonlyMap<T, Widget>;
  readonly onValueChanged: (value: T | null) => void;
  readonly disabledChildren: ReadonlySet<T>;
  readonly groupValue: T | null;
  readonly backgroundColor: CupertinoColor;
  readonly proportionalWidth: boolean;
  readonly thumbColor: CupertinoColor;
  readonly padding: EdgeInsetsGeometry;
  readonly isMomentary: boolean;

  constructor({
    children,
    onValueChanged,
    disabledChildren = none,
    groupValue = null,
    backgroundColor = CupertinoColors.tertiarySystemFill,
    proportionalWidth = false,
    thumbColor = defaultThumbColor,
    padding = defaultPadding,
    isMomentary = false,
    key = null,
  }: CupertinoSlidingSegmentedControlOptions<T>) {
    super(key);
    if (
      children.size < 2 ||
      (groupValue !== null && ![...children.keys()].some((value) => valueEquals(value, groupValue)))
    ) {
      throw new RangeError(
        'CupertinoSlidingSegmentedControl requires two or more segments and a valid groupValue',
      );
    }
    this.children = children;
    this.onValueChanged = onValueChanged;
    this.disabledChildren = disabledChildren;
    this.groupValue = groupValue;
    this.backgroundColor = backgroundColor;
    this.proportionalWidth = proportionalWidth;
    this.thumbColor = thumbColor;
    this.padding = padding;
    this.isMomentary = isMomentary;
  }

  createState(): State<CupertinoSlidingSegmentedControl<T>> {
    return new SlidingControlState<T>();
  }
}

class FocusedSegment extends StatefulWidget {
  constructor(
    readonly child: Widget,
    readonly options: FocusOptions,
    key: GlobalKey<FocusedSegmentState>,
  ) {
    super(key);
  }
  createState(): FocusedSegmentState {
    return new FocusedSegmentState();
  }
}

class FocusedSegmentState extends State<FocusedSegment> {
  readonly node = new FocusNode({ debugLabel: 'Cupertino sliding segment' });
  build(): Widget {
    return new MergeSemantics({
      child: new Focus(this.widget.child, { ...this.widget.options, focusNode: this.node }),
    });
  }
  override dispose(): void {
    this.node.dispose();
    super.dispose();
  }
}

class SlidingControlState<T extends {}> extends TickerProviderStateMixin<
  CupertinoSlidingSegmentedControl<T>
> {
  private readonly renderKey = new GlobalKey('Cupertino sliding segmented control');
  private pressed: T | null = null;
  private draggingThumb = false;
  private blockedDrag = false;
  private reduceMotion = false;
  private segmentKeys: { value: T; key: GlobalKey<FocusedSegmentState> }[] = [];
  private thumbProgress!: AnimationController;
  get render(): SlidingRender | null {
    const render = this.renderKey.currentContext?.findRenderObject();
    return render instanceof SlidingRender && render.hasSize ? render : null;
  }
  private readonly repaint = () => this.render?.markNeedsPaint();

  override initState(): void {
    super.initState();
    this.thumbProgress = new AnimationController({
      vsync: this,
      value: 1,
      duration: 412,
      disableAnimations: () => this.reduceMotion,
    });
    this.thumbProgress.addListener(this.repaint);
  }

  override dispose(): void {
    this.thumbProgress.dispose();
    super.dispose();
  }

  private disabled(value: T): boolean {
    return [...this.widget.disabledChildren].some((item) => valueEquals(item, value));
  }

  private choose(value: T, invokeSelected = false): void {
    if (!this.mounted || this.disabled(value)) return;
    const target = this.segmentKeys.find((entry) => valueEquals(entry.value, value));
    if (!target) return;
    target.key.currentState?.node.requestFocus();
    if (invokeSelected || !valueEquals(value, this.widget.groupValue))
      this.widget.onValueChanged(value);
  }

  private at(position: Offset): T | null {
    const render = this.render;
    if (render === null) return null;
    const local = render.globalToLocal(position);
    const dx = Math.max(-local.x, local.x - render.size.width, 0);
    const dy = Math.max(-local.y, local.y - render.size.height, 0);
    if (!this.draggingThumb && dx * dx + dy * dy > 2500) return null;
    const index = render.closestSegment(local.x);
    return [...this.widget.children.keys()][index] ?? null;
  }

  private setPressed(value: T | null): void {
    if (!valueEquals(value, this.pressed))
      this.setState(() => {
        this.pressed = value;
      });
  }

  private reset(): void {
    const changed = this.draggingThumb;
    this.draggingThumb = false;
    this.blockedDrag = false;
    if (changed || this.pressed !== null)
      this.setState(() => {
        this.pressed = null;
      });
  }

  private moveFocus(value: T, direction: number): void {
    const values = [...this.widget.children.keys()];
    const start = values.findIndex((candidate) => valueEquals(candidate, value));
    for (let step = 1; step < values.length; step++) {
      const next = values[(start + direction * step + values.length) % values.length]!;
      if (!this.disabled(next)) {
        this.choose(next);
        break;
      }
    }
  }

  build(context: BuildContext): Widget {
    const widget = this.widget;
    this.reduceMotion = context.maybeDependOn(MediaQuery)?.data.disableAnimations ?? false;
    const rtl = Directionality.of(context) === 'rtl';
    const visual = this.draggingThumb ? this.pressed : widget.groupValue;
    const values = [...widget.children.keys()];
    this.segmentKeys = values.map((value) => ({
      value,
      key:
        this.segmentKeys.find((entry) => valueEquals(entry.value, value))?.key ??
        new GlobalKey('Cupertino segment'),
    }));
    const highlighted = widget.isMomentary
      ? -1
      : values.findIndex((value) => valueEquals(value, visual));
    const children = [...widget.children].map(([value, child], i) => {
      const selected = valueEquals(widget.groupValue, value);
      const pressed = valueEquals(this.pressed, value);
      const disabled = this.disabled(value);
      const normalColor = resolveCupertinoColor(CupertinoColors.label, context);
      const color = disabled
        ? 0x737a7a7a
        : pressed && !this.draggingThumb
          ? normalColor.withOpacity(0.2).toARGB32()
          : normalColor.toARGB32();
      const label = DefaultTextStyle.merge(
        child,
        new TextStyle({
          color,
          fontSize: 13,
          fontWeight: valueEquals(visual, value) ? FontWeight.w600 : FontWeight.w500,
        }),
      );
      return new FocusedSegment(
        new Semantics({
          button: true,
          selected,
          enabled: !disabled,
          inMutuallyExclusiveGroup: true,
          onTap: disabled ? null : () => this.choose(value, true),
          child: new Padding(labelPadding, new Center(label)),
        }),
        {
          canRequestFocus: !disabled,
          onKeyEvent: (_node, event) => {
            if (!(event instanceof KeyDownEvent) || disabled) return 'ignored';
            const key = event.logicalKey;
            if (key === LogicalKeyboardKey.enter || key === LogicalKeyboardKey.space)
              this.choose(value, true);
            else if (key === LogicalKeyboardKey.arrowLeft) this.moveFocus(value, rtl ? 1 : -1);
            else if (key === LogicalKeyboardKey.arrowRight) this.moveFocus(value, rtl ? -1 : 1);
            else return 'ignored';
            return 'handled';
          },
        },
        this.segmentKeys[i]!.key,
      );
    });
    const strip = new SlidingStrip(children, this.renderKey, {
      rtl,
      highlighted,
      pressedIndex: values.findIndex((value) => valueEquals(value, this.pressed)),
      proportional: widget.proportionalWidth,
      padding: widget.padding.resolve(rtl ? 'rtl' : 'ltr'),
      thumb: resolveCupertinoColor(widget.thumbColor, context),
      background: resolveCupertinoColor(widget.backgroundColor, context),
      animation: this.thumbProgress,
    });
    return new GestureDetector(strip, {
      behavior: HitTestBehavior.opaque,
      excludeFromSemantics: true,
      onTapUp: ({ globalPosition }) => {
        const value = this.at(globalPosition);
        this.reset();
        if (value !== null) this.choose(value);
      },
      onHorizontalDragDown: ({ globalPosition }) => {
        const value = this.at(globalPosition);
        this.blockedDrag = value === null || this.disabled(value);
        this.draggingThumb = !this.blockedDrag && valueEquals(value, widget.groupValue);
        if (!this.blockedDrag) this.setPressed(value);
      },
      onHorizontalDragUpdate: ({ globalPosition }) => {
        if (this.blockedDrag) return;
        const value = this.at(globalPosition);
        if (value === null || !this.disabled(value)) this.setPressed(value);
      },
      onHorizontalDragEnd: () => {
        const value = this.pressed;
        this.reset();
        if (value !== null) this.choose(value);
      },
      onHorizontalDragCancel: () => this.reset(),
    });
  }
}

interface StripOptions {
  readonly rtl: boolean;
  readonly highlighted: number;
  readonly pressedIndex: number;
  readonly proportional: boolean;
  readonly padding: EdgeInsets;
  readonly thumb: Color;
  readonly background: Color;
  readonly animation: AnimationController;
}

class SlidingStrip extends MultiChildRenderObjectWidget {
  constructor(
    children: readonly Widget[],
    key: GlobalKey,
    readonly options: StripOptions,
  ) {
    super(children, { key });
  }
  createRenderObject(): SlidingRender {
    return new SlidingRender(this.options);
  }
  updateRenderObject(_context: BuildContext, render: SlidingRender): void {
    render.update(this.options);
  }
}

class SlidingRender extends RenderBox {
  private thumbFrom: Rect | null = null;
  private thumbTarget: Rect | null = null;
  constructor(private options: StripOptions) {
    super();
  }

  update(options: StripOptions): void {
    const old = this.options;
    this.options = options;
    if (
      old.rtl !== options.rtl ||
      old.proportional !== options.proportional ||
      !old.padding.equals(options.padding)
    )
      this.markNeedsLayout();
    if (old.highlighted !== options.highlighted) {
      this.thumbFrom = this.currentThumb();
      this.thumbTarget = this.targetThumb();
      if (this.thumbFrom !== null && this.thumbTarget !== null)
        options.animation.forward({ from: 0 });
    }
    this.markNeedsPaint();
  }

  private measure(constraints: BoxConstraints): { size: Size; widths: number[]; gap: number } {
    const { padding, proportional } = this.options;
    const count = this.children.length;
    const inner = constraints.deflate(padding);
    const gap = Math.min(1, inner.maxWidth / Math.max(count - 1, 1));
    const separators = Math.max(0, count - 1) * gap;
    const intrinsic = this.children.map((child) => child.getMaxIntrinsicWidth(Infinity));
    const maximum = Math.max(0, ...intrinsic);
    const requested = proportional ? intrinsic : intrinsic.map(() => maximum);
    const sum = requested.reduce((total, width) => total + width, 0);
    const available = Math.max(0, inner.constrainWidth(sum + separators) - separators);
    const widths = requested.map((width) =>
      sum > 0 ? (available * width) / sum : available / count,
    );
    const height = Math.max(
      28,
      ...this.children.map((child, i) => child.getMaxIntrinsicHeight(widths[i]!)),
    );
    return {
      size: constraints.constrain({
        width: available + separators + padding.horizontal,
        height: height + padding.vertical,
      }),
      widths,
      gap,
    };
  }

  protected override computeDryLayout(constraints: BoxConstraints): Size {
    return this.measure(constraints).size;
  }
  protected override computeMinIntrinsicWidth(height: number): number {
    return this.intrinsicWidth(height, (child, cross) => child.getMinIntrinsicWidth(cross));
  }
  protected override computeMaxIntrinsicWidth(height: number): number {
    return this.intrinsicWidth(height, (child, cross) => child.getMaxIntrinsicWidth(cross));
  }
  protected override computeMinIntrinsicHeight(width: number): number {
    return this.measure(new BoxConstraints(0, width)).size.height;
  }
  protected override computeMaxIntrinsicHeight(width: number): number {
    return this.computeMinIntrinsicHeight(width);
  }

  private intrinsicWidth(
    height: number,
    query: (child: RenderBox<RenderObject>, cross: number) => number,
  ): number {
    const { padding, proportional } = this.options;
    const widths = this.children.map((child) =>
      query(child, Math.max(0, height - padding.vertical)),
    );
    const childWidth = proportional
      ? widths.reduce((total, width) => total + width, 0)
      : Math.max(0, ...widths) * widths.length;
    return childWidth + Math.max(0, widths.length - 1) + padding.horizontal;
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    const { size, widths, gap } = this.measure(constraints);
    const { rtl, padding } = this.options;
    let x = rtl ? size.width - padding.right : padding.left;
    this.children.forEach((child, i) => {
      const width = widths[i]!;
      child.layout(BoxConstraints.tightFor(width, Math.max(0, size.height - padding.vertical)), {
        parentUsesSize: true,
      });
      child.layoutOffset = { x: rtl ? x - width : x, y: padding.top };
      x += (rtl ? -1 : 1) * (width + gap);
    });
    this.thumbTarget = this.targetThumb();
    return size;
  }

  closestSegment(x: number): number {
    let best = 0,
      distance = Infinity;
    this.children.forEach((child, i) => {
      const left = child.layoutOffset.x;
      const delta = Math.max(left - x, x - left - child.size.width, 0);
      if (delta < distance) {
        best = i;
        distance = delta;
      }
    });
    return best;
  }

  private targetThumb(): Rect | null {
    const child = this.children[this.options.highlighted];
    if (!child?.hasSize) return null;
    const { x, y } = child.layoutOffset;
    return Rect.fromLTWH(x + 1, y, Math.max(0, child.size.width - 2), child.size.height);
  }

  private currentThumb(): Rect | null {
    if (this.thumbTarget === null || this.thumbFrom === null) return this.thumbTarget;
    return Rect.lerp(
      this.thumbFrom,
      this.thumbTarget,
      Curves.easeOutCubic.transform(this.options.animation.value),
    );
  }

  override paint(context: PaintingContext): void {
    const { highlighted, pressedIndex, rtl, thumb, background } = this.options;
    context.drawRRect(
      Rect.fromLTWH(0, 0, this.size.width, this.size.height),
      9,
      new Paint({ color: background.toARGB32() }),
    );
    this.children.forEach((child, i) => {
      if (i === 0 || i === highlighted || i - 1 === highlighted || child.size.height <= 10) return;
      const { x, y } = child.layoutOffset;
      const left = rtl ? x + child.size.width : x - 1;
      context.drawRRect(Rect.fromLTWH(left, y + 5, 1, child.size.height - 10), 0.5, separatorPaint);
    });
    let thumbRect = this.currentThumb();
    if (thumbRect !== null && highlighted === pressedIndex)
      thumbRect = thumbRect.deflate(Math.min(thumbRect.width, thumbRect.height) * 0.025);
    if (thumbRect !== null && !thumbRect.isEmpty)
      context.drawRRect(thumbRect, 7, new Paint({ color: thumb.toARGB32() }));
    super.paint(context);
  }
}
