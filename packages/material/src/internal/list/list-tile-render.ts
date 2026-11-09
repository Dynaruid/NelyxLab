// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source four-slot geometry on the current Core render protocol.
import {
  MultiChildRenderObjectWidget,
  SingleChildRenderObjectWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { RenderBox as CoreRenderBox, RenderObject } from '@nelyx/core/framework/rendering/object';
import { RenderProxyBox } from '@nelyx/core/framework/rendering/boxes';
import type { TextBaseline, HitTestEntry } from '@nelyx/core/framework/rendering/object';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import type { Offset, Size, TransformMatrix } from '@nelyx/core/ui/geometry';
import {
  identity,
  multiply,
  transform,
  inversePaintTransform,
  contains,
} from '@nelyx/core/ui/geometry';
import { invariant } from '@nelyx/core/foundation/errors';
import type { VisualDensity } from '../../theme-data.ts';
import { ListTileTitleAlignment } from '../../generated/list/list-tile-types.ts';
import {
  NativeLayoutBuilder,
  nativeLayoutExpression as expr,
  nativeLayoutInput as input,
  registerNativeBoxConfiguration,
} from '@nelyx/core/framework/rendering/object';
import type {
  NativeLayoutProgram,
  NativeLayoutScalar,
} from '@nelyx/core/framework/rendering/object';
type RenderBox = CoreRenderBox<RenderObject>;
export interface ListTileRenderOptions {
  readonly leading: Widget | null;
  readonly title: Widget;
  readonly subtitle: Widget | null;
  readonly trailing: Widget | null;
  readonly isDense: boolean;
  readonly isThreeLine: boolean;
  readonly visualDensity: VisualDensity;
  readonly textDirection: 'ltr' | 'rtl';
  readonly titleBaselineType: TextBaseline;
  readonly subtitleBaselineType: TextBaseline | null;
  readonly horizontalTitleGap: number;
  readonly minVerticalPadding: number;
  readonly minLeadingWidth: number;
  readonly minTileHeight: number | null;
  readonly titleAlignment: ListTileTitleAlignment;
}
interface TileSizes {
  readonly titleY: number;
  readonly textConstraints: BoxConstraints;
  readonly size: Size;
  readonly positions: readonly (Offset | null)[];
}
export function listTileChildY(
  alignment: ListTileTitleAlignment,
  childHeight: number,
  tileHeight: number,
  isThreeLine: boolean,
  minVerticalPadding: number,
  isLeading: boolean,
): number {
  if (alignment === ListTileTitleAlignment.threeLine)
    return listTileChildY(
      isThreeLine ? ListTileTitleAlignment.top : ListTileTitleAlignment.center,
      childHeight,
      tileHeight,
      isThreeLine,
      minVerticalPadding,
      isLeading,
    );
  if (alignment === ListTileTitleAlignment.titleHeight)
    return tileHeight > 72
      ? 16
      : isLeading
        ? Math.min((tileHeight - childHeight) / 2, 16)
        : (tileHeight - childHeight) / 2;
  if (alignment === ListTileTitleAlignment.top) return minVerticalPadding;
  if (alignment === ListTileTitleAlignment.center) return (tileHeight - childHeight) / 2;
  if (alignment === ListTileTitleAlignment.bottom)
    return tileHeight - childHeight - minVerticalPadding;
  throw new TypeError('Unknown ListTileTitleAlignment');
}
export class RenderListTile extends CoreRenderBox {
  constructor(private options: ListTileRenderOptions) {
    super();
  }
  protected override get childCountLimit(): number {
    return 4;
  }
  configure(options: ListTileRenderOptions): void {
    this.options = options;
    this.markNeedsLayout();
  }
  /** Numeric component policy only; Content owns every child result and placement. */
  _nativeLayoutProgram(): NativeLayoutProgram {
    const o = this.options,
      b = new NativeLayoutBuilder(),
      width = input.maxWidth;
    b.assert(expr('finite', width));
    const icons = [
      0,
      width,
      0,
      expr('min', input.maxHeight, (o.isDense ? 48 : 56) + o.visualDensity.baseSizeAdjustment.dy),
    ] as const;
    const leading = b.child(0, o.leading === null ? [0, 0, 0, 0] : icons);
    const trailing = b.child(3, o.trailing === null ? [0, 0, 0, 0] : icons);
    for (const icon of [o.leading === null ? null : leading, o.trailing === null ? null : trailing])
      if (icon)
        b.assert(
          expr(
            'select',
            expr('equal', width, 0),
            1,
            expr('select', expr('equal', icon.width, width), 0, 1),
          ),
        );
    const start = b.value(
      o.leading === null ? 0 : expr('add', expr('max', o.minLeadingWidth, leading.width), this.gap),
    );
    const end = b.value(
      o.trailing === null ? 0 : expr('max', expr('add', trailing.width, this.gap), 32),
    );
    const textWidth = b.value(
      expr('clamp', expr('subtract', expr('subtract', width, start), end), 0, width),
    );
    const textConstraints = [textWidth, textWidth, 0, input.maxHeight] as const;
    const title = b.child(1, textConstraints);
    const subtitle = b.child(2, o.subtitle === null ? [0, 0, 0, 0] : textConstraints);
    let height: NativeLayoutScalar, titleY: NativeLayoutScalar;
    const textX = o.textDirection === 'ltr' ? start : end;
    if (o.subtitle === null) {
      height = b.value(
        expr('max', this.targetHeight, expr('add', title.height, 2 * o.minVerticalPadding)),
      );
      titleY = expr('divide', expr('subtract', height, title.height), 2);
      b.place(2, 0, 0);
    } else {
      const baseline = (child: typeof title, type: TextBaseline | null): NativeLayoutScalar => {
        if (type === null) throw Error('ListTile subtitle requires a baseline type');
        return expr(
          'select',
          type === 'alphabetic' ? child.hasBaseline : child.hasIdeographicBaseline,
          type === 'alphabetic' ? child.baseline : child.ideographicBaseline,
          child.height,
        );
      };
      const targetTitle = b.value(
        expr(
          'subtract',
          o.isThreeLine ? (o.isDense ? 22 : 28) : o.isDense ? 28 : 32,
          baseline(title, o.titleBaselineType),
        ),
      );
      const targetSubtitle = b.value(
        expr(
          'subtract',
          (o.isThreeLine ? (o.isDense ? 42 : 48) : o.isDense ? 48 : 52) +
            o.visualDensity.vertical * 2,
          baseline(subtitle, o.subtitleBaselineType),
        ),
      );
      const overlap = b.value(
        expr(
          'divide',
          expr('max', expr('subtract', expr('add', targetTitle, title.height), targetSubtitle), 0),
          2,
        ),
      );
      const idealTitle = expr('subtract', targetTitle, overlap),
        idealSubtitle = expr('add', targetSubtitle, overlap);
      const compact = b.value(
        expr(
          'max',
          expr('less', idealTitle, o.minVerticalPadding),
          expr(
            'greater',
            expr('add', expr('add', idealSubtitle, subtitle.height), o.minVerticalPadding),
            this.targetHeight,
          ),
        ),
      );
      height = b.value(
        expr(
          'select',
          compact,
          expr('add', expr('add', title.height, subtitle.height), 2 * o.minVerticalPadding),
          this.targetHeight,
        ),
      );
      titleY = expr('select', compact, o.minVerticalPadding, idealTitle);
      b.place(
        2,
        textX,
        expr('select', compact, expr('add', o.minVerticalPadding, title.height), idealSubtitle),
      );
    }
    b.place(1, textX, titleY);
    const childY = (childHeight: NativeLayoutScalar, isLeading: boolean): NativeLayoutScalar => {
      const alignment =
        o.titleAlignment === ListTileTitleAlignment.threeLine
          ? o.isThreeLine
            ? ListTileTitleAlignment.top
            : ListTileTitleAlignment.center
          : o.titleAlignment;
      const center = expr('divide', expr('subtract', height, childHeight), 2);
      if (alignment === ListTileTitleAlignment.titleHeight)
        return expr(
          'select',
          expr('greater', height, 72),
          16,
          isLeading ? expr('min', center, 16) : center,
        );
      if (alignment === ListTileTitleAlignment.top) return o.minVerticalPadding;
      if (alignment === ListTileTitleAlignment.center) return center;
      if (alignment === ListTileTitleAlignment.bottom)
        return expr('subtract', expr('subtract', height, childHeight), o.minVerticalPadding);
      throw Error('Unknown ListTileTitleAlignment');
    };
    b.place(
      0,
      o.leading === null || o.textDirection === 'ltr' ? 0 : expr('subtract', width, leading.width),
      o.leading === null ? 0 : childY(leading.height, true),
    );
    b.place(
      3,
      o.trailing !== null && o.textDirection === 'ltr'
        ? expr('subtract', width, trailing.width)
        : 0,
      o.trailing === null ? 0 : childY(trailing.height, false),
    );
    b.size(width, height);
    b.baseline(
      expr('add', title.baseline, titleY),
      title.hasBaseline,
      expr('add', title.ideographicBaseline, titleY),
      title.hasIdeographicBaseline,
    );
    const intrinsic = (mode: 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight') => {
      const q = new NativeLayoutBuilder();
      if (mode === 'minWidth' || mode === 'maxWidth') {
        const left =
          o.leading === null
            ? 0
            : expr('add', expr('max', q.query(0, mode, input.extent), o.minLeadingWidth), this.gap);
        const text = expr(
          'max',
          q.query(1, mode, input.extent),
          o.subtitle === null ? 0 : q.query(2, mode, input.extent),
        );
        q.result(
          expr(
            'add',
            expr('add', left, text),
            o.trailing === null ? 0 : q.query(3, 'maxWidth', input.extent),
          ),
        );
      } else
        q.result(
          expr(
            'max',
            this.targetHeight,
            expr(
              'add',
              expr(
                'add',
                q.query(1, 'minHeight', input.extent),
                o.subtitle === null ? 0 : q.query(2, 'minHeight', input.extent),
              ),
              2 * o.minVerticalPadding,
            ),
          ),
        );
      return q.commands;
    };
    return {
      children: 4,
      forwardHitTest: true,
      layout: b.commands,
      minWidth: intrinsic('minWidth'),
      maxWidth: intrinsic('maxWidth'),
      minHeight: intrinsic('minHeight'),
      maxHeight: intrinsic('maxHeight'),
    };
  }
  private get leading(): RenderBox | null {
    return this.options.leading === null ? null : this.children[0]!;
  }
  private get title(): RenderBox {
    return this.children[1]!;
  }
  private get subtitle(): RenderBox | null {
    return this.options.subtitle === null ? null : this.children[2]!;
  }
  private get trailing(): RenderBox | null {
    return this.options.trailing === null ? null : this.children[3]!;
  }
  private get orderedChildren(): readonly RenderBox[] {
    return [this.leading, this.title, this.subtitle, this.trailing].filter(
      (r): r is RenderBox => r !== null,
    );
  }
  private get gap(): number {
    return this.options.horizontalTitleGap + this.options.visualDensity.horizontal * 2;
  }
  private get targetHeight(): number {
    const o = this.options;
    return (
      o.minTileHeight ??
      o.visualDensity.baseSizeAdjustment.dy +
        (o.isThreeLine
          ? o.isDense
            ? 76
            : 88
          : this.subtitle !== null
            ? o.isDense
              ? 64
              : 72
            : o.isDense
              ? 48
              : 56)
    );
  }
  private width(height: number, max: boolean): number {
    const get = (r: RenderBox | null) =>
        r === null ? 0 : max ? r.getMaxIntrinsicWidth(height) : r.getMinIntrinsicWidth(height),
      leading = this.leading;
    return (
      (leading === null ? 0 : Math.max(get(leading), this.options.minLeadingWidth) + this.gap) +
      Math.max(get(this.title), get(this.subtitle)) +
      (this.trailing?.getMaxIntrinsicWidth(height) ?? 0)
    );
  }
  protected override computeMinIntrinsicWidth(height: number): number {
    return this.width(height, false);
  }
  protected override computeMaxIntrinsicWidth(height: number): number {
    return this.width(height, true);
  }
  protected override computeMinIntrinsicHeight(width: number): number {
    return Math.max(
      this.targetHeight,
      this.title.getMinIntrinsicHeight(width) +
        (this.subtitle?.getMinIntrinsicHeight(width) ?? 0) +
        2 * this.options.minVerticalPadding,
    );
  }
  protected override computeMaxIntrinsicHeight(width: number): number {
    return this.computeMinIntrinsicHeight(width);
  }
  protected override computeDistanceToActualBaseline(baseline: TextBaseline): number | null {
    const b = this.title.getDistanceToActualBaseline(baseline);
    return b === null ? null : b + this.title.layoutOffset.y;
  }
  private sizes(constraints: BoxConstraints, dry: boolean): TileSizes {
    const o = this.options,
      loose = constraints.loosen(),
      tileWidth = loose.maxWidth;
    invariant(
      Number.isFinite(tileWidth),
      'unbounded-list-tile',
      'ListTile requires a bounded width',
    );
    const icons = loose.enforce(
        new BoxConstraints(
          0,
          Infinity,
          0,
          (o.isDense ? 48 : 56) + o.visualDensity.baseSizeAdjustment.dy,
        ),
      ),
      layout = (r: RenderBox, c: BoxConstraints): Size => {
        if (dry) return r.getDryLayout(c);
        r.layout(c, { parentUsesSize: true });
        return r.size;
      },
      baseline = (r: RenderBox, c: BoxConstraints, b: TextBaseline): number | null =>
        dry ? r.getDryBaseline(c, b) : r.getDistanceToBaseline(b, { onlyReal: true });
    const leading = this.leading,
      trailing = this.trailing,
      leadingSize = leading === null ? null : layout(leading, icons),
      trailingSize = trailing === null ? null : layout(trailing, icons);
    invariant(
      tileWidth === 0 || (leadingSize?.width !== tileWidth && trailingSize?.width !== tileWidth),
      'overflowed-list-tile-icon',
      'Leading or trailing widget consumes the entire ListTile width',
    );
    const titleStart =
        leadingSize === null ? 0 : Math.max(o.minLeadingWidth, leadingSize.width) + this.gap,
      trailingWidth = trailingSize === null ? 0 : Math.max(trailingSize.width + this.gap, 32),
      textConstraints = loose.tighten(tileWidth - titleStart - trailingWidth),
      titleHeight = layout(this.title, textConstraints).height,
      ltr = o.textDirection === 'ltr',
      subtitle = this.subtitle,
      positions: (Offset | null)[] = [null, null, null, null];
    let titleY: number, tileHeight: number;
    if (subtitle === null) {
      tileHeight = Math.max(this.targetHeight, titleHeight + 2 * o.minVerticalPadding);
      titleY = (tileHeight - titleHeight) / 2;
    } else {
      const subtitleHeight = layout(subtitle, textConstraints).height,
        titleBaseline = baseline(this.title, textConstraints, o.titleBaselineType) ?? titleHeight;
      invariant(
        o.subtitleBaselineType !== null,
        'missing-subtitle-baseline',
        'ListTile subtitle requires a baseline type',
      );
      const subtitleBaseline =
          baseline(subtitle, textConstraints, o.subtitleBaselineType) ?? subtitleHeight,
        targetTitleY =
          (o.isThreeLine ? (o.isDense ? 22 : 28) : o.isDense ? 28 : 32) - titleBaseline,
        targetSubtitleY =
          (o.isThreeLine ? (o.isDense ? 42 : 48) : o.isDense ? 48 : 52) +
          o.visualDensity.vertical * 2 -
          subtitleBaseline,
        overlap = Math.max(targetTitleY + titleHeight - targetSubtitleY, 0) / 2,
        idealTitleY = targetTitleY - overlap,
        idealSubtitleY = targetSubtitleY + overlap,
        compact =
          idealTitleY < o.minVerticalPadding ||
          idealSubtitleY + subtitleHeight + o.minVerticalPadding > this.targetHeight;
      positions[2] = {
        x: ltr ? titleStart : trailingWidth,
        y: compact ? o.minVerticalPadding + titleHeight : idealSubtitleY,
      };
      tileHeight = compact
        ? 2 * o.minVerticalPadding + titleHeight + subtitleHeight
        : this.targetHeight;
      titleY = compact ? o.minVerticalPadding : idealTitleY;
    }
    positions[1] = { x: ltr ? titleStart : trailingWidth, y: titleY };
    if (leadingSize)
      positions[0] = {
        x: ltr ? 0 : tileWidth - leadingSize.width,
        y: listTileChildY(
          o.titleAlignment,
          leadingSize.height,
          tileHeight,
          o.isThreeLine,
          o.minVerticalPadding,
          true,
        ),
      };
    if (trailingSize)
      positions[3] = {
        x: ltr ? tileWidth - trailingSize.width : 0,
        y: listTileChildY(
          o.titleAlignment,
          trailingSize.height,
          tileHeight,
          o.isThreeLine,
          o.minVerticalPadding,
          false,
        ),
      };
    return {
      titleY,
      textConstraints,
      size: { width: tileWidth, height: tileHeight },
      positions,
    };
  }
  protected override computeDryLayout(c: BoxConstraints): Size {
    return c.constrain(this.sizes(c, true).size);
  }
  protected override computeDryBaseline(c: BoxConstraints, b: TextBaseline): number | null {
    const s = this.sizes(c, true),
      value = this.title.getDryBaseline(s.textConstraints, b);
    return value === null ? null : value + s.titleY;
  }
  protected override performLayout(c: BoxConstraints): Size {
    const s = this.sizes(c, false);
    for (let i = 0; i < 4; i++) {
      const child = this.children[i]!;
      const position = s.positions[i];
      if (position) child.layoutOffset = position;
      else {
        child.layout(BoxConstraints.tightFor(0, 0), { parentUsesSize: true });
        child.layoutOffset = { x: 0, y: 0 };
      }
    }
    return c.constrain(s.size);
  }
  protected override hitTestSelf(_position: Offset): boolean {
    return true;
  }
  override hitTest(
    position: Offset,
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
    for (const child of this.orderedChildren) {
      const matrix = inversePaintTransform(this.childTransform(child));
      if (matrix && child.hitTest(transform(matrix, position), result, multiply(matrix, toLocal)))
        break;
    }
    result.push({ target: this, transform: toLocal });
    return true;
  }
  override paint(context: PaintingContext): void {
    for (const child of this.orderedChildren) this.paintChild(context, child);
  }
}
export class ListTileRenderWidget extends MultiChildRenderObjectWidget {
  constructor(readonly options: ListTileRenderOptions) {
    super(
      [
        options.leading ?? SizedBox.shrink(),
        options.title,
        options.subtitle ?? SizedBox.shrink(),
        options.trailing ?? SizedBox.shrink(),
      ].map((child) => new ListTileSlot(child)),
    );
  }
  createRenderObject(): RenderObject {
    return new RenderListTile(this.options);
  }
  override updateRenderObject(_context: BuildContext, render: RenderObject): void {
    invariant(
      render instanceof RenderListTile,
      'invalid-list-tile-owner',
      'ListTile requires its owning four-slot RenderBox',
    );
    render.configure(this.options);
  }
}
// Each source slot owns one persistent proxy. Replacing a slot's Widget retires
// that slot's old render child before insertion, without transient fifth children
// in the fixed-capacity list renderer or moving sibling State/focus owners.
class ListTileSlot extends SingleChildRenderObjectWidget {
  createRenderObject(): RenderObject {
    return new RenderProxyBox();
  }
}
registerNativeBoxConfiguration(RenderListTile.prototype, (render, reject) => {
  if (Object.hasOwn(render, '_nativeLayoutProgram')) return reject('instance-list-tile-policy');
  return {
    kind: 'stack',
    layout: {},
    hitTest: 'self',
    layoutProgram: render._nativeLayoutProgram(),
  };
});
