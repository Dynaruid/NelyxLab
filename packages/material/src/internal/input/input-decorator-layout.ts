// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/input_decorator.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import {
  MultiChildRenderObjectWidget,
  LeafRenderObjectWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { KeyedSubtree } from '@nelyx/core/framework/widgets/basic';
import { ValueKey } from '@nelyx/core/foundation/key';
import type { Key } from '@nelyx/core/foundation/key';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { RenderRepaintBoundary } from '@nelyx/core/framework/rendering/repaint-boundary';
import type {
  RenderObject,
  TextBaseline,
  PipelineOwner,
} from '@nelyx/core/framework/rendering/object';
import type { ValueListenable } from '@nelyx/core/foundation/notifier';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import type { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { TextAlignVertical } from '@nelyx/core/framework/painting/text-align-vertical';
import {
  ChildSemanticsConfigurationsResultBuilder,
  SemanticsTag,
} from '@nelyx/core/framework/semantics/semantics';
import type { SemanticsConfiguration } from '@nelyx/core/framework/semantics/semantics';
import { Paint } from '@nelyx/core/ui/paint';
import { Rect } from '@nelyx/core/ui/rect';
import { multiply } from '@nelyx/core/ui/geometry';
import type { Size, Offset, TransformMatrix } from '@nelyx/core/ui/geometry';
import { invariant } from '@nelyx/core/foundation/errors';
import type { InputBorder } from '../../input-border.ts';

export const finalLabelScale = 0.75;
export const inputExtraPadding = 4;
export const decorationSemanticsTags = {
  prefix: new SemanticsTag('InputDecorator.prefix'),
  prefixIcon: new SemanticsTag('InputDecorator.prefixIcon'),
  suffix: new SemanticsTag('InputDecorator.suffix'),
  suffixIcon: new SemanticsTag('InputDecorator.suffixIcon'),
} as const;
const accessoryTags = Object.values(decorationSemanticsTags);
const subtextCounterPadding = 16;
const subtextGap = 4;

export type DecorationSlot =
  | 'container'
  | 'icon'
  | 'input'
  | 'hint'
  | 'prefixIcon'
  | 'suffixIcon'
  | 'prefix'
  | 'suffix'
  | 'label'
  | 'helperError'
  | 'counter';
export interface DecorationLayoutConfiguration {
  readonly padding: EdgeInsets;
  readonly direction: 'ltr' | 'rtl';
  readonly baseline: TextBaseline;
  readonly floatingLabelHeight: number;
  readonly labelProgress: number;
  readonly labelAlignment: number;
  readonly outline: boolean;
  readonly borderStrokeOffset: number;
  readonly hasLabel: boolean;
  readonly labelVisible: boolean;
  readonly isEmpty: boolean;
  readonly isCollapsed: boolean;
  readonly isDense: boolean;
  readonly maintainHintSize: boolean;
  readonly hintVisible: boolean;
  readonly maintainLabelSize: boolean;
  readonly alignLabelWithHint: boolean;
  readonly density: { readonly width: number; readonly height: number };
  readonly inputGap: number;
  readonly expands: boolean;
  readonly vertical: TextAlignVertical | null;
}
export interface DecorationBorderConfiguration {
  readonly border: InputBorder;
  readonly fill: number;
  readonly direction: 'ltr' | 'rtl';
  readonly progress: number;
}
export class DecorationBorder extends LeafRenderObjectWidget {
  constructor(
    readonly configuration: DecorationBorderConfiguration,
    key: Key | null = null,
    readonly animation: ValueListenable<DecorationBorderConfiguration> | null = null,
  ) {
    super(key);
  }
  createRenderObject(): RenderObject {
    return new RenderDecorationBorder(this.configuration, this.animation);
  }
  updateRenderObject(_context: BuildContext, object: RenderObject): void {
    invariant(
      object instanceof RenderDecorationBorder,
      'invalid-decoration-border',
      'Expected the input border render owner',
    );
    object.configure(this.configuration, this.animation);
  }
}
class RenderDecorationBorder extends RenderRepaintBoundary {
  private listening = false;
  private readonly animationChanged = () => {
    if (this.attached) this.markNeedsPaintOnly();
  };
  private gapStartValue: number | null = null;
  private gapExtentValue = 0;
  get gapStart(): number | null {
    return this.gapStartValue;
  }
  set gapStart(value: number | null) {
    if (value === this.gapStartValue) return;
    this.gapStartValue = value;
    this.markNeedsPaintOnly();
  }
  get gapExtent(): number {
    return this.gapExtentValue;
  }
  set gapExtent(value: number) {
    if (value === this.gapExtentValue) return;
    this.gapExtentValue = value;
    this.markNeedsPaintOnly();
  }
  protected override get childCountLimit(): number {
    return 0;
  }
  constructor(
    private configuration: DecorationBorderConfiguration,
    private animation: ValueListenable<DecorationBorderConfiguration> | null,
  ) {
    super();
  }
  private startListening(): void {
    if (!this.listening && this.animation && this.attached) {
      this.animation.addListener(this.animationChanged);
      this.listening = true;
    }
  }
  private stopListening(): void {
    if (this.listening) {
      this.listening = false;
      this.animation!.removeListener(this.animationChanged);
    }
  }
  override attach(owner: PipelineOwner): void {
    super.attach(owner);
    this.startListening();
  }
  override detach(): void {
    try {
      super.detach();
    } finally {
      if (!this.attached) this.stopListening();
    }
  }
  override dispose(): void {
    try {
      super.dispose();
    } finally {
      if (this.debugDisposed) this.stopListening();
    }
  }
  configure(
    value: DecorationBorderConfiguration,
    animation: ValueListenable<DecorationBorderConfiguration> | null,
  ): void {
    if (this.animation !== animation) {
      this.stopListening();
      this.animation = animation;
      this.startListening();
    }
    this.configuration = value;
    this.markNeedsPaintOnly();
  }
  protected override computeDryLayout(constraints: BoxConstraints): Size {
    return constraints.smallest;
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    return this.computeDryLayout(constraints);
  }
  override paint(context: PaintingContext): void {
    const c = this.animation?.value ?? this.configuration,
      rect = Rect.fromLTWH(0, 0, this.size.width, this.size.height);
    if (c.fill >>> 24) {
      const options = { textDirection: c.direction };
      const paint = new Paint({ color: c.fill });
      if (c.border.preferPaintInterior) c.border.paintInterior(context, rect, paint, options);
      else context.drawPath(c.border.getOuterPath(rect, options), paint);
    }
    c.border.paint(context, rect, {
      textDirection: c.direction,
      gapStart: this.gapStart,
      gapExtent: this.gapExtent,
      gapPercentage: c.progress,
    });
  }
}
export class DecorationLayout extends MultiChildRenderObjectWidget {
  readonly slots: readonly DecorationSlot[];
  constructor(
    slots: ReadonlyMap<DecorationSlot, Widget>,
    readonly configuration: DecorationLayoutConfiguration,
  ) {
    super([...slots].map(([slot, child]) => new KeyedSubtree({ key: new ValueKey(slot), child })));
    this.slots = Object.freeze([...slots.keys()]);
  }
  createRenderObject(): RenderObject {
    return new RenderInputDecoration(this.slots, this.configuration);
  }
  updateRenderObject(_context: BuildContext, object: RenderObject): void {
    invariant(
      object instanceof RenderInputDecoration,
      'invalid-input-decorator-render',
      'Expected the canonical input decoration render owner',
    );
    object.configure(this.slots, this.configuration);
  }
}
interface Measured {
  readonly size: Size;
  readonly baseline: number;
  readonly constraints: BoxConstraints;
}
interface Measurement {
  readonly size: Size;
  readonly offsets: ReadonlyMap<DecorationSlot, Offset>;
  readonly baseline: number;
  readonly labelScale: number;
  readonly gapStart: number | null;
  readonly gapExtent: number;
  readonly input: Measured;
}
interface SubtextSize {
  readonly ascent: number;
  readonly bottomHeight: number;
  readonly subtextHeight: number;
}
type ChildBaselineGetter = (child: RenderBox<RenderObject>, box: BoxConstraints) => number | null;
const zero: Measured = {
  size: { width: 0, height: 0 },
  baseline: 0,
  constraints: new BoxConstraints(),
};
const layoutFields = [
  'direction',
  'baseline',
  'floatingLabelHeight',
  'labelProgress',
  'labelAlignment',
  'outline',
  'borderStrokeOffset',
  'hasLabel',
  'labelVisible',
  'isEmpty',
  'isCollapsed',
  'isDense',
  'maintainHintSize',
  'hintVisible',
  'maintainLabelSize',
  'alignLabelWithHint',
  'inputGap',
  'expands',
] as const;
const captureLayout = (value: DecorationLayoutConfiguration): DecorationLayoutConfiguration =>
  Object.freeze({ ...value, density: Object.freeze({ ...value.density }) });
export class RenderInputDecoration extends RenderBox {
  private measured: Measurement | null = null;
  private slots: readonly DecorationSlot[];
  private configuration: DecorationLayoutConfiguration;
  constructor(slots: readonly DecorationSlot[], configuration: DecorationLayoutConfiguration) {
    super();
    this.slots = Object.freeze([...slots]);
    this.configuration = captureLayout(configuration);
  }
  configure(slots: readonly DecorationSlot[], configuration: DecorationLayoutConfiguration): void {
    const previous = this.configuration,
      changed =
        this.slots.length !== slots.length ||
        this.slots.some((slot, index) => slot !== slots[index]) ||
        !previous.padding.equals(configuration.padding) ||
        layoutFields.some((field) => previous[field] !== configuration[field]) ||
        previous.density.width !== configuration.density.width ||
        previous.density.height !== configuration.density.height ||
        previous.vertical?.y !== configuration.vertical?.y;
    this.slots = Object.freeze([...slots]);
    this.configuration = captureLayout(configuration);
    if (changed) this.markNeedsLayout();
  }
  private childFor(slot: DecorationSlot): RenderBox<RenderObject> | undefined {
    return this.children[this.slots.indexOf(slot)];
  }
  get container(): RenderBox<RenderObject> | null {
    return this.childFor('container') ?? null;
  }
  dropdownWidths(height: number): { label: number; accessories: number } {
    const leading = this.childFor('prefixIcon');
    const trailing = this.childFor('suffixIcon');
    const label = this.childFor('label');
    return {
      label: label ? label.getMaxIntrinsicWidth(height) + inputExtraPadding * 2 : 0,
      accessories:
        (leading ? leading.getMaxIntrinsicWidth(height) + 16 : 0) +
        (trailing?.getMaxIntrinsicWidth(height) ?? 0),
    };
  }
  private measure(constraints: BoxConstraints, dry: boolean): Measurement {
    invariant(
      constraints.hasBoundedWidth,
      'unbounded-input-decoration',
      'InputDecorator requires bounded width',
    );
    const c = this.configuration,
      p = c.padding,
      startPadding = c.direction === 'rtl' ? p.right : p.left,
      endPadding = c.direction === 'rtl' ? p.left : p.right,
      width = constraints.maxWidth,
      measured = new Map<DecorationSlot, Measured>(),
      offsets = new Map<DecorationSlot, Offset>();
    const baselineFor: ChildBaselineGetter = dry
      ? (child, box) => child.getDryBaseline(box, c.baseline)
      : (child) => child.getDistanceToActualBaseline(c.baseline);
    invariant(
      !c.expands || constraints.hasBoundedHeight,
      'unbounded-expanded-input',
      'Expanded input requires bounded height',
    );
    const measure = (slot: DecorationSlot, box: BoxConstraints): Measured => {
      const child = this.childFor(slot);
      if (!child) return zero;
      const size = dry
        ? child.getDryLayout(box)
        : (child.layout(box, { parentUsesSize: true }), child.size);
      const baseline = baselineFor(child, box) ?? size.height;
      const value = { size, baseline, constraints: box };
      measured.set(slot, value);
      return value;
    };
    const loose = new BoxConstraints(0, width, 0, constraints.maxHeight),
      icon = measure('icon', loose),
      containerWidth = Math.max(0, width - icon.size.width);
    const prefixIcon = measure(
      'prefixIcon',
      new BoxConstraints(0, containerWidth, 0, constraints.maxHeight),
    );
    const suffixIcon = measure(
      'suffixIcon',
      new BoxConstraints(
        0,
        Math.max(0, containerWidth - prefixIcon.size.width),
        0,
        constraints.maxHeight,
      ),
    );
    const start = this.childFor('prefixIcon')
      ? prefixIcon.size.width + inputExtraPadding
      : startPadding + c.inputGap;
    const finish = this.childFor('suffixIcon')
      ? suffixIcon.size.width + inputExtraPadding
      : endPadding + c.inputGap;
    const inlineWidth = Math.max(0, containerWidth - start - finish),
      prefix = measure('prefix', new BoxConstraints(0, inlineWidth, 0, constraints.maxHeight));
    const suffix = measure(
      'suffix',
      new BoxConstraints(0, Math.max(0, inlineWidth - prefix.size.width), 0, constraints.maxHeight),
    );
    const inputWidth = Math.max(0, inlineWidth - prefix.size.width - suffix.size.width);
    const subtextWidth = Math.max(0, containerWidth - p.horizontal - c.inputGap * 2);
    const counter = measure('counter', new BoxConstraints(0, subtextWidth, 0, Infinity));
    const helper = measure(
      'helperError',
      new BoxConstraints(
        0,
        Math.max(
          0,
          subtextWidth -
            counter.size.width -
            (this.childFor('counter') ? subtextCounterPadding : 0),
        ),
        0,
        Infinity,
      ),
    );
    const footerHeight = Math.max(counter.size.height, helper.size.height);
    const subtext: SubtextSize | null =
      footerHeight > 0
        ? {
            ascent: Math.max(counter.baseline, helper.baseline) + subtextGap,
            bottomHeight: Math.max(counter.baseline, helper.size.height) + subtextGap,
            subtextHeight: footerHeight + subtextGap,
          }
        : null;
    const footer = subtext?.subtextHeight ?? 0;
    const labelScale = 1 + (finalLabelScale - 1) * c.labelProgress;
    const label = measure('label', new BoxConstraints(0, inlineWidth / labelScale));
    const outlineAligned = c.outline && !c.isCollapsed;
    const floating =
      c.hasLabel && !c.isCollapsed
        ? outlineAligned
          ? Math.max(0, c.floatingLabelHeight - label.baseline)
          : c.floatingLabelHeight
        : 0;
    const maxInputHeight = Math.max(
      0,
      constraints.maxHeight -
        p.vertical -
        floating -
        (subtext?.bottomHeight ?? 0) -
        c.density.height,
    );
    const inputConstraints = new BoxConstraints(inputWidth, inputWidth, 0, maxInputHeight),
      input = measure('input', inputConstraints),
      hint = measure('hint', new BoxConstraints(0, inputWidth, 0, constraints.maxHeight));
    const inlineHint = c.maintainHintSize || (c.isEmpty && c.hintVisible) ? hint : zero;
    const inlineLabel =
      c.hasLabel && c.labelProgress === 0 && (c.labelVisible || c.maintainLabelSize) ? label : zero;
    const inputHeight = Math.max(
      input.size.height,
      inlineHint.size.height,
      inlineLabel.size.height,
    );
    const inputBaseline = Math.max(input.baseline, inlineHint.baseline, inlineLabel.baseline);
    const above = Math.max(0, Math.max(prefix.baseline, suffix.baseline) - inputBaseline);
    const below = Math.max(
      0,
      Math.max(prefix.size.height - prefix.baseline, suffix.size.height - suffix.baseline) -
        (inputHeight - inputBaseline),
    );
    const rowHeight = above + inputHeight + below;
    const minHeight = c.isDense || c.isCollapsed || c.expands ? inputHeight : 48;
    const contentHeight = Math.max(
      p.vertical + floating + rowHeight + c.density.height,
      prefixIcon.size.height,
      suffixIcon.size.height,
    );
    const availableHeight = Math.max(0, constraints.maxHeight - (subtext?.bottomHeight ?? 0));
    const containerHeight = c.expands
      ? availableHeight
      : Math.min(Math.max(minHeight, contentHeight), availableHeight);
    const result = constraints.constrain({
      width,
      height: Math.max(icon.size.height, containerHeight + footer),
    });
    const containerX = c.direction === 'ltr' ? icon.size.width : 0;
    const alignment = c.vertical?.y ?? (outlineAligned ? 0 : -1);
    const verticalFactor = (alignment + 1) / 2;
    const overflow = Math.max(0, contentHeight - availableHeight);
    const baselineAdjustment = above - overflow * (1 - verticalFactor);
    const interactiveAdjustment = Math.max(0, minHeight - contentHeight) / 2;
    const top =
      p.top +
      floating +
      inputBaseline +
      baselineAdjustment +
      interactiveAdjustment +
      c.density.height / 2;
    const travel = containerHeight - p.vertical - floating - c.density.height - rowHeight;
    let baseline = top + travel * verticalFactor;
    if (outlineAligned) {
      const center = inputBaseline + baselineAdjustment / 2 + (containerHeight - inputHeight) / 2;
      const distance = alignment <= 0 ? center - top : top + travel - center;
      baseline = center + Math.max(0, distance) * alignment;
    }
    const place = (slot: DecorationSlot, logicalX: number, y: number) => {
      const item = measured.get(slot);
      if (!item) return;
      offsets.set(slot, {
        x:
          containerX +
          (c.direction === 'ltr' ? logicalX : containerWidth - logicalX - item.size.width),
        y,
      });
    };
    const inputStart = start + prefix.size.width;
    place('input', inputStart, baseline - input.baseline);
    place('hint', inputStart, baseline - hint.baseline);
    place('prefix', start, baseline - prefix.baseline);
    place('suffix', containerWidth - finish - suffix.size.width, baseline - suffix.baseline);
    place('prefixIcon', 0, (containerHeight - prefixIcon.size.height) / 2);
    place(
      'suffixIcon',
      containerWidth - suffixIcon.size.width,
      (containerHeight - suffixIcon.size.height) / 2,
    );
    if (this.childFor('icon'))
      offsets.set('icon', {
        x: c.direction === 'ltr' ? 0 : containerWidth,
        y: (containerHeight - icon.size.height) / 2,
      });
    const inlineLabelY = c.alignLabelWithHint
      ? baseline - label.baseline
      : (containerHeight - label.size.height) / 2;
    const floatingLabelY = c.outline
      ? (-label.size.height * finalLabelScale) / 2 - c.borderStrokeOffset / 2
      : p.top + c.density.height / 2;
    const floatingStart =
      c.outline && !c.alignLabelWithHint && this.childFor('prefixIcon')
        ? startPadding + inputExtraPadding
        : start;
    const floatingCenter = (containerWidth - label.size.width * finalLabelScale) / 2;
    const floatingX = floatingStart + (floatingCenter - floatingStart) * (c.labelAlignment + 1);
    const logicalLabelX = start * (1 - c.labelProgress) + floatingX * c.labelProgress;
    if (this.childFor('label'))
      offsets.set('label', {
        x:
          containerX +
          (c.direction === 'ltr'
            ? logicalLabelX
            : containerWidth - logicalLabelX - label.size.width * labelScale),
        y: inlineLabelY * (1 - c.labelProgress) + floatingLabelY * c.labelProgress,
      });
    place(
      'helperError',
      startPadding + c.inputGap,
      containerHeight + (subtext?.ascent ?? 0) - helper.baseline,
    );
    place(
      'counter',
      containerWidth - endPadding - c.inputGap - counter.size.width,
      containerHeight + (subtext?.ascent ?? 0) - counter.baseline,
    );
    if (this.childFor('container')) {
      measure(
        'container',
        BoxConstraints.tight({ width: containerWidth, height: containerHeight }),
      );
      offsets.set('container', { x: containerX, y: 0 });
    }
    return {
      size: result,
      offsets,
      baseline,
      input,
      labelScale,
      gapStart: this.childFor('label')
        ? c.direction === 'rtl'
          ? containerWidth - floatingX
          : floatingX
        : null,
      gapExtent: label.size.width * finalLabelScale,
    };
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    const measured = this.measure(constraints, false);
    this.measured = measured;
    this.slots.forEach((slot, index) => {
      const offset = measured.offsets.get(slot);
      if (offset) this.children[index]!.layoutOffset = offset;
    });
    const border = this.childFor('container');
    if (border instanceof RenderDecorationBorder) {
      border.gapStart = measured.gapStart;
      border.gapExtent = measured.gapExtent;
    }
    return measured.size;
  }
  protected override computeDryLayout(constraints: BoxConstraints): Size {
    return this.measure(constraints, true).size;
  }
  protected override computeDryBaseline(
    constraints: BoxConstraints,
    baseline: TextBaseline,
  ): number {
    const measured = this.measure(constraints, true);
    const input = this.childFor('input');
    if (!input || baseline === this.configuration.baseline) return measured.baseline;
    const target =
      input.getDryBaseline(measured.input.constraints, baseline) ?? measured.input.size.height;
    return measured.baseline + target - measured.input.baseline;
  }
  protected override computeDistanceToActualBaseline(baseline: TextBaseline): number | null {
    const measured = this.measured;
    if (!measured) return null;
    const input = this.childFor('input');
    if (!input || baseline === this.configuration.baseline) return measured.baseline;
    const target = input.getDistanceToActualBaseline(baseline) ?? measured.input.size.height;
    return measured.baseline + target - measured.input.baseline;
  }
  protected override childTransform(child: RenderObject): TransformMatrix {
    const matrix = super.childTransform(child),
      scale = this.measured?.labelScale ?? 1;
    return child === this.childFor('label') ? multiply(matrix, [scale, 0, 0, scale, 0, 0]) : matrix;
  }
  private intrinsicWidth(max: boolean, height: number): number {
    const c = this.configuration,
      p = c.padding,
      get = (slot: DecorationSlot) => {
        const child = this.childFor(slot);
        return child
          ? max
            ? child.getMaxIntrinsicWidth(height)
            : child.getMinIntrinsicWidth(height)
          : 0;
      };
    const start = this.childFor('prefixIcon')
        ? get('prefixIcon') + inputExtraPadding
        : p.left + c.inputGap,
      finish = this.childFor('suffixIcon')
        ? get('suffixIcon') + inputExtraPadding
        : p.right + c.inputGap;
    const content =
      Math.max(
        get('input'),
        c.maintainHintSize || (c.isEmpty && c.hintVisible) ? get('hint') : 0,
        c.labelVisible || c.maintainLabelSize ? get('label') : 0,
      ) +
      get('prefix') +
      get('suffix');
    return (
      get('icon') +
      Math.max(
        start + content + finish,
        p.horizontal +
          c.inputGap * 2 +
          get('helperError') +
          get('counter') +
          (this.childFor('counter') ? subtextCounterPadding : 0),
      )
    );
  }
  protected override computeMinIntrinsicWidth(height: number): number {
    return this.intrinsicWidth(false, height);
  }
  protected override computeMaxIntrinsicWidth(height: number): number {
    return this.intrinsicWidth(true, height);
  }
  protected override computeMinIntrinsicHeight(width: number): number {
    const c = this.configuration;
    const h = (slot: DecorationSlot, available: number) =>
      this.childFor(slot)?.getMinIntrinsicHeight(available) ?? 0;
    const w = (slot: DecorationSlot, height: number) =>
      this.childFor(slot)?.getMinIntrinsicWidth(height) ?? 0;
    const icon = h('icon', width);
    const containerWidth = Math.max(0, width - w('icon', icon));
    const prefixIcon = h('prefixIcon', containerWidth);
    const suffixIcon = h('suffixIcon', containerWidth);
    const contentWidth = Math.max(0, containerWidth - c.padding.horizontal - c.inputGap * 2);
    const counter = h('counter', contentWidth);
    const counterWidth = this.childFor('counter')
      ? w('counter', counter) + subtextCounterPadding
      : 0;
    const helper = h('helperError', Math.max(0, contentWidth - counterWidth));
    const subtext = Math.max(counter, helper);
    const prefix = h('prefix', contentWidth);
    const suffix = h('suffix', contentWidth);
    const inputWidth = Math.max(
      0,
      contentWidth -
        w('prefix', prefix) -
        w('suffix', suffix) -
        w('prefixIcon', prefixIcon) -
        w('suffixIcon', suffixIcon),
    );
    const hint = c.isEmpty && c.hintVisible ? h('hint', inputWidth) : 0;
    const label = this.childFor('label') ? c.floatingLabelHeight : 0;
    const height =
      c.padding.vertical +
      label +
      Math.max(h('input', inputWidth), hint, prefix, suffix) +
      c.density.height;
    const minHeight = c.isDense || c.expands ? 0 : 48;
    return (
      Math.max(icon, height, prefixIcon, suffixIcon, minHeight) +
      (subtext ? subtext + subtextGap : 0)
    );
  }
  protected override computeMaxIntrinsicHeight(width: number): number {
    return this.computeMinIntrinsicHeight(width);
  }
  private readonly groupDecorationSemantics = (children: readonly SemanticsConfiguration[]) => {
    const result = new ChildSemanticsConfigurationsResultBuilder();
    const groups = new Map<SemanticsTag, SemanticsConfiguration[]>();
    for (const child of children) {
      const tag = accessoryTags.find((candidate) => child.tagsChildrenWith(candidate));
      if (tag) {
        let group = groups.get(tag);
        if (!group) groups.set(tag, (group = []));
        group.push(child);
      } else result.markAsMergeUp(child);
    }
    for (const group of groups.values()) result.markAsSiblingMergeGroup(group);
    return result.build();
  };
  override describeSemanticsConfiguration(config: SemanticsConfiguration): void {
    super.describeSemanticsConfiguration(config);
    config.childConfigurationsDelegate = this.groupDecorationSemantics;
  }
}
RenderBox._registerInputGeometryHooks(RenderInputDecoration.prototype, undefined, false);
