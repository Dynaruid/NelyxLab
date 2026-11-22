// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Offset } from '../../ui/offset.ts';
import { Rect } from '../../ui/rect.ts';
import { clampDouble } from '../../ui/math.ts';
import { protect } from '../../ui/value-math.ts';
import { RenderBox } from '../rendering/object.ts';
import type { RenderObject } from '../rendering/object.ts';
import type { TextSelectionPoint } from '../rendering/editable.ts';
import { Matrix4 } from '../../math/matrix4.ts';
import { MatrixUtils } from '../painting/matrix-utils.ts';
import { fullTransform } from '../../ui/geometry.ts';
import type { BuildContext } from './framework.ts';
import { Overlay } from './overlay.ts';

export function projectSelectionRect(box: RenderBox, rect: Rect): Rect {
  return MatrixUtils.transformRect(Matrix4.fromList(fullTransform(box.getTransformTo(null))), rect);
}

/** The part of a selection surface that is inside the View and its ancestor clips. */
export function visibleSelectionBounds(box: RenderBox, viewport: Rect): Rect {
  if (!box.attached || !box.hasSize || box.needsLayout || !box.isDisplayed) return Rect.zero;
  let result = projectSelectionRect(
    box,
    Rect.fromLTWH(0, 0, box.size.width, box.size.height),
  ).intersect(viewport);
  for (
    let child: RenderObject = box, parent = child.parent;
    parent && result.isFinite && !result.isEmpty;
    child = parent, parent = parent.parent
  ) {
    const clip = parent.describeApproximatePaintClip(child);
    if (clip) {
      result = result.intersect(
        MatrixUtils.transformRect(
          Matrix4.fromList(fullTransform(parent.getTransformTo(null))),
          Rect.fromLTWH(clip.x, clip.y, clip.width, clip.height),
        ),
      );
    }
  }
  return result.isFinite ? result : Rect.zero;
}

export class TextSelectionToolbarAnchors {
  readonly primaryAnchor: Offset;
  readonly secondaryAnchor: Offset | null;
  constructor({
    primaryAnchor,
    secondaryAnchor = null,
  }: {
    readonly primaryAnchor: Offset;
    readonly secondaryAnchor?: Offset | null;
  }) {
    this.primaryAnchor = primaryAnchor;
    this.secondaryAnchor = secondaryAnchor;
    protect(this, ['primaryAnchor', 'secondaryAnchor']);
  }
  private static readonly zeroAnchor = new TextSelectionToolbarAnchors({
    primaryAnchor: Offset.zero,
  });
  equals(other: TextSelectionToolbarAnchors): boolean {
    return (
      this.primaryAnchor.equals(other.primaryAnchor) &&
      (this.secondaryAnchor?.equals(other.secondaryAnchor) ?? other.secondaryAnchor === null)
    );
  }
  inOverlay(context: BuildContext): TextSelectionToolbarAnchors {
    const root = Overlay.maybeOf(context, { rootOverlay: true })?.context.findRenderObject();
    if (!(root instanceof RenderBox) || !root.hasSize || root.needsLayout) return this;
    const convert = (point: Offset) => {
      const local = root.globalToLocal(point);
      return new Offset(local.x, local.y);
    };
    return new TextSelectionToolbarAnchors({
      primaryAnchor: convert(this.primaryAnchor),
      secondaryAnchor: this.secondaryAnchor && convert(this.secondaryAnchor),
    });
  }
  static fromSelection({
    renderBox,
    startGlyphHeight,
    endGlyphHeight,
    selectionEndpoints,
    visibleBounds,
  }: {
    readonly renderBox: RenderBox;
    readonly startGlyphHeight: number;
    readonly endGlyphHeight: number;
    readonly selectionEndpoints: readonly TextSelectionPoint[];
    readonly visibleBounds?: Rect;
  }): TextSelectionToolbarAnchors {
    const rect = TextSelectionToolbarAnchors.getSelectionRect(
      renderBox,
      startGlyphHeight,
      endGlyphHeight,
      selectionEndpoints,
    );
    if (rect.equals(Rect.zero)) return TextSelectionToolbarAnchors.zeroAnchor;
    const editing = visibleBounds ?? TextSelectionToolbarAnchors.editingRegion(renderBox);
    if (editing.isEmpty) return TextSelectionToolbarAnchors.zeroAnchor;
    const x = clampDouble(rect.center.dx, editing.left, editing.right);
    return new TextSelectionToolbarAnchors({
      primaryAnchor: new Offset(x, clampDouble(rect.top, editing.top, editing.bottom)),
      secondaryAnchor: new Offset(x, clampDouble(rect.bottom, editing.top, editing.bottom)),
    });
  }
  private static editingRegion(box: RenderBox): Rect {
    return projectSelectionRect(box, Rect.fromLTWH(0, 0, box.size.width, box.size.height));
  }
  static getSelectionRect(
    renderBox: RenderBox,
    startGlyphHeight: number,
    endGlyphHeight: number,
    selectionEndpoints: readonly TextSelectionPoint[],
  ): Rect {
    const editing = TextSelectionToolbarAnchors.editingRegion(renderBox);
    const first = selectionEndpoints[0],
      last = selectionEndpoints.at(-1);
    if (!editing.isFinite || !first || !last) return Rect.zero;
    const multiline = last.point.dy - first.point.dy > endGlyphHeight / 2;
    return projectSelectionRect(
      renderBox,
      Rect.fromLTRB(
        multiline ? 0 : Math.min(first.point.dx, last.point.dx),
        first.point.dy - startGlyphHeight,
        multiline ? renderBox.size.width : Math.max(first.point.dx, last.point.dx),
        last.point.dy,
      ),
    );
  }
}
