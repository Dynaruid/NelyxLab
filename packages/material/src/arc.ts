// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/arc.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { RectTween, Tween } from '@nelyx/core/framework/animation/tween';
import { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import { lerpDouble } from '@nelyx/core/internal/ui/lerp-double.generated';

const onAxisDelta = 2;

interface Arc {
  readonly center: Offset;
  readonly radius: number;
  readonly beginAngle: number;
  readonly endAngle: number;
}

function pointArc(begin: Offset, end: Offset): Arc | null {
  const delta = end.subtract(begin);
  const dx = Math.abs(delta.dx);
  const dy = Math.abs(delta.dy);
  if (dx <= onAxisDelta || dy <= onAxisDelta) return null;
  const radius = delta.distanceSquared / (2 * Math.min(dx, dy));
  const sweep = 2 * Math.asin(delta.distance / (2 * radius));
  if (dx < dy) {
    const endAngle = delta.dx > 0 ? 0 : Math.PI;
    return {
      radius,
      center: end.translate(-Math.sign(delta.dx) * radius, 0),
      beginAngle: endAngle - sweep * Math.sign(delta.dx * delta.dy),
      endAngle,
    };
  }
  const beginAngle = (-Math.sign(delta.dy) * Math.PI) / 2;
  return {
    radius,
    center: begin.translate(0, Math.sign(delta.dy) * radius),
    beginAngle,
    endAngle: beginAngle + sweep * Math.sign(delta.dx * delta.dy),
  };
}

export class MaterialPointArcTween extends Tween<Offset> {
  private previousBegin: Offset | null = null;
  private previousEnd: Offset | null = null;
  private geometry: Arc | null = null;

  private get arc(): Arc | null {
    const { begin, end } = this;
    if (begin !== this.previousBegin || end !== this.previousEnd) {
      this.geometry = begin && end ? pointArc(begin, end) : null;
      this.previousBegin = begin;
      this.previousEnd = end;
    }
    return this.geometry;
  }
  get center(): Offset | null {
    return this.arc?.center ?? null;
  }
  get radius(): number | null {
    return this.arc?.radius ?? null;
  }
  get beginAngle(): number | null {
    return this.arc?.beginAngle ?? null;
  }
  get endAngle(): number | null {
    return this.arc?.endAngle ?? null;
  }
  override lerp(t: number): Offset {
    const { begin, end, arc } = this;
    invariant(begin && end, 'null-arc-tween-endpoint', 'An arc requires two endpoints');
    if (t === 0) return begin;
    if (t === 1) return end;
    if (!arc) return Offset.lerp(begin, end, t)!;
    return arc.center.add(
      Offset.fromDirection(lerpDouble(arc.beginAngle, arc.endAngle, t)!, arc.radius),
    );
  }
  override toString(): string {
    return `MaterialPointArcTween(${this.begin} → ${this.end}; center=${this.center}, radius=${this.radius}, beginAngle=${this.beginAngle}, endAngle=${this.endAngle})`;
  }
}

type Corner = 'topLeft' | 'bottomRight' | 'topRight' | 'bottomLeft';
const diagonals: ReadonlyArray<readonly [Corner, Corner]> = [
  ['topLeft', 'bottomRight'],
  ['bottomRight', 'topLeft'],
  ['topRight', 'bottomLeft'],
  ['bottomLeft', 'topRight'],
];

export class MaterialRectArcTween extends RectTween {
  private previousBegin: Rect | null = null;
  private previousEnd: Rect | null = null;
  private arcs: readonly [MaterialPointArcTween, MaterialPointArcTween] | null = null;

  private get cornerArcs(): readonly [MaterialPointArcTween, MaterialPointArcTween] | null {
    const { begin, end } = this;
    if (begin === this.previousBegin && end === this.previousEnd) return this.arcs;
    this.previousBegin = begin;
    this.previousEnd = end;
    if (!begin || !end) {
      this.arcs = null;
      return null;
    }
    const direction = end.center.subtract(begin.center);
    let best = diagonals[0]!;
    let bestSupport: number | undefined;
    for (const diagonal of diagonals) {
      const delta = begin[diagonal[1]].subtract(begin[diagonal[0]]);
      const support = (direction.dx * delta.dx + direction.dy * delta.dy) / delta.distance;
      if (bestSupport === undefined || support > bestSupport) {
        best = diagonal;
        bestSupport = support;
      }
    }
    this.arcs = [
      new MaterialPointArcTween({ begin: begin[best[0]], end: end[best[0]] }),
      new MaterialPointArcTween({ begin: begin[best[1]], end: end[best[1]] }),
    ];
    return this.arcs;
  }
  get beginArc(): MaterialPointArcTween | null {
    return this.cornerArcs?.[0] ?? null;
  }
  get endArc(): MaterialPointArcTween | null {
    return this.cornerArcs?.[1] ?? null;
  }
  override lerp(t: number): Rect {
    const { begin, end, cornerArcs } = this;
    invariant(
      begin && end && cornerArcs,
      'null-arc-tween-endpoint',
      'An arc requires two endpoints',
    );
    if (t === 0) return begin;
    if (t === 1) return end;
    return Rect.fromPoints(cornerArcs[0].lerp(t), cornerArcs[1].lerp(t));
  }
  override toString(): string {
    return `MaterialRectArcTween(${this.begin} → ${this.end}; beginArc=${this.beginArc}, endArc=${this.endArc})`;
  }
}

export class MaterialRectCenterArcTween extends RectTween {
  private previousBegin: Rect | null = null;
  private previousEnd: Rect | null = null;
  private arc: MaterialPointArcTween | null = null;

  get centerArc(): MaterialPointArcTween | null {
    const { begin, end } = this;
    if (begin !== this.previousBegin || end !== this.previousEnd) {
      this.previousBegin = begin;
      this.previousEnd = end;
      this.arc =
        begin && end ? new MaterialPointArcTween({ begin: begin.center, end: end.center }) : null;
    }
    return this.arc;
  }
  override lerp(t: number): Rect {
    const { begin, end, centerArc } = this;
    invariant(
      begin && end && centerArc,
      'null-arc-tween-endpoint',
      'An arc requires two endpoints',
    );
    if (t === 0) return begin;
    if (t === 1) return end;
    const center = centerArc.lerp(t);
    const width = lerpDouble(begin.width, end.width, t)!;
    const height = lerpDouble(begin.height, end.height, t)!;
    return Rect.fromLTWH(center.dx - width / 2, center.dy - height / 2, width, height);
  }
  override toString(): string {
    return `MaterialRectCenterArcTween(${this.begin} → ${this.end}; centerArc=${this.centerArc})`;
  }
}
