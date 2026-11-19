// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/mergeable_material.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { KeyMap, LocalKey, UniqueKey } from '@nelyx/core/foundation/key';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Curves } from '@nelyx/core/framework/animation/curves';
import type { TickerProvider } from '@nelyx/core/framework/animation/ticker';
import { Alignment, AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { Border } from '@nelyx/core/framework/painting/box-border';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import { RenderListBody } from '@nelyx/core/framework/rendering/list-body';
import type { ListBodyAxisDirection } from '@nelyx/core/framework/rendering/list-body';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { DecoratedBox, SizedBox } from '@nelyx/core/framework/widgets/basic';
import { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type {
  BuildContext,
  State,
  Widget,
  WidgetOptions,
} from '@nelyx/core/framework/widgets/framework';
import { AnimatedContainer } from '@nelyx/core/framework/widgets/implicit-animations';
import { ListBody } from '@nelyx/core/framework/widgets/list-body';
import { ConstraintsTransformBox } from '@nelyx/core/framework/widgets/overflow-box';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import type { Color } from '@nelyx/core/ui/color';
import { Path } from '@nelyx/core/ui/path';
import { Radius } from '@nelyx/core/ui/radius';
import { Rect } from '@nelyx/core/ui/rect';
import { kThemeChangeDuration } from './constants.ts';
import { Divider } from './divider.ts';
import { Material, MaterialType } from './material.ts';
import { Theme } from './theme.ts';

export abstract class MergeableMaterialItem {
  constructor(readonly key: LocalKey) {
    invariant(
      key instanceof LocalKey,
      'invalid-material-item-key',
      'Material slices and gaps require LocalKeys',
    );
  }
}

export interface MaterialSliceOptions {
  readonly key: LocalKey;
  readonly child: Widget;
  readonly color?: Color | null;
}

export class MaterialSlice extends MergeableMaterialItem {
  readonly child: Widget;
  readonly color: Color | null;

  constructor({ key, child, color = null }: MaterialSliceOptions) {
    super(key);
    this.child = child;
    this.color = color;
  }
}

export interface MaterialGapOptions {
  readonly key: LocalKey;
  readonly size?: number;
}

export class MaterialGap extends MergeableMaterialItem {
  readonly size: number;

  constructor({ key, size = 16 }: MaterialGapOptions) {
    super(key);
    invariant(
      Number.isFinite(size) && size >= 0,
      'invalid-material-gap',
      'Material gap size must be finite and nonnegative',
    );
    this.size = size;
  }
}

type MaterialItem = MaterialSlice | MaterialGap;
export interface MergeableMaterialOptions extends WidgetOptions {
  readonly children?: readonly MergeableMaterialItem[];
  readonly mainAxis?: 'vertical' | 'horizontal';
  readonly elevation?: number;
  readonly hasDividers?: boolean;
  readonly dividerColor?: Color | null;
}

export class MergeableMaterial extends StatefulWidget {
  readonly children: readonly MaterialItem[];
  readonly mainAxis: 'vertical' | 'horizontal';
  readonly elevation: number;
  readonly hasDividers: boolean;
  readonly dividerColor: Color | null;

  constructor({
    key = null,
    children = [],
    mainAxis = 'vertical',
    elevation = 2,
    hasDividers = false,
    dividerColor = null,
  }: MergeableMaterialOptions = {}) {
    super(key);
    const keys = new KeyMap<boolean>();
    const entries = children.map((child, index) => {
      invariant(
        child instanceof MaterialSlice || child instanceof MaterialGap,
        'invalid-mergeable-material-item',
        'MergeableMaterial accepts MaterialSlice and MaterialGap items',
      );
      invariant(
        !keys.has(child.key),
        'duplicate-mergeable-material-key',
        'MergeableMaterial child keys must be distinct',
      );
      keys.set(child.key, true);
      if (child instanceof MaterialGap) {
        invariant(
          children[index - 1] instanceof MaterialSlice &&
            children[index + 1] instanceof MaterialSlice,
          'invalid-mergeable-material-gap',
          'Each MaterialGap must be between two MaterialSlices',
        );
      }
      return child;
    });
    invariant(
      Number.isFinite(elevation) && elevation >= 0,
      'invalid-mergeable-material-elevation',
      'Elevation must be finite and nonnegative',
    );
    this.children = Object.freeze(entries);
    this.mainAxis = mainAxis;
    this.elevation = elevation;
    this.hasDividers = hasDividers;
    this.dividerColor = dividerColor;
  }

  override createState(): State<MergeableMaterial> {
    return new MergeableMaterialState();
  }
}

const cardCorner = 2;
const shadowRadius = BorderRadius.circular(cardCorner);

class GapAnimation {
  readonly controller: AnimationController;
  private fromSize: number;
  private fromOpening: number;
  private targetSize: number;
  private targetOpening = 1;

  constructor(
    vsync: TickerProvider,
    onTick: () => void,
    size: number,
    opening: number,
    animateTo: number,
  ) {
    this.fromSize = size;
    this.fromOpening = opening;
    this.targetSize = animateTo;
    const settled = size === animateTo && opening === 1;
    this.controller = new AnimationController({
      vsync,
      value: settled ? 1 : 0,
      duration: kThemeChangeDuration,
    });
    this.controller.addListener(onTick);
    if (!settled) this.controller.forward();
  }

  private get t(): number {
    return Curves.fastOutSlowIn.transform(this.controller.value);
  }

  get extent(): number {
    return this.fromSize + (this.targetSize - this.fromSize) * this.t;
  }

  get opening(): number {
    return this.fromOpening + (this.targetOpening - this.fromOpening) * this.t;
  }

  get closing(): boolean {
    return this.targetOpening === 0;
  }

  get finishedClosing(): boolean {
    return this.closing && this.controller.value === 1;
  }

  retarget(extent: number, opening: number): void {
    if (this.targetSize === extent && this.targetOpening === opening) return;
    this.fromSize = this.extent;
    this.fromOpening = this.opening;
    this.targetSize = extent;
    this.targetOpening = opening;
    this.controller.forward({ from: 0 });
  }

  dispose(): void {
    this.controller.dispose();
  }
}

class MergeableMaterialState extends TickerProviderStateMixin<MergeableMaterial> {
  private items: MaterialItem[] = [];
  private gaps = new KeyMap<GapAnimation>();
  private readonly onGapTick = () => this.setState(() => {});

  override initState(): void {
    super.initState();
    this.items = [...this.widget.children];
    for (const item of this.items) if (item instanceof MaterialGap) this.addGap(item, item.size, 1);
  }

  private addGap(gap: MaterialGap, start: number, opening: number): GapAnimation {
    const animation = new GapAnimation(this, this.onGapTick, start, opening, gap.size);
    this.gaps.set(gap.key, animation);
    return animation;
  }

  private removeGap(gap: MaterialGap): void {
    this.gaps.get(gap.key)?.dispose();
    this.gaps.delete(gap.key);
  }

  private pruneClosedGaps(): void {
    this.items = this.items.filter((item) => {
      if (!(item instanceof MaterialGap) || !this.gaps.get(item.key)?.finishedClosing) return true;
      this.removeGap(item);
      return false;
    });
  }

  override didUpdateWidget(old: MergeableMaterial): void {
    super.didUpdateWidget(old);
    this.pruneClosedGaps();
    const next = this.widget.children;
    const oldSlices = new KeyMap<boolean>();
    for (const item of this.items) if (item instanceof MaterialSlice) oldSlices.set(item.key, true);
    const nextKeys = new KeyMap<boolean>();
    const nextSliceIndices = new KeyMap<number>();
    const nextGapKeys = new KeyMap<boolean>();
    const nextAnchorAfter = new Map<number, number>();
    let previousAnchor: number | undefined;
    for (const [index, item] of next.entries()) {
      nextKeys.set(item.key, true);
      if (item instanceof MaterialGap) {
        nextGapKeys.set(item.key, true);
      } else {
        nextSliceIndices.set(item.key, index);
        if (oldSlices.has(item.key)) {
          if (previousAnchor !== undefined) nextAnchorAfter.set(previousAnchor, index);
          previousAnchor = index;
        }
      }
    }

    // Collect removed gaps between slices that still border the same interval.
    const removedByAnchor = new Map<number, MaterialGap[]>();
    let left: number | undefined;
    let removed: MaterialGap[] = [];
    for (const item of this.items) {
      if (item instanceof MaterialGap) {
        if (!nextGapKeys.has(item.key)) removed.push(item);
        continue;
      }
      const right = nextSliceIndices.get(item.key);
      if (right === undefined) continue;
      if (removed.length && left !== undefined && nextAnchorAfter.get(left) === right) {
        removedByAnchor.set(left, removed);
      }
      left = right;
      removed = [];
    }

    const starts = new KeyMap<number>();
    const closingAfter = new Map<number, MaterialGap>();
    for (const [anchor, gaps] of removedByAnchor) {
      const end = nextAnchorAfter.get(anchor)!;
      const extent = gaps.reduce((total, gap) => total + this.gaps.get(gap.key)!.extent, 0);
      const inserted = next
        .slice(anchor + 1, end)
        .filter(
          (item): item is MaterialGap => item instanceof MaterialGap && !this.gaps.has(item.key),
        );
      const addedExtent = inserted.reduce((total, gap) => total + gap.size, 0);
      if (addedExtent > 0) {
        for (const gap of inserted) starts.set(gap.key, (extent * gap.size) / addedExtent);
      } else if (end === anchor + 1) {
        const first = gaps[0]!;
        const key = gaps.length === 1 && !nextKeys.has(first.key) ? first.key : new UniqueKey();
        closingAfter.set(anchor, new MaterialGap({ key, size: extent }));
      }
    }

    const previousMotions = this.gaps;
    this.gaps = new KeyMap();
    const retained = new Set<GapAnimation>();
    const nextItems: MaterialItem[] = [];
    for (const [index, item] of next.entries()) {
      nextItems.push(item);
      if (item instanceof MaterialGap) {
        const motion = previousMotions.get(item.key);
        if (motion) {
          retained.add(motion);
          this.gaps.set(item.key, motion);
          motion.retarget(item.size, 1);
        } else {
          this.addGap(item, starts.get(item.key) ?? 0, 0);
        }
      }
      const closing = closingAfter.get(index);
      if (closing) {
        const previousMotion = previousMotions.get(closing.key);
        const motion = previousMotion ?? this.addGap(closing, closing.size, 1);
        if (previousMotion) {
          retained.add(previousMotion);
          this.gaps.set(closing.key, previousMotion);
        }
        motion.retarget(0, 0);
        nextItems.push(closing);
      }
    }
    this.items = nextItems;
    for (const oldMotion of previousMotions.values())
      if (!retained.has(oldMotion)) oldMotion.dispose();
  }

  override dispose(): void {
    for (const gap of this.gaps.values()) gap.dispose();
    this.gaps.clear();
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    this.pruneClosedGaps();
    const { mainAxis, elevation, hasDividers, dividerColor } = this.widget;
    const vertical = mainAxis === 'vertical';
    const rtl = !vertical && Directionality.of(context) === 'rtl';
    const cardColor = Theme.of(context).cardColor;
    const divider = hasDividers
      ? Divider.createBorderSide(context, { color: dividerColor, width: 0.5 })
      : BorderSide.none;
    const children = this.items.map((item, index) => {
      if (item instanceof MaterialGap) {
        const extent = this.gaps.get(item.key)!.extent;
        return new SizedBox(
          vertical ? undefined : extent,
          vertical ? extent : undefined,
          undefined,
          item.key,
        );
      }
      const before = this.items[index - 1];
      const after = this.items[index + 1];
      const radiusAt = (neighbour: MaterialItem | undefined) =>
        Radius.circular(
          cardCorner *
            (neighbour === undefined
              ? 1
              : neighbour instanceof MaterialGap
                ? this.gaps.get(neighbour.key)!.opening
                : 0),
        );
      const start = radiusAt(before);
      const end = radiusAt(after);
      const borderRadius = vertical
        ? BorderRadius.vertical({ top: start, bottom: end })
        : BorderRadius.horizontal({ left: rtl ? end : start, right: rtl ? start : end });
      const dividerAt = (neighbour: MaterialItem | undefined) =>
        neighbour instanceof MaterialSlice ||
        (neighbour instanceof MaterialGap && this.gaps.get(neighbour.key)!.closing)
          ? divider
          : BorderSide.none;
      const child = hasDividers
        ? new AnimatedContainer({
            duration: kThemeChangeDuration,
            curve: Curves.fastOutSlowIn,
            decoration: new BoxDecoration({
              border: new Border({ top: dividerAt(before), bottom: dividerAt(after) }),
            }),
            child: item.child,
          })
        : item.child;
      return new DecoratedBox(new Material({ type: MaterialType.transparency, child }), {
        key: item.key,
        decoration: new BoxDecoration({
          color: (item.color ?? cardColor).toARGB32(),
          borderRadius,
        }),
      });
    });
    const body = new MergeableMaterialBody(
      children,
      mainAxis,
      vertical ? 'down' : rtl ? 'left' : 'right',
      this.items.map((item) => item instanceof MaterialGap),
      elevation,
      MediaQuery.maybeDevicePixelRatioOf(context) ?? 1,
    );
    return new ConstraintsTransformBox(body, {
      constraintsTransform: vertical
        ? ConstraintsTransformBox.maxHeightUnconstrained
        : ConstraintsTransformBox.maxWidthUnconstrained,
      alignment: vertical ? Alignment.topCenter : AlignmentDirectional.centerStart,
    });
  }
}

class MergeableMaterialBody extends ListBody {
  constructor(
    children: readonly Widget[],
    mainAxis: 'vertical' | 'horizontal',
    private readonly axis: ListBodyAxisDirection,
    private readonly gaps: readonly boolean[],
    private readonly elevation: number,
    private readonly scale: number,
  ) {
    super(children, { mainAxis });
  }

  override createRenderObject(): RenderMergeableMaterialBody {
    const render = new RenderMergeableMaterialBody({ axisDirection: this.axis });
    render.configure(this.axis, this.gaps, this.elevation, this.scale);
    return render;
  }

  override updateRenderObject(_context: BuildContext, render: RenderObject): void {
    invariant(
      render instanceof RenderMergeableMaterialBody,
      'invalid-mergeable-material-render',
      'MergeableMaterial requires its list renderer',
    );
    render.configure(this.axis, this.gaps, this.elevation, this.scale);
  }
}

class RenderMergeableMaterialBody extends RenderListBody {
  private gaps: readonly boolean[] = [];
  private elevation = 0;
  private scale = 1;

  configure(
    axis: ListBodyAxisDirection,
    gaps: readonly boolean[],
    elevation: number,
    scale: number,
  ): void {
    this.axisDirection = axis;
    if (
      this.elevation !== elevation ||
      this.scale !== scale ||
      this.gaps.length !== gaps.length ||
      this.gaps.some((gap, index) => gap !== gaps[index])
    ) {
      this.gaps = gaps;
      this.elevation = elevation;
      this.scale = scale;
      this.markNeedsPaint();
    }
  }

  override paint(context: PaintingContext): void {
    if (this.elevation !== 0) {
      let group: Rect | null = null;
      const paintShadow = (rect: Rect) => {
        const path = new Path();
        path.addRRect(shadowRadius.toRRect(rect));
        context.canvas.drawShadow(path, 0xff000000, this.elevation, true, this.scale);
      };
      for (const [index, child] of this.children.entries()) {
        if (this.gaps[index]) {
          if (group) paintShadow(group);
          group = null;
        } else {
          const { x, y } = child.layoutOffset;
          const rect = Rect.fromLTWH(x, y, child.size.width, child.size.height);
          group = group ? group.expandToInclude(rect) : rect;
        }
      }
      if (group) paintShadow(group);
    }
    super.paint(context);
  }
}
