// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../../foundation/errors.ts';
import { LayerHandle, OpacityLayer } from './layer.ts';
import type { SemanticsNode, Rect } from '../../ui/types.ts';
import type { TransformMatrix } from '../../ui/geometry.ts';
import type { RenderBox, RenderObject } from './object.ts';
import { RenderProxyBox } from './boxes.ts';
import type { PaintingContext } from '../painting/context.ts';
export class RenderOpacity extends RenderProxyBox {
  private readonly retained = new LayerHandle<OpacityLayer>();
  private value = 1;
  private include = false;
  constructor(
    options: {
      readonly opacity?: number;
      readonly alwaysIncludeSemantics?: boolean;
      readonly child?: RenderBox<RenderObject>;
    } = {},
  ) {
    super();
    this.opacity = options.opacity ?? 1;
    this.alwaysIncludeSemantics = options.alwaysIncludeSemantics ?? false;
    if (options.child) this.child = options.child;
  }
  get opacity(): number {
    return this.value;
  }
  set opacity(value: number) {
    this.assertCanMutateLayoutProperty();
    invariant(
      typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1,
      'invalid-opacity',
      'Opacity must be between zero and one',
    );
    if (value === this.value) return;
    this.value = value;
    this.markNeedsPaint();
  }
  get alpha(): number {
    return Math.round(this.value * 255);
  }
  override paintsChild(child: RenderObject): boolean {
    invariant(
      child.parent === this,
      'invalid-opacity-child',
      'Opacity paint child must belong to this render object',
    );
    return this.alpha > 0;
  }
  get alwaysIncludeSemantics(): boolean {
    return this.include;
  }
  set alwaysIncludeSemantics(value: boolean) {
    this.assertCanMutateLayoutProperty();
    invariant(
      typeof value === 'boolean',
      'invalid-opacity',
      'alwaysIncludeSemantics must be boolean',
    );
    if (value === this.include) return;
    this.include = value;
    this.markNeedsPaint();
  }
  override paint(context: PaintingContext): void {
    if (this.alpha === 0) {
      this.retained.dispose();
      return;
    }
    if (this.alpha === 255) {
      this.retained.dispose();
      super.paint(context);
      return;
    }
    this.retained.layer = context.pushOpacity(
      { x: 0, y: 0 },
      this.alpha,
      (childContext) => super.paint(childContext),
      this.retained.layer,
    );
  }
  override detach(): void {
    try {
      super.detach();
    } finally {
      if (!this.attached) this.retained.dispose();
    }
  }
  override dispose(): void {
    try {
      super.dispose();
    } finally {
      if (this.debugDisposed) this.retained.dispose();
    }
  }
  override visitChildrenForSemantics(visitor: (child: RenderObject) => void): void {
    if (this.alpha !== 0 || this.include) super.visitChildrenForSemantics(visitor);
  }
  override collectSemantics(output: SemanticsNode[], matrix?: TransformMatrix, clip?: Rect): void {
    if (this.alpha !== 0 || this.include) super.collectSemantics(output, matrix, clip);
  }
}
RenderProxyBox._registerGeometryLayoutSemantics(RenderOpacity.prototype);
