// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {
  StatelessWidget,
  SingleChildRenderObjectWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { Widget, WidgetOptions, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { SizedBox, Text, Stack, Positioned } from '@nelyx/core/framework/widgets/basic';
import { Container } from '@nelyx/core/framework/widgets/container';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { Alignment, AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import type { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { StadiumBorder } from '@nelyx/core/framework/painting/stadium-border';
import { ColorShapeDecoration } from '@nelyx/core/framework/painting/color-shape-decoration';
import { RenderAligningShiftedBox } from '@nelyx/core/framework/rendering/shifted-box';
import { RenderProxyBox } from '@nelyx/core/framework/rendering/boxes';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { RenderBox, RenderObject, TextBaseline } from '@nelyx/core/framework/rendering/object';
import type { Size } from '@nelyx/core/ui/geometry';
import { Offset } from '@nelyx/core/ui/offset';
import type { Color } from '@nelyx/core/ui/color';
import { invariant } from '@nelyx/core/foundation/errors';
import { BadgeTheme } from './badge-theme.ts';
import { Theme } from './theme.ts';
import { materialSchemeColor } from './internal/theme/default-color-schemes.ts';

export interface BadgeOptions extends WidgetOptions {
  readonly backgroundColor?: Color | null;
  readonly textColor?: Color | null;
  /** @dartType double? */ readonly smallSize?: number | null;
  /** @dartType double? */ readonly largeSize?: number | null;
  readonly textStyle?: TextStyle | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly alignment?: AlignmentGeometry | null;
  readonly offset?: Offset | null;
  readonly label?: Widget | null;
  readonly isLabelVisible?: boolean;
  readonly child?: Widget | null;
}
export interface BadgeCountOptions extends Omit<BadgeOptions, 'label'> {
  /** @dartType int */ readonly count: number;
  /** @dartType int */ readonly maxCount?: number;
}
const shape = new StadiumBorder(),
  padding = EdgeInsets.symmetric({ horizontal: 4 });

/** M3 status dot or intrinsic stadium label, positioned without changing its child's layout. */
export class Badge extends StatelessWidget {
  readonly backgroundColor: Color | null;
  readonly textColor: Color | null;
  /** @dartType double? */ readonly smallSize: number | null;
  /** @dartType double? */ readonly largeSize: number | null;
  readonly textStyle: TextStyle | null;
  readonly padding: EdgeInsetsGeometry | null;
  readonly alignment: AlignmentGeometry | null;
  readonly offset: Offset | null;
  readonly label: Widget | null;
  readonly isLabelVisible: boolean;
  readonly child: Widget | null;
  /** @dartParam smallSize double?
   * @dartParam largeSize double? */
  constructor(options: BadgeOptions = {}) {
    super(options.key ?? null);
    this.backgroundColor = options.backgroundColor ?? null;
    this.textColor = options.textColor ?? null;
    this.smallSize = options.smallSize ?? null;
    this.largeSize = options.largeSize ?? null;
    this.textStyle = options.textStyle ?? null;
    this.padding = options.padding ?? null;
    this.alignment = options.alignment ?? null;
    this.offset = options.offset ?? null;
    this.label = options.label ?? null;
    this.isLabelVisible = options.isLabelVisible ?? true;
    this.child = options.child ?? null;
  }
  /** @dartParam smallSize double?
   * @dartParam largeSize double?
   * @dartParam count int
   * @dartParam maxCount int */
  static count(options: BadgeCountOptions): Badge {
    const count = options.count,
      maxCount = options.maxCount ?? 999;
    invariant(
      Number.isSafeInteger(count) && count >= 0,
      'invalid-badge-count',
      'count must be a nonnegative safe integer',
    );
    invariant(
      Number.isSafeInteger(maxCount) && maxCount > 0,
      'invalid-badge-max-count',
      'maxCount must be a positive safe integer',
    );
    return new Badge({
      key: options.key ?? null,
      backgroundColor: options.backgroundColor ?? null,
      textColor: options.textColor ?? null,
      smallSize: options.smallSize ?? null,
      largeSize: options.largeSize ?? null,
      textStyle: options.textStyle ?? null,
      padding: options.padding ?? null,
      alignment: options.alignment ?? null,
      offset: options.offset ?? null,
      label: new Text(count > maxCount ? `${maxCount}+` : `${count}`),
      isLabelVisible: options.isLabelVisible ?? true,
      child: options.child ?? null,
    });
  }
  override build(context: BuildContext): Widget {
    if (!this.isLabelVisible) return this.child ?? new SizedBox();
    const badgeTheme = BadgeTheme.of(context),
      theme = () => Theme.of(context),
      hasLabel = this.label !== null;
    const decoration = new ColorShapeDecoration(
      shape,
      this.backgroundColor ??
        badgeTheme.backgroundColor ??
        materialSchemeColor(theme().colorScheme, 'error'),
    );
    const extent = hasLabel
      ? (this.largeSize ?? badgeTheme.largeSize ?? 16)
      : (this.smallSize ?? badgeTheme.smallSize ?? 6);
    const badge = hasLabel
      ? new DefaultTextStyle(
          (this.textStyle ?? badgeTheme.textStyle ?? theme().textTheme.labelSmall!).copyWith({
            color: (
              this.textColor ??
              badgeTheme.textColor ??
              materialSchemeColor(theme().colorScheme, 'onError')
            ).toARGB32(),
          }),
          new IntrinsicHorizontalStadium(
            extent,
            new Container({
              clipBehavior: 'antiAlias',
              decoration,
              padding: this.padding ?? badgeTheme.padding ?? padding,
              alignment: Alignment.center,
              child: this.label,
            }),
          ),
        )
      : new Container({ width: extent, height: extent, clipBehavior: 'antiAlias', decoration });
    if (this.child === null) return badge;
    const direction = Directionality.of(context),
      offset = (
        this.offset ??
        badgeTheme.offset ??
        new Offset(direction === 'ltr' ? 4 : -4, -4)
      ).add(new Offset(0, 8));
    return new Stack(
      [
        this.child,
        Positioned.fill(
          new BadgePosition(
            this.alignment ?? badgeTheme.alignment ?? AlignmentDirectional.topEnd,
            hasLabel ? offset : Offset.zero,
            extent,
            hasLabel,
            badge,
          ),
        ),
      ],
      { clipBehavior: 'none' },
    );
  }
}

class BadgePosition extends SingleChildRenderObjectWidget {
  constructor(
    readonly alignment: AlignmentGeometry,
    readonly offset: Offset,
    readonly widthOffset: number,
    readonly hasLabel: boolean,
    child: Widget,
  ) {
    super(child);
  }
  createRenderObject(context: BuildContext): RenderObject {
    return new RenderBadge(
      this.alignment,
      this.offset,
      this.widthOffset,
      this.hasLabel,
      Directionality.maybeOf(context),
    );
  }
  updateRenderObject(context: BuildContext, render: RenderBadge): void {
    render.alignment = this.alignment;
    render.textDirection = Directionality.maybeOf(context);
    render.configure(this.offset, this.widthOffset, this.hasLabel);
  }
}
class RenderBadge extends RenderAligningShiftedBox {
  constructor(
    alignment: AlignmentGeometry,
    private badgeOffset: Offset,
    private widthOffset: number,
    private hasLabel: boolean,
    direction: 'ltr' | 'rtl' | null,
  ) {
    super({ alignment, textDirection: direction });
  }
  configure(offset: Offset, widthOffset: number, hasLabel: boolean): void {
    if (
      this.badgeOffset.equals(offset) &&
      this.widthOffset === widthOffset &&
      this.hasLabel === hasLabel
    )
      return;
    this.assertCanMutateLayoutProperty();
    this.badgeOffset = offset;
    this.widthOffset = widthOffset;
    this.hasLabel = hasLabel;
    this.markNeedsLayout();
  }
  private location(size: Size, height: number): Offset {
    return this.badgeOffset
      .add(
        this.resolvedAlignment.alongOffset(new Offset(size.width - this.widthOffset, size.height)),
      )
      .subtract(new Offset(0, this.hasLabel ? height / 2 : 0));
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    invariant(
      constraints.hasBoundedWidth && constraints.hasBoundedHeight,
      'unbounded-badge',
      'Badge positioning requires bounded dimensions',
    );
    const child = this.child!,
      size = constraints.biggest;
    child.layout(new BoxConstraints(), { parentUsesSize: true });
    child.layoutOffset = this.location(size, child.size.height);
    return size;
  }
  protected override computeDryLayout(constraints: BoxConstraints): Size {
    return constraints.biggest;
  }
  protected override computeDryBaseline(
    constraints: BoxConstraints,
    baseline: TextBaseline,
  ): number | null {
    const child = this.child;
    if (!child) return null;
    const loose = new BoxConstraints(),
      value = child.getDryBaseline(loose, baseline);
    return value === null
      ? null
      : value + this.location(this.getDryLayout(constraints), child.getDryLayout(loose).height).dy;
  }
}
class IntrinsicHorizontalStadium extends SingleChildRenderObjectWidget {
  constructor(
    readonly minSize: number,
    child: Widget,
  ) {
    super(child);
  }
  createRenderObject(): RenderObject {
    return new RenderIntrinsicHorizontalStadium(this.minSize);
  }
  updateRenderObject(_context: BuildContext, render: RenderIntrinsicHorizontalStadium): void {
    render.minSize = this.minSize;
  }
}
class RenderIntrinsicHorizontalStadium extends RenderProxyBox {
  constructor(private minimum: number) {
    super();
  }
  set minSize(value: number) {
    if (this.minimum === value) return;
    this.assertCanMutateLayoutProperty();
    this.minimum = value;
    this.markNeedsLayout();
  }
  protected override computeMinIntrinsicWidth(height: number): number {
    return this.getMaxIntrinsicWidth(height);
  }
  protected override computeMaxIntrinsicWidth(height: number): number {
    return Math.max(this.getMaxIntrinsicHeight(Infinity), super.computeMaxIntrinsicWidth(height));
  }
  protected override computeMinIntrinsicHeight(width: number): number {
    return this.getMaxIntrinsicHeight(width);
  }
  protected override computeMaxIntrinsicHeight(width: number): number {
    return Math.max(this.minimum, super.computeMaxIntrinsicHeight(width));
  }
  private childConstraints(
    child: RenderBox<RenderObject>,
    constraints: BoxConstraints,
  ): BoxConstraints {
    const height = Math.max(this.minimum, child.getMaxIntrinsicHeight(constraints.maxWidth)),
      width = child.getMaxIntrinsicWidth(constraints.maxHeight);
    return constraints.tighten(Math.max(width, height), height);
  }
  private measure(constraints: BoxConstraints, dry: boolean): Size {
    const child = this.child!,
      c = this.childConstraints(child, constraints);
    if (!dry) {
      child.layout(c, { parentUsesSize: true });
      child.layoutOffset = Offset.zero;
    }
    const size = dry ? child.getDryLayout(c) : child.size;
    return size.height > size.width ? { width: size.height, height: size.height } : size;
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    return this.measure(constraints, false);
  }
  protected override computeDryLayout(constraints: BoxConstraints): Size {
    return this.measure(constraints, true);
  }
  protected override computeDryBaseline(
    constraints: BoxConstraints,
    baseline: TextBaseline,
  ): number | null {
    return this.child!.getDryBaseline(this.childConstraints(this.child!, constraints), baseline);
  }
}
