// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter packages/flutter/lib/src/material/segmented_button.dart
// at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { ValueKey } from '@nelyx/core/foundation/key';
import type { DartSet } from '@nelyx/core/foundation/dart-collections';
import { Axis } from '@nelyx/core/framework/painting/basic-types';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import type { OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { StadiumBorder } from '@nelyx/core/framework/painting/stadium-border';
import { valueEquals } from '@nelyx/core/framework/painting/value-equality';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import type { RenderObject, TextBaseline } from '@nelyx/core/framework/rendering/object';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Padding } from '@nelyx/core/framework/widgets/basic';
import {
  MultiChildRenderObjectWidget,
  State,
  StatefulWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import {
  ExcludeSemantics,
  MergeSemantics,
  Semantics,
} from '@nelyx/core/framework/widgets/semantics';
import {
  WidgetState,
  WidgetStatesController,
  emptyWidgetStateSet,
} from '@nelyx/core/framework/widgets/widget-state';
import { Color } from '@nelyx/core/ui/color';
import { Rect } from '@nelyx/core/ui/rect';
import { Size } from '@nelyx/core/ui/size';
import { ButtonStyle } from './button-style.ts';
import type { MaterialButtonOptions } from './button-style-button.ts';
import { Icons } from './icons.ts';
import { ButtonIconLabel } from './internal/button/icon-label.ts';
import {
  colorAll,
  colorProperty,
  doubleAll,
  insetsAll,
  shapeAll,
  sizeAll,
  textAll,
} from './internal/button/style-properties.ts';
import { SegmentedButtonTheme } from './segmented-button-theme.ts';
import { Material, MaterialType } from './material.ts';
import { TextButton } from './text-button.ts';
import type { TextButtonStyleFromOptions } from './text-button.ts';
import { TextButtonTheme } from './text-button-theme.ts';
import { Theme } from './theme.ts';
import { MaterialTapTargetSize } from './theme-data.ts';
import { Tooltip } from './tooltip.ts';

export interface ButtonSegmentOptions<T> {
  readonly value: T;
  readonly icon?: Widget | null;
  readonly label?: Widget | null;
  readonly tooltip?: string | null;
  readonly enabled?: boolean;
}

export class ButtonSegment<T> {
  readonly value: T;
  readonly icon: Widget | null;
  readonly label: Widget | null;
  readonly tooltip: string | null;
  readonly enabled: boolean;

  constructor({
    value,
    icon = null,
    label = null,
    tooltip = null,
    enabled = true,
  }: ButtonSegmentOptions<T>) {
    if (icon === null && label === null)
      throw new TypeError('ButtonSegment requires an icon or a label');
    this.value = value;
    this.icon = icon;
    this.label = label;
    this.tooltip = tooltip;
    this.enabled = enabled;
  }
}

export interface SegmentedButtonOptions<T> extends WidgetOptions {
  readonly segments: readonly ButtonSegment<T>[];
  readonly selected: ReadonlySet<T>;
  readonly onSelectionChanged?: ((selected: Set<T>) => void) | null;
  readonly multiSelectionEnabled?: boolean;
  readonly emptySelectionAllowed?: boolean;
  readonly expandedInsets?: EdgeInsets | null;
  readonly style?: ButtonStyle | null;
  readonly showSelectedIcon?: boolean;
  readonly selectedIcon?: Widget | null;
  readonly direction?: Axis;
}

export interface SegmentedButtonStyleFromOptions extends Omit<
  TextButtonStyleFromOptions,
  'iconAlignment' | 'backgroundBuilder' | 'foregroundBuilder'
> {
  readonly selectedForegroundColor?: Color | null;
  readonly selectedBackgroundColor?: Color | null;
}

const transparent = new Color(0x00000000);
const squareShape = shapeAll(new RoundedRectangleBorder());
const enabledStates = emptyWidgetStateSet();
const disabledStates = emptyWidgetStateSet();
disabledStates.add(WidgetState.disabled);
const buttonIconInsets = EdgeInsetsDirectional.fromSTEB(12, 8, 16, 8);
const smallIconInsets = EdgeInsets.symmetric({ horizontal: 4 });
const defaultIcon = () => new Icon(Icons.check);

function stateColor(enabled: Color | null, disabled: Color | null, selected: Color | null) {
  return enabled === null && selected === null && disabled === null
    ? null
    : colorProperty((states) => {
        if (states.contains(WidgetState.disabled)) return disabled;
        return states.contains(WidgetState.selected) ? selected : enabled;
      });
}

function interactiveColor(
  states: DartSet<WidgetState>,
  color: Color | null,
  otherwise: Color | null,
) {
  if (states.contains(WidgetState.pressed)) return color?.withOpacity(0.1) ?? null;
  if (states.contains(WidgetState.hovered)) return color?.withOpacity(0.08) ?? null;
  if (states.contains(WidgetState.focused)) return color?.withOpacity(0.1) ?? null;
  return otherwise;
}

export class SegmentedButton<T> extends StatefulWidget {
  readonly segments: readonly ButtonSegment<T>[];
  readonly selected: ReadonlySet<T>;
  readonly onSelectionChanged: ((selected: Set<T>) => void) | null;
  readonly multiSelectionEnabled: boolean;
  readonly emptySelectionAllowed: boolean;
  readonly expandedInsets: EdgeInsets | null;
  readonly style: ButtonStyle | null;
  readonly showSelectedIcon: boolean;
  readonly selectedIcon: Widget | null;
  readonly direction: Axis;

  constructor({
    key = null,
    segments,
    selected,
    onSelectionChanged = null,
    multiSelectionEnabled = false,
    emptySelectionAllowed = false,
    expandedInsets = null,
    style = null,
    showSelectedIcon = true,
    selectedIcon = null,
    direction = Axis.horizontal,
  }: SegmentedButtonOptions<T>) {
    super(key);
    if (
      !segments.length ||
      (!selected.size && !emptySelectionAllowed) ||
      (selected.size > 1 && !multiSelectionEnabled)
    )
      throw new RangeError(
        'SegmentedButton requires segments and a selection matching its selection mode',
      );
    this.segments = segments;
    this.selected = selected;
    this.onSelectionChanged = onSelectionChanged;
    this.multiSelectionEnabled = multiSelectionEnabled;
    this.emptySelectionAllowed = emptySelectionAllowed;
    this.expandedInsets = expandedInsets;
    this.style = style;
    this.showSelectedIcon = showSelectedIcon;
    this.selectedIcon = selectedIcon;
    this.direction = direction;
  }

  /** @dartParam iconSize double?
   * @dartParam elevation double? */
  static styleFrom({
    foregroundColor = null,
    selectedForegroundColor = null,
    disabledForegroundColor = null,
    backgroundColor = null,
    selectedBackgroundColor = null,
    disabledBackgroundColor = null,
    overlayColor = null,
    ...options
  }: SegmentedButtonStyleFromOptions = {}): ButtonStyle {
    const overlay = [foregroundColor, selectedForegroundColor, overlayColor].every(
      (color) => color === null,
    )
      ? null
      : overlayColor !== null && overlayColor.toARGB32() === 0
        ? colorAll(transparent)
        : colorProperty((states) =>
            interactiveColor(
              states,
              overlayColor ??
                (states.contains(WidgetState.selected) ? selectedForegroundColor : foregroundColor),
              transparent,
            ),
          );
    return TextButton.styleFrom(options).copyWith({
      foregroundColor: stateColor(
        foregroundColor,
        disabledForegroundColor,
        selectedForegroundColor,
      ),
      backgroundColor: stateColor(
        backgroundColor,
        disabledBackgroundColor,
        selectedBackgroundColor,
      ),
      overlayColor: overlay,
    });
  }

  createState(): SegmentedButtonState<T> {
    return new SegmentedButtonState<T>();
  }
}

class SegmentButton extends TextButton {
  constructor(
    options: MaterialButtonOptions & { onPressed: (() => void) | null },
    readonly segmentTheme: ButtonStyle,
    readonly defaults: ButtonStyle,
  ) {
    super(options);
  }
  override themeStyleOf(): ButtonStyle {
    return this.segmentTheme;
  }
  override defaultStyleOf(context: BuildContext): ButtonStyle {
    return this.defaults.merge(super.defaultStyleOf(context));
  }
}

class SegmentKey<T> extends ValueKey<T> {
  constructor(value: T) {
    super(value, SegmentKey, valueEquals);
  }
}

export class SegmentedButtonState<T> extends State<SegmentedButton<T>> {
  /** Controllers for the current segment objects. The segment group owns their lifetime. */
  readonly statesControllers = new Map<ButtonSegment<T>, WidgetStatesController>();
  private readonly focused = new Set<ButtonSegment<T>>();
  private readonly hovered = new Set<ButtonSegment<T>>();

  private select(value: T): void {
    const { selected, onSelectionChanged, multiSelectionEnabled, emptySelectionAllowed } =
      this.widget;
    if (
      onSelectionChanged === null ||
      !this.widget.segments.some((entry) => entry.enabled && valueEquals(entry.value, value))
    )
      return;
    const current = [...selected];
    const selectedIndex = current.findIndex((entry) => valueEquals(entry, value));
    if (selectedIndex !== -1) {
      if (current.length === 1 && !emptySelectionAllowed) return;
      current.splice(selectedIndex, 1);
      onSelectionChanged(new Set(current));
    } else {
      onSelectionChanged(new Set(multiSelectionEnabled ? [...current, value] : [value]));
    }
  }

  override didUpdateWidget(old: SegmentedButton<T>): void {
    super.didUpdateWidget(old);
    const segments = new Set(this.widget.segments);
    const retired: WidgetStatesController[] = [];
    for (const [segment, controller] of this.statesControllers) {
      if (segments.has(segment)) continue;
      this.statesControllers.delete(segment);
      retired.push(controller);
    }
    if (retired.length) {
      // Descendant Ink responses still clear their pressed state when this update unmounts them.
      void Promise.resolve().then(() => {
        for (const controller of retired) controller.dispose();
      });
    }
    for (const active of [this.focused, this.hovered]) {
      for (const segment of active) {
        const next = this.widget.segments.find((entry) => valueEquals(entry.value, segment.value));
        if (next === segment) continue;
        active.delete(segment);
        if (next?.enabled && this.widget.onSelectionChanged) active.add(next);
      }
    }
  }

  override dispose(): void {
    for (const controller of this.statesControllers.values()) controller.dispose();
    this.statesControllers.clear();
    this.focused.clear();
    this.hovered.clear();
    super.dispose();
  }

  build(context: BuildContext): Widget {
    const widget = this.widget;
    const theme = Theme.of(context);
    const segmentedTheme = SegmentedButtonTheme.of(context);
    const colors = theme.colorScheme;
    const active = widget.onSelectionChanged !== null;
    const defaultSide = new BorderSide({ color: colors.outline });
    const onSurface = new Color(colors.onSurface);
    const onSecondary = new Color(colors.onSecondaryContainer);
    const secondary = new Color(colors.secondaryContainer);
    const disabledSide = new BorderSide({ color: onSurface.withOpacity(0.12).toARGB32() });
    const defaultShape = new StadiumBorder();
    const defaultStyle = new ButtonStyle({
      textStyle: textAll(theme.textTheme.labelLarge),
      backgroundColor: colorProperty((states) =>
        states.contains(WidgetState.selected) && !states.contains(WidgetState.disabled)
          ? secondary
          : transparent,
      ),
      foregroundColor: colorProperty((states) =>
        states.contains(WidgetState.disabled)
          ? onSurface.withOpacity(0.38)
          : states.contains(WidgetState.selected)
            ? onSecondary
            : onSurface,
      ),
      overlayColor: colorProperty((states) =>
        interactiveColor(
          states,
          states.contains(WidgetState.selected) ? onSecondary : onSurface,
          transparent,
        ),
      ),
      surfaceTintColor: colorAll(transparent),
      elevation: doubleAll(0),
      iconSize: doubleAll(18),
      minimumSize: sizeAll(new Size(0, 40)),
      shape: squareShape,
    });
    const styles = [widget.style, segmentedTheme.style];
    const groupStates = emptyWidgetStateSet();
    if (!active) groupStates.add(WidgetState.disabled);
    if (widget.selected.size) groupStates.add(WidgetState.selected);
    if (active && this.hovered.size) groupStates.add(WidgetState.hovered);
    if (active && this.focused.size) groupStates.add(WidgetState.focused);
    const groupStyle = (widget.style ?? new ButtonStyle()).merge(segmentedTheme.style);
    const density = (groupStyle.visualDensity ?? theme.visualDensity).baseSizeAdjustment.y;
    const target = groupStyle.tapTargetSize ?? theme.materialTapTargetSize;
    const contentHeight =
      (groupStyle.textStyle?.resolve(groupStates)?.fontSize ??
        theme.textTheme.labelLarge?.fontSize ??
        20) +
      (groupStyle.padding?.resolve(groupStates)?.vertical ?? 0) +
      2 * density;
    const tapPadding =
      target === MaterialTapTargetSize.padded
        ? Math.max(0, 48 + density - Math.max(contentHeight, 40 + density))
        : 0;
    const borderFor = (states: DartSet<WidgetState>, fallback: BorderSide) => {
      const shape =
        styles.map((style) => style?.shape?.resolve(states)).find((value) => value != null) ??
        defaultShape;
      const side =
        styles.map((style) => style?.side?.resolve(states)).find((value) => value != null) ??
        fallback;
      return shape.copyWith({ side });
    };
    // ButtonStyle.copyWith uses null as its fallback. Build the segment style
    // explicitly so only the group paints the outer shape and divider strokes.
    const segmentStyle = (style: ButtonStyle | null) =>
      new ButtonStyle({
        textStyle: style?.textStyle ?? null,
        backgroundColor: style?.backgroundColor ?? null,
        foregroundColor: style?.foregroundColor ?? null,
        overlayColor: style?.overlayColor ?? null,
        surfaceTintColor: style?.surfaceTintColor ?? null,
        elevation: style?.elevation ?? null,
        padding: style?.padding ?? null,
        minimumSize: style?.minimumSize ?? null,
        maximumSize: style?.maximumSize ?? null,
        fixedSize: style?.fixedSize ?? null,
        iconColor: style?.iconColor ?? null,
        iconSize: style?.iconSize ?? null,
        shape: squareShape,
        mouseCursor: style?.mouseCursor ?? null,
        visualDensity: style?.visualDensity ?? null,
        tapTargetSize: style?.tapTargetSize ?? null,
        animationDuration: style?.animationDuration ?? null,
        enableFeedback: style?.enableFeedback ?? null,
        alignment: style?.alignment ?? null,
        splashFactory: style?.splashFactory ?? null,
      });
    const widgetStyle = segmentStyle(widget.style);
    const localTheme = segmentStyle(segmentedTheme.style);
    const pickedIcon = widget.showSelectedIcon
      ? (widget.selectedIcon ?? segmentedTheme.selectedIcon ?? defaultIcon())
      : null;
    const enabledSegments = widget.segments.map((segment) => active && segment.enabled);
    const current = [...widget.selected];
    const children = widget.segments.map((segment, index) => {
      const selected = current.some((value) => valueEquals(value, segment.value));
      let statesController = this.statesControllers.get(segment);
      if (!statesController) {
        statesController = new WidgetStatesController();
        this.statesControllers.set(segment, statesController);
      }
      const label = segment.label ?? segment.icon!;
      const icon =
        selected && pickedIcon !== null
          ? new ExcludeSemantics(pickedIcon)
          : segment.label
            ? segment.icon
            : null;
      const fontSize = widgetStyle.textStyle?.resolve(enabledStates)?.fontSize ?? 14;
      const scale = MediaQuery.textScalerOf(context).scale(fontSize) / 14;
      const style =
        icon === null
          ? widgetStyle
          : widgetStyle.copyWith({
              padding: insetsAll(
                TextButton.scaledPadding(buttonIconInsets, smallIconInsets, smallIconInsets, scale),
              ),
            });
      const change = (states: Set<ButtonSegment<T>>, value: boolean) => {
        if (!this.mounted) return;
        const live = this.widget.segments.find((entry) => valueEquals(segment.value, entry.value));
        if (!live || states.has(live) === value) return;
        this.setState(() => {
          if (value) states.add(live);
          else states.delete(live);
        });
      };
      const button = new SegmentButton(
        {
          style,
          selected,
          statesController,
          child:
            icon === null
              ? label
              : new ButtonIconLabel(
                  label,
                  icon,
                  widget.style,
                  null,
                  (ctx) => TextButtonTheme.of(ctx).style,
                ),
          onPressed: enabledSegments[index] ? () => this.select(segment.value) : null,
          onHover: (value) => change(this.hovered, value),
          onFocusChange: (value) => change(this.focused, value),
        },
        localTheme,
        defaultStyle,
      );
      return new MergeSemantics({
        key: new SegmentKey(segment.value),
        child: new Semantics({
          inMutuallyExclusiveGroup: widget.multiSelectionEnabled ? null : true,
          child:
            segment.tooltip === null
              ? button
              : new Tooltip({ message: segment.tooltip, child: button }),
        }),
      });
    });
    const group = new SegmentGroup(children, {
      horizontal: widget.direction === Axis.horizontal,
      expanded: widget.expandedInsets !== null,
      textDirection: Directionality.of(context),
      enabledSegments,
      enabledBorder: borderFor(groupStates, defaultSide),
      disabledBorder: borderFor(disabledStates, disabledSide),
      tapPadding,
    });
    return new Material({
      type: MaterialType.transparency,
      elevation: groupStyle.elevation?.resolve(groupStates)?.value ?? 0,
      shadowColor: groupStyle.shadowColor?.resolve(groupStates) ?? null,
      surfaceTintColor: groupStyle.surfaceTintColor?.resolve(groupStates) ?? null,
      child: widget.expandedInsets === null ? group : new Padding(widget.expandedInsets, group),
    });
  }
}

interface GroupOptions {
  readonly horizontal: boolean;
  readonly expanded: boolean;
  readonly textDirection: 'ltr' | 'rtl';
  readonly enabledSegments: readonly boolean[];
  readonly enabledBorder: OutlinedBorder;
  readonly disabledBorder: OutlinedBorder;
  readonly tapPadding: number;
}

class SegmentGroup extends MultiChildRenderObjectWidget {
  constructor(
    children: readonly Widget[],
    readonly options: GroupOptions,
  ) {
    super(children);
  }
  createRenderObject(): SegmentGroupRender {
    return new SegmentGroupRender(this.options);
  }
  updateRenderObject(_context: BuildContext, render: SegmentGroupRender): void {
    const previous = render.options;
    render.options = this.options;
    if (
      previous.horizontal !== this.options.horizontal ||
      previous.expanded !== this.options.expanded ||
      previous.textDirection !== this.options.textDirection
    ) {
      render.markNeedsLayout();
    } else render.markNeedsPaint();
  }
}

class SegmentGroupRender extends RenderBox {
  constructor(public options: GroupOptions) {
    super();
  }

  private measure(constraints: BoxConstraints): { size: Size; segment: Size } {
    const count = this.children.length;
    const { horizontal, expanded } = this.options;
    if (count === 0)
      return {
        size: new Size(constraints.minWidth, constraints.minHeight),
        segment: new Size(0, 0),
      };
    const min = (horizontal ? constraints.minWidth : constraints.minHeight) / count;
    const max = (horizontal ? constraints.maxWidth : constraints.maxHeight) / count;
    let main = min;
    if (expanded && Number.isFinite(max)) main = max;
    else
      for (const child of this.children) {
        main = Math.max(
          main,
          horizontal ? child.getMaxIntrinsicWidth(Infinity) : child.getMaxIntrinsicHeight(Infinity),
        );
      }
    main = Math.min(main, max);
    let cross = 0;
    for (const child of this.children) {
      cross = Math.max(
        cross,
        horizontal ? child.getMaxIntrinsicHeight(main) : child.getMaxIntrinsicWidth(main),
      );
    }
    const size = constraints.constrain(
      horizontal ? new Size(main * count, cross) : new Size(cross, main * count),
    );
    return {
      size: new Size(size.width, size.height),
      segment: horizontal
        ? new Size(size.width / count, size.height)
        : new Size(size.width, size.height / count),
    };
  }

  protected override computeDryLayout(constraints: BoxConstraints): Size {
    return this.measure(constraints).size;
  }
  protected override computeMinIntrinsicWidth(height: number): number {
    return this.measureIntrinsic(this.options.horizontal, height, (child, cross) =>
      child.getMinIntrinsicWidth(cross),
    );
  }
  protected override computeMaxIntrinsicWidth(height: number): number {
    return this.measureIntrinsic(this.options.horizontal, height, (child, cross) =>
      child.getMaxIntrinsicWidth(cross),
    );
  }
  protected override computeMinIntrinsicHeight(width: number): number {
    return this.measureIntrinsic(!this.options.horizontal, width, (child, cross) =>
      child.getMinIntrinsicHeight(cross),
    );
  }
  protected override computeMaxIntrinsicHeight(width: number): number {
    return this.measureIntrinsic(!this.options.horizontal, width, (child, cross) =>
      child.getMaxIntrinsicHeight(cross),
    );
  }

  private measureIntrinsic(
    alongGroup: boolean,
    cross: number,
    query: (child: RenderBox<RenderObject>, cross: number) => number,
  ): number {
    const count = this.children.length;
    if (!count) return 0;
    const input = alongGroup ? cross : cross / count;
    const largest = Math.max(...this.children.map((child) => query(child, input)));
    return alongGroup ? largest * count : largest;
  }

  protected override computeDryBaseline(
    constraints: BoxConstraints,
    baseline: TextBaseline,
  ): number | null {
    const { segment } = this.measure(constraints);
    const tight = BoxConstraints.tight(segment);
    let result = Infinity;
    this.children.forEach((child, index) => {
      const value = child.getDryBaseline(tight, baseline);
      if (value !== null)
        result = Math.min(
          result,
          value + (this.options.horizontal ? 0 : this.visualIndex(index) * segment.height),
        );
    });
    return Number.isFinite(result) ? result : null;
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    const { size, segment } = this.measure(constraints);
    const tight = BoxConstraints.tight(segment);
    const { horizontal } = this.options;
    this.children.forEach((child, i) => {
      child.layout(tight, { parentUsesSize: true });
      const index = this.visualIndex(i);
      child.layoutOffset = horizontal
        ? { x: index * segment.width, y: 0 }
        : { x: 0, y: index * segment.height };
    });
    return size;
  }

  private visualIndex(index: number): number {
    return this.options.textDirection === 'rtl' ? this.children.length - 1 - index : index;
  }

  protected override computeDistanceToActualBaseline(baseline: TextBaseline): number | null {
    let result = Infinity;
    for (const child of this.children) {
      const value = child.getDistanceToActualBaseline(baseline);
      if (value !== null) result = Math.min(result, value + child.layoutOffset.y);
    }
    return Number.isFinite(result) ? result : null;
  }

  override paint(context: PaintingContext): void {
    const { horizontal, enabledSegments, enabledBorder, disabledBorder, textDirection } =
      this.options;
    const padding = Math.min(this.size.height, this.options.tapPadding);
    const bounds = Rect.fromLTWH(0, padding / 2, this.size.width, this.size.height - padding);
    const options = { textDirection };
    const clipBorder = enabledSegments.some(Boolean) ? enabledBorder : disabledBorder;
    context.save();
    context.clipPath(clipBorder.getInnerPath(bounds, options));
    super.paint(context);
    this.children.forEach((child, i) => {
      if (i === 0) return;
      const side =
        enabledSegments[i - 1] || enabledSegments[i] ? enabledBorder.side : disabledBorder.side;
      if (side.style === 'none') return;
      const { x, y } = child.layoutOffset;
      const divider = textDirection === 'rtl' ? x + child.size.width : x;
      if (horizontal)
        context.drawLine(
          { x: divider, y: bounds.top },
          { x: divider, y: bounds.bottom },
          side.toPaint(),
        );
      else {
        const dividerY = textDirection === 'rtl' ? y + child.size.height : y;
        context.drawLine({ x: 0, y: dividerY }, { x: bounds.width, y: dividerY }, side.toPaint());
      }
    });
    context.restore();
    if (enabledSegments.every(Boolean) || !enabledSegments.some(Boolean)) {
      clipBorder.paint(context, bounds, options);
      return;
    }
    this.children.forEach((child, i) => {
      const border = enabledSegments[i] ? enabledBorder : disabledBorder;
      const outset = Math.max(enabledBorder.side.strokeOutset, disabledBorder.side.strokeOutset);
      const { x, y } = child.layoutOffset;
      const left = x === 0 ? -outset : x;
      const right =
        x + child.size.width >= bounds.width - 1e-7 ? bounds.width + outset : x + child.size.width;
      const top = y <= bounds.top ? bounds.top - outset : y;
      const bottom =
        y + child.size.height >= bounds.bottom - 1e-7
          ? bounds.bottom + outset
          : y + child.size.height;
      context.save();
      context.clipRect(Rect.fromLTRB(left, top, right, bottom), { doAntiAlias: false });
      border.paint(context, bounds, options);
      context.restore();
    });
  }
}
