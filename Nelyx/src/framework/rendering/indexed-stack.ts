// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter rendering/stack.dart at the recorded pin.
import { invariant } from '../../foundation/errors.ts';
import {
  identity,
  contains,
  inversePaintTransform,
  transform,
  multiply,
  bounds,
  intersect,
} from '../../ui/geometry.ts';
import type { Offset, TransformMatrix } from '../../ui/geometry.ts';
import type { SemanticsNode, Rect } from '../../ui/types.ts';
import { Offset as OffsetValue } from '../../ui/offset.ts';
import type { PaintingContext } from '../painting/context.ts';
import { BoxConstraints } from './constraints.ts';
import { RenderStack, StackParentData } from './boxes.ts';
import type { RenderStackOptions } from './boxes.ts';
import { RenderBox } from './object.ts';
import type { RenderObject, TextBaseline, HitTestEntry } from './object.ts';
export interface RenderIndexedStackOptions extends RenderStackOptions {
  readonly index?: number | null;
}
export class RenderIndexedStack extends RenderStack {
  private _index: number | null;
  constructor(options: RenderIndexedStackOptions = {}) {
    const { children, ...stackOptions } = options,
      index = options.index === undefined ? 0 : options.index;
    invariant(
      index === null || Number.isSafeInteger(index),
      'invalid-indexed-stack-index',
      'Index must be an integer or null',
    );
    super(stackOptions);
    this._index = index;
    if (children) this.setChildren(children);
  }
  get index(): number | null {
    return this._index;
  }
  set index(value: number | null) {
    this.assertCanMutateLayoutProperty();
    invariant(
      value === null || Number.isSafeInteger(value),
      'invalid-indexed-stack-index',
      'Index must be an integer or null',
    );
    if (value === this._index) return;
    this._index = value;
    this.markNeedsLayout();
  }
  private _childAtIndex(): RenderBox<RenderObject> | undefined {
    if (this.index === null) return undefined;
    const child = this.children[Math.max(0, this.index)];
    invariant(
      !this.children.length || child,
      'invalid-indexed-stack-index',
      'Index must select an existing child',
    );
    return child;
  }
  visitChildrenForSemantics(visitor: (child: RenderObject) => void): void {
    const child = this._childAtIndex();
    if (child) visitor(child);
  }
  protected override computeDistanceToActualBaseline(baseline: TextBaseline): number | null {
    const child = this._childAtIndex(),
      value = child?.getDistanceToActualBaseline(baseline);
    return value == null ? null : value + child!.layoutOffset.y;
  }
  protected override computeDryBaseline(
    constraints: BoxConstraints,
    baseline: TextBaseline,
  ): number | null {
    const child = this._childAtIndex();
    if (!child) return null;
    const inner =
        this.fit === 'loose'
          ? constraints.loosen()
          : this.fit === 'expand'
            ? BoxConstraints.tight(constraints.biggest)
            : constraints,
      alignment = this.alignment.resolve(this.textDirection),
      size = this.getDryLayout(constraints),
      data = child.parentData as StackParentData,
      childConstraints = data.isPositioned ? data.positionedChildConstraints(size) : inner,
      value = child.getDryBaseline(childConstraints, baseline);
    if (value === null) return null;
    const y =
      data.top ??
      (data.bottom !== undefined
        ? size.height - data.bottom - child.getDryLayout(childConstraints).height
        : alignment.alongOffset(
            new OffsetValue(
              size.width - child.getDryLayout(childConstraints).width,
              size.height - child.getDryLayout(childConstraints).height,
            ),
          ).dy);
    return value + y;
  }
  hitTestChildren(
    position: Offset,
    result: HitTestEntry[],
    toLocal: TransformMatrix = identity,
  ): boolean {
    const child = this._childAtIndex();
    if (!child) return false;
    const inverse = inversePaintTransform(this.childTransform(child));
    return (
      !!inverse && child.hitTest(transform(inverse, position), result, multiply(inverse, toLocal))
    );
  }
  override hitTest(
    position: Offset,
    result: HitTestEntry[],
    toLocal: TransformMatrix = identity,
  ): boolean {
    invariant(this.hasSize, 'missing-hit-test-size', 'Hit testing requires a laid-out size');
    if (!contains({ x: 0, y: 0, ...this.size }, position)) return false;
    let hit = this.hitTestChildren(position, result, toLocal);
    if (this.onPointer || this.semantics) {
      result.push({ target: this, transform: toLocal });
      hit = true;
    }
    return hit;
  }
  protected override paintStack(context: PaintingContext): void {
    const child = this._childAtIndex();
    if (child) this.paintChild(context, child);
  }
  override collectSemantics(
    output: SemanticsNode[],
    matrix: TransformMatrix = identity,
    clip?: Rect,
  ): void {
    const ownBounds = bounds(matrix, this.size);
    if (![ownBounds.x, ownBounds.y, ownBounds.width, ownBounds.height].every(Number.isFinite))
      return;
    const nextClip = this.clips ? (clip ? intersect(clip, ownBounds) : ownBounds) : clip,
      descendants: SemanticsNode[] = [];
    this.visitChildrenForSemantics((child) =>
      child.collectSemantics(descendants, multiply(matrix, this.childTransform(child)), nextClip),
    );
    if (this.semantics) {
      const visible = clip ? intersect(clip, ownBounds) : ownBounds;
      if (visible.width > 0 && visible.height > 0)
        output.push({
          ...this.semantics,
          bounds: visible,
          ...(descendants.length &&
          this.semantics.role !== 'button' &&
          this.semantics.role !== 'text-field'
            ? { children: descendants }
            : {}),
        });
    } else output.push(...descendants);
  }
}
