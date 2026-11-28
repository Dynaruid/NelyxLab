// SPDX-License-Identifier: BSD-3-Clause
import type { PlatformViewHitRegion, PlatformViewScenePart } from '../../hosting/platform-views.ts';
import { bounds, intersect, multiply, translate } from '../../ui/geometry.ts';
import type { Offset } from '../../ui/geometry.ts';
import type { Rect } from '../../ui/types.ts';
import { RenderBox, RenderObject } from './object.ts';
import type { HitTestEntry } from './object.ts';
import { HitTestBehavior, RenderPointerListener } from './pointer-listener.ts';
import { RenderAbsorbPointer } from './pointer-blocking.ts';
import { RenderPlatformView } from '../widgets/platform-view.ts';

function interceptsPointer(target: RenderObject): boolean {
  return (
    target.onPointer !== undefined ||
    (target instanceof RenderPointerListener &&
      (target.behavior === HitTestBehavior.opaque || !!target.onPointerDown)) ||
    (target instanceof RenderAbsorbPointer && target.absorbing)
  );
}

function transformRect(target: RenderObject, rect: Rect): Rect {
  return bounds(multiply(target.getTransformTo(null), translate(rect.x, rect.y)), rect);
}

/** Cut the visible native slots at rectangular hit boundaries and use the
 * actual render hit path to select the owner of each cell. A painted rectangle
 * with no pointer target does not claim the underlying control's input. */
export function platformViewInput(
  root: RenderObject,
  parts: readonly PlatformViewScenePart[],
  viewport: Rect,
  hitTest: (point: Offset) => readonly HitTestEntry[],
): readonly PlatformViewHitRegion[] {
  const views = parts.flatMap((part, index) =>
    'view' in part && part.view.visible ? [{ ...part.view, index }] : [],
  );
  if (!views.length) return [];
  const candidates: Rect[] = views.map(({ clip }) => clip);
  const visit = (target: RenderObject, clip: Rect): void => {
    if (target instanceof RenderBox && target.hasSize && interceptsPointer(target)) {
      const rect = intersect(clip, transformRect(target, target.paintBounds));
      if (rect.width && rect.height) candidates.push(rect);
    }
    target.visitChildren((child) => {
      if (!target.paintsChild(child)) return;
      const localClip = target.describeApproximatePaintClip(child);
      const next = localClip ? intersect(clip, transformRect(target, localClip)) : clip;
      if (next.width && next.height) visit(child, next);
    });
  };
  visit(root, viewport);

  const input: PlatformViewHitRegion[] = [];
  for (const { instanceId, clip, index } of views) {
    const barriers = parts
      .slice(index + 1)
      .flatMap((part) => ('barrier' in part ? [part.barrier] : []));
    const overlapping = [...candidates, ...barriers]
      .map((rect) => intersect(clip, rect))
      .filter((rect) => rect.width > 0 && rect.height > 0);
    const ys = [...new Set(overlapping.flatMap(({ y, height }) => [y, y + height]))].sort(
      (a, b) => a - b,
    );
    let previous = new Map<string, Rect>();
    for (let row = 0; row + 1 < ys.length; row++) {
      const y = ys[row]!,
        bottom = ys[row + 1]!;
      const xs = [
        ...new Set(
          overlapping
            .filter((rect) => rect.y <= y && rect.y + rect.height >= bottom)
            .flatMap(({ x, width }) => [x, x + width]),
        ),
      ].sort((a, b) => a - b);
      const next = new Map<string, Rect>();
      let span: number | undefined;
      for (let column = 0; column < xs.length; column++) {
        const x = xs[column]!,
          right = xs[column + 1];
        let intercepted = false;
        if (right !== undefined) {
          const point = { x: (x + right) / 2, y: (y + bottom) / 2 };
          intercepted = barriers.some(
            (rect) =>
              point.x >= rect.x &&
              point.x < rect.x + rect.width &&
              point.y >= rect.y &&
              point.y < rect.y + rect.height,
          );
          for (const { target } of intercepted ? [] : hitTest(point)) {
            if (target instanceof RenderPlatformView && target.platformViewId !== undefined) break;
            if (target instanceof RenderObject && interceptsPointer(target)) {
              intercepted = true;
              break;
            }
          }
        }
        if (intercepted) span ??= x;
        else if (span !== undefined) {
          const width = x - span;
          const key = span + ',' + width;
          const old = previous.get(key);
          const rect = { x: span, y: old?.y ?? y, width, height: bottom - (old?.y ?? y) };
          if (old) previous.delete(key);
          next.set(key, rect);
          span = undefined;
        }
      }
      for (const rect of previous.values()) input.push({ instanceId, rect });
      previous = next;
    }
    for (const rect of previous.values()) input.push({ instanceId, rect });
  }
  return input;
}
