// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/widgets/drag_boundary.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '../../foundation/errors.ts';
import { Rect } from '../../ui/rect.ts';
import { Offset } from '../../ui/offset.ts';
import { RenderBox } from '../rendering/object.ts';
import { InheritedWidget } from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';

export interface DragBoundaryDelegate<T> {
  isWithinBoundary(draggedObject: T): boolean;
  nearestPositionWithinBoundary(draggedObject: T): T;
}

class RectDragBoundary implements DragBoundaryDelegate<Rect> {
  constructor(private readonly boundary: Rect | null) {}

  isWithinBoundary(rect: Rect): boolean {
    const boundary = this.boundary;
    return (
      boundary === null ||
      (rect.left >= boundary.left &&
        rect.top >= boundary.top &&
        rect.right <= boundary.right &&
        rect.bottom <= boundary.bottom)
    );
  }

  nearestPositionWithinBoundary(rect: Rect): Rect {
    const boundary = this.boundary;
    if (boundary === null) return rect;
    invariant(
      rect.width <= boundary.width && rect.height <= boundary.height,
      'drag-object-outside-boundary',
      'The drag boundary must contain the dragged rectangle',
    );
    const left = Math.max(boundary.left, Math.min(rect.left, boundary.right - rect.width));
    const top = Math.max(boundary.top, Math.min(rect.top, boundary.bottom - rect.height));
    return Rect.fromLTWH(left, top, rect.width, rect.height);
  }
}

export class DragBoundary extends InheritedWidget {
  constructor({ child, key = null }: WidgetOptions & { readonly child: Widget }) {
    super(child, key);
  }

  static forRectMaybeOf(
    context: BuildContext,
    { useGlobalPosition = true }: { readonly useGlobalPosition?: boolean } = {},
  ): DragBoundaryDelegate<Rect> | null {
    const owner = context.getElementForInheritedWidgetOfExactType(DragBoundary);
    if (owner === undefined) return null;
    const render = owner.findRenderObject();
    invariant(
      render instanceof RenderBox && render.attached && render.hasSize,
      'missing-drag-boundary-size',
      'DragBoundary requires its laid out render box',
    );
    const size = render.size;
    return new RectDragBoundary(
      useGlobalPosition
        ? Rect.fromPoints(
            render.localToGlobal(Offset.zero),
            render.localToGlobal(new Offset(size.width, size.height)),
          )
        : Rect.fromLTWH(0, 0, size.width, size.height),
    );
  }

  static forRectOf(
    context: BuildContext,
    options: { readonly useGlobalPosition?: boolean } = {},
  ): DragBoundaryDelegate<Rect> {
    return this.forRectMaybeOf(context, options) ?? new RectDragBoundary(null);
  }

  updateShouldNotify(_old: this): boolean {
    return true;
  }
}
