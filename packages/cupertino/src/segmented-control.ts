// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { valueEquals } from '@nelyx/core/framework/painting/value-equality';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Center, Padding } from '@nelyx/core/framework/widgets/basic';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Focus } from '@nelyx/core/framework/widgets/focus-scope';
import {
  Element,
  MultiChildRenderObjectWidget,
  State,
  StatefulWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import { UnconstrainedBox } from '@nelyx/core/framework/widgets/overflow-box';
import { RadioGroup } from '@nelyx/core/framework/widgets/radio-group';
import type { RadioClient, RadioGroupRegistry } from '@nelyx/core/framework/widgets/radio-group';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SingleActivator } from '@nelyx/core/framework/widgets/shortcuts';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { Paint } from '@nelyx/core/ui/paint';
import { Radius } from '@nelyx/core/ui/radius';
import { Rect } from '@nelyx/core/ui/rect';
import { RRect } from '@nelyx/core/ui/rrect';
import type { TextBaseline } from '@nelyx/core/ui/typography';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import { CupertinoTheme } from './theme.ts';

const noDisabledChildren = new Set<never>();
const defaultPadding = EdgeInsets.symmetric({ horizontal: 16 });
const defaultDisabledText = new Color(0x737a7a7a);
const corner = Radius.circular(3);
const activateSegment = new SingleActivator(LogicalKeyboardKey.space);

export interface CupertinoSegmentedControlOptions<T extends {}> extends WidgetOptions {
  readonly children: ReadonlyMap<T, Widget>;
  readonly onValueChanged: (value: T) => void;
  readonly groupValue?: T | null;
  readonly disabledChildren?: ReadonlySet<T>;
  readonly selectedColor?: CupertinoColor | null;
  readonly unselectedColor?: CupertinoColor | null;
  readonly borderColor?: CupertinoColor | null;
  readonly pressedColor?: CupertinoColor | null;
  readonly disabledColor?: CupertinoColor | null;
  readonly disabledTextColor?: CupertinoColor | null;
  readonly padding?: EdgeInsetsGeometry | null;
}

/** Classic bordered segmented control. Selection is owned by the caller. */
export class CupertinoSegmentedControl<T extends {}> extends StatefulWidget {
  constructor(readonly options: CupertinoSegmentedControlOptions<T>) {
    super(options.key ?? null);
    if (
      options.children.size < 2 ||
      (options.groupValue != null &&
        ![...options.children.keys()].some((value) => valueEquals(value, options.groupValue)))
    ) {
      throw new RangeError(
        'CupertinoSegmentedControl requires two or more segments and a valid groupValue',
      );
    }
  }

  get children(): ReadonlyMap<T, Widget> {
    return this.options.children;
  }
  get groupValue(): T | null {
    return this.options.groupValue ?? null;
  }
  get onValueChanged(): (value: T) => void {
    return this.options.onValueChanged;
  }
  get disabledChildren(): ReadonlySet<T> {
    return this.options.disabledChildren ?? noDisabledChildren;
  }
  get selectedColor(): CupertinoColor | null {
    return this.options.selectedColor ?? null;
  }
  get unselectedColor(): CupertinoColor | null {
    return this.options.unselectedColor ?? null;
  }
  get borderColor(): CupertinoColor | null {
    return this.options.borderColor ?? null;
  }
  get pressedColor(): CupertinoColor | null {
    return this.options.pressedColor ?? null;
  }
  get disabledColor(): CupertinoColor | null {
    return this.options.disabledColor ?? null;
  }
  get disabledTextColor(): CupertinoColor | null {
    return this.options.disabledTextColor ?? null;
  }
  get padding(): EdgeInsetsGeometry | null {
    return this.options.padding ?? null;
  }

  createState(): State<CupertinoSegmentedControl<T>> {
    return new SegmentedControlState<T>();
  }
}

class SegmentButton extends StatefulWidget {
  constructor(
    readonly token: object,
    readonly value: number,
    readonly enabled: boolean,
    readonly child: Widget,
    key: GlobalKey<SegmentButtonState>,
  ) {
    super(key);
  }
  createState(): SegmentButtonState {
    return new SegmentButtonState();
  }
}

class SegmentButtonState extends State<SegmentButton> implements RadioClient<number> {
  private registry: RadioGroupRegistry<number> | null = null;
  readonly focusNode = new FocusNode({ debugLabel: 'Cupertino bordered segment' });
  readonly tristate = false;
  get enabled(): boolean {
    return this.widget.enabled;
  }
  get radioValue(): number {
    return this.widget.value;
  }
  build(context: BuildContext): Widget {
    const registry = this.enabled ? RadioGroup.maybeOf<number>(context, this.widget.token) : null;
    if (this.registry !== registry) {
      this.registry?.unregisterClient(this);
      this.registry = registry;
      registry?.registerClient(this);
    }
    return new Focus(this.widget.child, {
      focusNode: this.focusNode,
      canRequestFocus: this.enabled,
      onKeyEvent: (_node, event) => {
        // Core's RadioGroup supplies arrows and traversal, but not Space activation.
        const registry = this.registry;
        if (!registry || !activateSegment.accepts(event, (context as Element).owner.keyboard))
          return 'ignored';
        if (registry.groupValue !== this.radioValue) registry.onChanged(this.radioValue);
        return 'handled';
      },
    });
  }
  override dispose(): void {
    this.registry?.unregisterClient(this);
    this.focusNode.dispose();
    super.dispose();
  }
}

interface Segment<T> {
  value: T;
  readonly radioId: number;
  readonly key: GlobalKey<SegmentButtonState>;
  readonly animation: AnimationController;
  selected: boolean;
}

class SegmentedControlState<T extends {}> extends TickerProviderStateMixin<
  CupertinoSegmentedControl<T>
> {
  private readonly groupToken = {};
  private nextRadioId = 0;
  private segments: Segment<T>[] = [];
  private lastColors: readonly Color[] = [];
  private pressed: Segment<T> | null = null;
  private reduceMotion = false;

  private disabled(value: T): boolean {
    const disabled = this.widget.options.disabledChildren;
    return disabled !== undefined && [...disabled].some((entry) => valueEquals(entry, value));
  }

  private setPressed(segment: Segment<T> | null): void {
    if (this.pressed !== segment)
      this.setState(() => {
        this.pressed = segment;
      });
  }

  private request(segment: Segment<T>): void {
    if (this.disabled(segment.value)) return;
    segment.key.currentState?.focusNode.requestFocus();
    if (!segment.selected) this.widget.options.onValueChanged(segment.value);
  }

  private syncSegments(values: readonly T[], groupValue: T | null, colors: readonly Color[]): void {
    const previous = this.segments;
    const reset =
      previous.length !== values.length ||
      !colors.every((color, index) => color.equals(this.lastColors[index]));
    this.lastColors = colors;
    this.segments = values.map((value) => {
      const selected = valueEquals(value, groupValue);
      const existing = previous.find((segment) => valueEquals(value, segment.value));
      if (existing) {
        existing.value = value;
        if (reset) existing.animation.value = selected ? 1 : 0;
        else if (existing.selected !== selected) {
          if (selected) existing.animation.forward();
          else existing.animation.reverse();
        }
        existing.selected = selected;
        return existing;
      }
      const animation = new AnimationController({
        vsync: this,
        duration: 165,
        value: selected ? 1 : 0,
        disableAnimations: () => this.reduceMotion,
      });
      animation.addListener(() => this.setState(() => {}));
      return { value, radioId: this.nextRadioId++, key: new GlobalKey(), animation, selected };
    });
    for (const segment of previous)
      if (!this.segments.includes(segment)) segment.animation.dispose();
    if (
      this.pressed &&
      (!this.segments.includes(this.pressed) || this.disabled(this.pressed.value))
    )
      this.pressed = null;
  }

  override dispose(): void {
    for (const segment of this.segments) segment.animation.dispose();
    super.dispose();
  }

  build(context: BuildContext): Widget {
    const options = this.widget.options;
    const theme = CupertinoTheme.of(context);
    const primary = new Color(theme.primaryColor);
    const resolve = (color: CupertinoColor | null | undefined, fallback: Color) =>
      color == null ? fallback : resolveCupertinoColor(color, context);
    const selected = resolve(options.selectedColor, primary);
    const unselected = resolve(options.unselectedColor, new Color(theme.primaryContrastingColor));
    const border = resolve(options.borderColor, primary);
    const pressed = resolve(options.pressedColor, primary.withOpacity(0.2));
    const disabledSelected = resolve(options.disabledColor, selected.withOpacity(0.5));
    const disabledUnselected = resolve(options.disabledColor, unselected);
    const disabledText = resolve(options.disabledTextColor, defaultDisabledText);
    const groupValue = options.groupValue ?? null;
    const entries = [...options.children];
    this.reduceMotion = context.maybeDependOn(MediaQuery)?.data.disableAnimations ?? false;
    this.syncSegments(
      entries.map(([value]) => value),
      groupValue,
      [selected, unselected, border, pressed, disabledSelected, disabledUnselected, disabledText],
    );
    const inheritedStyle = DefaultTextStyle.of(context)?.style ?? new TextStyle();
    const background: Color[] = [];
    const children = entries.map(([, child], index) => {
      const segment = this.segments[index]!;
      const disabled = this.disabled(segment.value);
      const { selected: active, animation } = segment;
      const text = disabled
        ? disabledText
        : animation.isAnimating
          ? Color.lerp(selected, unselected, animation.value)!
          : active
            ? unselected
            : selected;
      background.push(
        disabled
          ? active
            ? disabledSelected
            : disabledUnselected
          : animation.isAnimating
            ? Color.lerp(active ? pressed : unselected, selected, animation.value)!
            : active
              ? selected
              : this.pressed === segment
                ? pressed
                : unselected,
      );
      const label = new IconTheme(
        new IconThemeData({ color: text }),
        new DefaultTextStyle(
          inheritedStyle.copyWith({ color: text.toARGB32() }),
          new Center(child),
        ),
      );
      return new SegmentButton(
        this.groupToken,
        segment.radioId,
        !disabled,
        new MouseRegion(
          new GestureDetector(
            new Semantics({
              button: true,
              enabled: !disabled,
              selected: active,
              inMutuallyExclusiveGroup: true,
              onTap: disabled ? null : () => this.request(segment),
              child: label,
            }),
            {
              behavior: HitTestBehavior.opaque,
              excludeFromSemantics: true,
              onTapDown: disabled
                ? null
                : () => {
                    if (this.pressed === null && !segment.selected) this.setPressed(segment);
                  },
              onTapCancel: disabled ? null : () => this.setPressed(null),
              onTap: () => {
                if (disabled) return;
                if (this.pressed === segment) {
                  this.setPressed(null);
                  this.request(segment);
                } else {
                  segment.key.currentState?.focusNode.requestFocus();
                }
              },
            },
          ),
          FoundationPlatform.hostEnvironment.kind === 'web'
            ? { cursor: SystemMouseCursors.click }
            : {},
        ),
        segment.key,
      );
    });
    return new RadioGroup({
      typeToken: this.groupToken,
      groupValue: this.segments.find((segment) => segment.selected)?.radioId ?? null,
      onChanged: (id) => {
        const segment = this.segments.find((entry) => entry.radioId === id);
        if (segment && !this.disabled(segment.value)) options.onValueChanged(segment.value);
      },
      child: new Padding(
        options.padding ?? defaultPadding,
        new UnconstrainedBox(
          new SegmentStrip(children, Directionality.of(context) === 'rtl', background, border),
          { constrainedAxis: 'horizontal' },
        ),
      ),
    });
  }
}

class SegmentStrip extends MultiChildRenderObjectWidget {
  constructor(
    children: readonly Widget[],
    readonly rtl: boolean,
    readonly background: readonly Color[],
    readonly border: Color,
  ) {
    super(children);
  }
  createRenderObject(): RenderSegmentStrip {
    return new RenderSegmentStrip(this);
  }
  updateRenderObject(_context: BuildContext, render: RenderSegmentStrip): void {
    render.update(this);
  }
}

class RenderSegmentStrip extends RenderBox {
  constructor(private style: SegmentStrip) {
    super();
  }
  update(style: SegmentStrip): void {
    if (this.style.rtl !== style.rtl) this.markNeedsLayout();
    this.style = style;
    this.markNeedsPaint();
  }
  protected override computeMinIntrinsicWidth(height: number): number {
    return (
      Math.max(0, ...this.children.map((child) => child.getMinIntrinsicWidth(height))) *
      this.children.length
    );
  }
  protected override computeMaxIntrinsicWidth(height: number): number {
    return (
      Math.max(0, ...this.children.map((child) => child.getMaxIntrinsicWidth(height))) *
      this.children.length
    );
  }
  protected override computeMinIntrinsicHeight(width: number): number {
    return Math.max(0, ...this.children.map((child) => child.getMinIntrinsicHeight(width)));
  }
  protected override computeMaxIntrinsicHeight(width: number): number {
    return Math.max(0, ...this.children.map((child) => child.getMaxIntrinsicHeight(width)));
  }
  private measure(constraints: BoxConstraints): Size {
    const count = this.children.length;
    const width = Math.min(
      constraints.maxWidth / count,
      Math.max(
        constraints.minWidth / count,
        ...this.children.map((child) => child.getMaxIntrinsicWidth(Infinity)),
      ),
    );
    return { width, height: Math.max(28, this.computeMaxIntrinsicHeight(width)) };
  }
  protected override computeDryLayout(constraints: BoxConstraints): Size {
    const { width, height } = this.measure(constraints);
    return constraints.constrain({ width: width * this.children.length, height });
  }
  private highestBaseline(query: (child: RenderBox<RenderObject>) => number | null): number | null {
    let result: number | null = null;
    for (const child of this.children) {
      const baseline = query(child);
      if (baseline !== null) result = result === null ? baseline : Math.min(result, baseline);
    }
    return result;
  }
  protected override computeDryBaseline(
    constraints: BoxConstraints,
    baseline: TextBaseline,
  ): number | null {
    const { width, height } = this.measure(constraints);
    const tight = BoxConstraints.tightFor(width, height);
    return this.highestBaseline((child) => child.getDryBaseline(tight, baseline));
  }
  protected override computeDistanceToActualBaseline(baseline: TextBaseline): number | null {
    return this.highestBaseline((child) => child.getDistanceToActualBaseline(baseline));
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    const { width, height } = this.measure(constraints);
    const tight = BoxConstraints.tightFor(width, height);
    const count = this.children.length;
    this.children.forEach((child, index) => {
      child.layout(tight, { parentUsesSize: true });
      child.layoutOffset = { x: (this.style.rtl ? count - 1 - index : index) * width, y: 0 };
    });
    return constraints.constrain({ width: width * count, height });
  }
  override paint(context: PaintingContext): void {
    const { rtl, background, border } = this.style;
    const stroke = new Paint({ color: border.toARGB32(), style: 'stroke', strokeWidth: 1 });
    const last = this.children.length - 1;
    this.children.forEach((child, index) => {
      const { width, height } = child.size;
      if (width > 0 && height > 0) {
        const rect = Rect.fromLTWH(child.layoutOffset.x, 0, width, height);
        const shape = RRect.fromRectAndCorners(
          rect,
          index === (rtl ? last : 0)
            ? { topLeft: corner, bottomLeft: corner }
            : index === (rtl ? 0 : last)
              ? { topRight: corner, bottomRight: corner }
              : {},
        );
        context.canvas.drawRRect(shape, new Paint({ color: background[index]!.toARGB32() }));
        context.canvas.drawRRect(shape, stroke);
      }
      this.paintChild(context, child);
    });
  }
}
