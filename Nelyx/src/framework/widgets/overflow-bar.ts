// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { MultiChildRenderObjectWidget } from './framework.ts';
import type { Widget, WidgetOptions, BuildContext } from './framework.ts';
import { Directionality } from './app-data.ts';
import { VerticalDirection } from '../painting/basic-types.ts';
import type { MainAxisAlignment } from '../rendering/boxes.ts';
import { RenderBox } from '../rendering/object.ts';
import type { RenderObject, TextBaseline } from '../rendering/object.ts';
import type { BoxConstraints } from '../rendering/constraints.ts';
import type { Size, Offset } from '../../ui/geometry.ts';
import { invariant } from '../../foundation/errors.ts';
import { DoubleProperty, EnumProperty } from '../../foundation/diagnostic-properties.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';

export const OverflowBarAlignment = Object.freeze({
  start: 'start',
  end: 'end',
  center: 'center',
} as const);
export type OverflowBarAlignment = (typeof OverflowBarAlignment)[keyof typeof OverflowBarAlignment];
export interface OverflowBarOptions extends WidgetOptions {
  /** @dartType double */ readonly spacing?: number;
  readonly alignment?: MainAxisAlignment | null;
  /** @dartType double */ readonly overflowSpacing?: number;
  readonly overflowAlignment?: OverflowBarAlignment;
  readonly overflowDirection?: VerticalDirection;
  readonly textDirection?: 'ltr' | 'rtl' | null;
  readonly children?: readonly Widget[];
}
/** A horizontal bar which uses a vertical column when the children exceed its width. */
export class OverflowBar extends MultiChildRenderObjectWidget {
  /** @dartType double */ readonly spacing: number;
  readonly alignment: MainAxisAlignment | null;
  /** @dartType double */ readonly overflowSpacing: number;
  readonly overflowAlignment: OverflowBarAlignment;
  readonly overflowDirection: VerticalDirection;
  readonly textDirection: 'ltr' | 'rtl' | null;
  /** @dartParam spacing double
   * @dartParam overflowSpacing double */
  constructor(options: OverflowBarOptions = {}) {
    super(options.children ?? [], options);
    this.spacing = options.spacing ?? 0;
    this.alignment = options.alignment ?? null;
    this.overflowSpacing = options.overflowSpacing ?? 0;
    this.overflowAlignment = options.overflowAlignment ?? OverflowBarAlignment.start;
    this.overflowDirection = options.overflowDirection ?? VerticalDirection.down;
    this.textDirection = options.textDirection ?? null;
  }
  createRenderObject(context: BuildContext): RenderObject {
    return new RenderOverflowBar(this, this.textDirection ?? Directionality.of(context));
  }
  updateRenderObject(context: BuildContext, render: RenderOverflowBar): void {
    render.configure(this, this.textDirection ?? Directionality.of(context));
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DoubleProperty('spacing', this.spacing, { defaultValue: 0 }));
    properties.add(new EnumProperty('alignment', this.alignment, { defaultValue: null }));
    properties.add(
      new DoubleProperty('overflowSpacing', this.overflowSpacing, { defaultValue: 0 }),
    );
    properties.add(
      new EnumProperty('overflowAlignment', this.overflowAlignment, {
        defaultValue: OverflowBarAlignment.start,
      }),
    );
    properties.add(
      new EnumProperty('overflowDirection', this.overflowDirection, {
        defaultValue: VerticalDirection.down,
      }),
    );
    properties.add(new EnumProperty('textDirection', this.textDirection, { defaultValue: null }));
  }
}
interface Measurement {
  readonly size: Size;
  readonly sizes: readonly Size[];
  readonly width: number;
  readonly childrenWidth: number;
  readonly maxHeight: number;
  readonly overflow: boolean;
}
class RenderOverflowBar extends RenderBox {
  private options: OverflowBar;
  private direction: 'ltr' | 'rtl';
  constructor(options: OverflowBar, direction: 'ltr' | 'rtl') {
    super();
    this.options = options;
    this.direction = direction;
  }
  configure(options: OverflowBar, direction: 'ltr' | 'rtl'): void {
    const old = this.options;
    this.assertCanMutateLayoutProperty();
    this.options = options;
    if (
      old.spacing !== options.spacing ||
      old.alignment !== options.alignment ||
      old.overflowSpacing !== options.overflowSpacing ||
      old.overflowAlignment !== options.overflowAlignment ||
      old.overflowDirection !== options.overflowDirection ||
      this.direction !== direction
    ) {
      this.direction = direction;
      this.markNeedsLayout();
    }
  }
  private measure(constraints: BoxConstraints, dry: boolean): Measurement {
    const sizes = this.children.map((child) => {
      const loose = constraints.loosen();
      if (dry) return child.getDryLayout(loose);
      child.layout(loose, { parentUsesSize: true });
      return child.size;
    });
    const childrenWidth = sizes.reduce((n, size) => n + size.width, 0),
      maxHeight = Math.max(0, ...sizes.map((size) => size.height));
    if (!sizes.length)
      return {
        sizes,
        size: constraints.smallest,
        width: 0,
        childrenWidth,
        maxHeight,
        overflow: false,
      };
    const width = childrenWidth + this.options.spacing * (sizes.length - 1),
      overflow = width > constraints.maxWidth;
    const desired = overflow
      ? {
          width: constraints.maxWidth,
          height:
            sizes.reduce((n, size) => n + size.height, 0) +
            this.options.overflowSpacing * (sizes.length - 1),
        }
      : {
          width: this.options.alignment === null ? width : constraints.maxWidth,
          height: maxHeight,
        };
    return {
      sizes,
      size: constraints.constrain(desired),
      width,
      childrenWidth,
      maxHeight,
      overflow,
    };
  }
  private positions(m: Measurement, constraints: BoxConstraints): readonly Offset[] {
    const o = this.options,
      rtl = this.direction === 'rtl',
      result: Offset[] = Array(m.sizes.length);
    if (m.overflow) {
      let y = 0;
      const order = m.sizes.map((_, i) => i);
      if (o.overflowDirection === VerticalDirection.up) order.reverse();
      for (const index of order) {
        const size = m.sizes[index]!,
          free = constraints.maxWidth - size.width;
        const x =
          o.overflowAlignment === 'center'
            ? free / 2
            : o.overflowAlignment === 'start'
              ? rtl
                ? free
                : 0
              : rtl
                ? 0
                : free;
        result[index] = { x, y };
        y += size.height + o.overflowSpacing;
      }
      return result;
    }
    if (!m.sizes.length) return result;
    const firstWidth = m.sizes[0]!.width;
    let x = rtl ? m.size.width - firstWidth : 0,
      spacing = o.spacing;
    switch (o.alignment) {
      case null:
      case 'start':
        break;
      case 'center': {
        const half = (m.size.width - m.width) / 2;
        x = rtl ? m.size.width - half - firstWidth : half;
        break;
      }
      case 'end':
        x = rtl ? m.width - firstWidth : m.size.width - m.width;
        break;
      case 'spaceBetween':
        spacing = (m.size.width - m.childrenWidth) / (m.sizes.length - 1);
        break;
      case 'spaceAround':
        spacing = (m.size.width - m.childrenWidth) / m.sizes.length;
        x = rtl ? m.size.width - spacing / 2 - firstWidth : spacing / 2;
        break;
      case 'spaceEvenly':
        spacing = (m.size.width - m.childrenWidth) / (m.sizes.length + 1);
        x = rtl ? m.size.width - spacing - firstWidth : spacing;
        break;
    }
    m.sizes.forEach((size, index) => {
      result[index] = { x, y: (m.maxHeight - size.height) / 2 };
      if (!rtl) x += size.width + spacing;
      else if (index + 1 < m.sizes.length) x -= m.sizes[index + 1]!.width + spacing;
    });
    return result;
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    invariant(
      Number.isFinite(this.options.spacing) && Number.isFinite(this.options.overflowSpacing),
      'invalid-overflow-spacing',
      'OverflowBar spacing must be finite',
    );
    const measured = this.measure(constraints, false),
      positions = this.positions(measured, constraints);
    this.children.forEach((child, i) => {
      child.layoutOffset = positions[i]!;
    });
    return measured.size;
  }
  protected override computeDryLayout(constraints: BoxConstraints): Size {
    return this.measure(constraints, true).size;
  }
  protected override computeMinIntrinsicWidth(_height: number): number {
    return this.intrinsicWidth(false);
  }
  protected override computeMaxIntrinsicWidth(_height: number): number {
    return this.intrinsicWidth(true);
  }
  private intrinsicWidth(max: boolean): number {
    return (
      this.children.reduce(
        (n, child) =>
          n + (max ? child.getMaxIntrinsicWidth(Infinity) : child.getMinIntrinsicWidth(Infinity)),
        0,
      ) +
      this.options.spacing * Math.max(0, this.children.length - 1)
    );
  }
  protected override computeMinIntrinsicHeight(width: number): number {
    return this.intrinsicHeight(width, false);
  }
  protected override computeMaxIntrinsicHeight(width: number): number {
    return this.intrinsicHeight(width, true);
  }
  private intrinsicHeight(width: number, max: boolean): number {
    if (!this.children.length) return 0;
    const overflow = this.intrinsicWidth(false) > width;
    const heights = this.children.map((child) =>
      max ? child.getMaxIntrinsicHeight(width) : child.getMinIntrinsicHeight(width),
    );
    return overflow
      ? heights.reduce((n, h) => n + h, 0) + this.options.overflowSpacing * (heights.length - 1)
      : Math.max(...heights);
  }
  protected override computeDistanceToActualBaseline(baseline: TextBaseline): number | null {
    let result: number | null = null;
    for (const child of this.children) {
      const value = child.getDistanceToActualBaseline(baseline);
      if (value !== null) result = Math.min(result ?? Infinity, value + child.layoutOffset.y);
    }
    return result;
  }
  protected override computeDryBaseline(
    constraints: BoxConstraints,
    baseline: TextBaseline,
  ): number | null {
    const measured = this.measure(constraints, true),
      order = this.children.map((_, i) => i);
    if (this.options.overflowDirection === VerticalDirection.up) order.reverse();
    let height = 0,
      y = 0,
      horizontal: number | null = null,
      vertical: number | null = null;
    for (const i of order) {
      const childHeight = measured.sizes[i]!.height,
        difference = childHeight - height;
      if (difference > 0) {
        if (horizontal !== null) horizontal += difference / 2;
        height = childHeight;
      }
      const value = this.children[i]!.getDryBaseline(constraints.loosen(), baseline);
      if (value !== null) {
        vertical ??= value + y;
        horizontal = Math.min(horizontal ?? Infinity, value + height - childHeight);
      }
      y += childHeight + this.options.overflowSpacing;
    }
    return measured.overflow ? vertical : horizontal;
  }
}
