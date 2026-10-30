// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// The sole Material render/feature/ticker identity, independent of Theme/default factories.
import { RenderProxyBox } from '@nelyx/core/framework/rendering/boxes';
import { RenderObject, RenderBox } from '@nelyx/core/framework/rendering/object';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import { Matrix4 } from '@nelyx/core/math/matrix4';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Color } from '@nelyx/core/ui/color';
import type { TickerProvider } from '@nelyx/core/framework/animation/ticker';
import { invariant } from '@nelyx/core/foundation/errors';
/** Material.defaultSplashRadius from the pinned material.dart. @dartType double */
export const materialDefaultSplashRadius = 35;
export abstract class MaterialInkController {
  abstract readonly vsync: TickerProvider;
  abstract readonly color: Color | null;
  abstract addInkFeature(feature: InkFeature): void;
  abstract markNeedsPaint(): void;
}
export class MaterialInkRender extends RenderProxyBox implements MaterialInkController {
  readonly features: InkFeature[] = [];
  private retired = false;
  private painting = false;
  constructor(
    readonly vsync: TickerProvider,
    public color: Color | null,
    public absorbHitTest: boolean,
  ) {
    super();
  }
  protected override markNeedsPaintAfterLayout(): void {
    if (
      this.hasDefaultPaintSemantics(
        MaterialInkRender.prototype,
        MaterialInkRender.prototype.markNeedsPaint,
      )
    )
      this.markNeedsPaintAfterGeometryLayout();
    else super.markNeedsPaintAfterLayout();
  }
  override markNeedsPaint(): void {
    // Ink changes pixels inside the same clip. Layout and explicit semantic
    // changes invalidate their own geometry/configuration; custom renderers
    // and instance hooks keep the conservative paint/semantics contract.
    if (
      !this.debugDoingThisLayout &&
      this.hasDefaultPaintSemantics(
        MaterialInkRender.prototype,
        MaterialInkRender.prototype.markNeedsPaint,
      )
    )
      this.markNeedsPaintOnly();
    else super.markNeedsPaint();
  }
  assertMutable(): void {
    invariant(
      !this.retired && !this.debugDisposed && !this.painting,
      'inactive-material-ink',
      'Material ink controller is retired or painting',
    );
  }
  addInkFeature(feature: InkFeature): void {
    this.assertMutable();
    invariant(
      feature.controller === this && !feature.debugDisposed && !this.features.includes(feature),
      'invalid-ink-feature',
      'InkFeature must be live, unique and owned by this Material',
    );
    this.features.push(feature);
    this.markNeedsPaint();
  }
  removeFeature(feature: InkFeature): void {
    invariant(!this.painting, 'ink-mutation-during-paint', 'Ink cannot be removed during painting');
    const index = this.features.indexOf(feature);
    if (index >= 0) this.features.splice(index, 1);
    if (!this.retired && !this.debugDisposed) this.markNeedsPaint();
  }
  didChangeLayout(): void {
    if (this.features.length && !this.retired) this.markNeedsPaint();
  }
  get debugInkFeatures(): readonly InkFeature[] {
    return Object.freeze([...this.features]);
  }
  protected override hitTestSelf(): boolean {
    return !this.retired && this.absorbHitTest;
  }
  override paint(context: PaintingContext): void {
    if (this.features.length) {
      const canvas = context.canvas;
      canvas.save();
      const previousPainting = this.painting;
      this.painting = true;
      try {
        canvas.clipRect({
          x: 0,
          y: 0,
          ...this.size,
        });
        for (const feature of this.features) feature.paintOnMaterial(canvas);
      } finally {
        this.painting = previousPainting;
        canvas.restore();
      }
    }
    super.paint(context);
  }
  retire(): void {
    if (this.retired) return;
    this.retired = true;
    const errors: unknown[] = [];
    const snapshot = [...this.features];
    for (const feature of snapshot)
      try {
        feature.dispose();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Material ink retirement failed');
  }
  override dispose(): void {
    try {
      this.retire();
    } finally {
      super.dispose();
    }
  }
}
export interface InkFeatureOptions {
  readonly controller: MaterialInkController;
  readonly referenceBox: RenderBox;
  readonly onRemoved?: (() => void) | null;
}
export abstract class InkFeature {
  readonly referenceBox: RenderBox;
  readonly onRemoved: (() => void) | null;
  private readonly inkController: MaterialInkRender;
  private dead = false;
  constructor({ controller, referenceBox, onRemoved = null }: InkFeatureOptions) {
    invariant(
      controller instanceof MaterialInkRender && referenceBox instanceof RenderBox,
      'invalid-ink-owner',
      'InkFeature requires the actual Material controller and Core RenderBox',
    );
    controller.assertMutable();
    this.inkController = controller;
    this.referenceBox = referenceBox;
    this.onRemoved = onRemoved;
  }
  get controller(): MaterialInkController {
    return this.inkController;
  }
  get debugDisposed(): boolean {
    return this.dead;
  }
  dispose(): void {
    if (this.dead) return;
    this.inkController.removeFeature(this);
    this.dead = true;
    this.onRemoved?.();
  }
  private static paintTransform(from: RenderObject, to: RenderObject): Matrix4 | null {
    const fromPath = [from],
      toPath = [to];
    while (from !== to) {
      const fromDepth = from.depth,
        toDepth = to.depth;
      if (fromDepth >= toDepth) {
        const parent = from.parent;
        if (!parent || !parent.paintsChild(from)) return null;
        fromPath.push(parent);
        from = parent;
      }
      if (fromDepth <= toDepth) {
        const parent = to.parent;
        if (!parent || !parent.paintsChild(to)) return null;
        toPath.push(parent);
        to = parent;
      }
    }
    const transform = Matrix4.identity(),
      inverse = Matrix4.identity();
    for (let i = toPath.length - 1; i > 0; i--)
      toPath[i]!.applyPaintTransform(toPath[i - 1]!, transform);
    for (let i = fromPath.length - 1; i > 0; i--)
      fromPath[i]!.applyPaintTransform(fromPath[i - 1]!, inverse);
    return inverse.invert() !== 0 ? (inverse.multiply(transform), inverse) : null;
  }
  /** Called only by the owning renderer, after its size/clip is established. */
  paintOnMaterial(canvas: Canvas): void {
    if (this.dead || !this.referenceBox.attached) return;
    const transform = InkFeature.paintTransform(this.inkController, this.referenceBox);
    if (transform) this.paintFeature(canvas, transform);
  }
  protected abstract paintFeature(canvas: Canvas, transform: Matrix4): void;
  toString(): string {
    return this.constructor.name;
  }
}
