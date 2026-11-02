// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from pinned rendering/proxy_box.dart RenderAnnotatedRegion.
import { invariant } from '../../foundation/errors.ts';
import { RenderProxyBox } from './boxes.ts';
import { LayerHandle, AnnotatedRegionLayer, AnnotationType } from './layer.ts';
import { RenderBox } from './object.ts';
import type { RenderObject } from './object.ts';
import type { Size, Offset } from '../../ui/geometry.ts';
import type { PaintingContext } from '../painting/context.ts';
const defaultSizeGetter = Object.getOwnPropertyDescriptor(RenderBox.prototype, 'size')!.get;
export class RenderAnnotatedRegion<T extends {}> extends RenderProxyBox {
  private annotation: T;
  private bounded: boolean;
  private readonly retained = new LayerHandle<AnnotatedRegionLayer<T>>();
  private annotationSnapshot:
    | {
        layer: AnnotatedRegionLayer<T>;
        value: T;
        size: Size | null;
        offset: Offset;
      }
    | undefined;
  readonly annotationType: AnnotationType<T>;
  constructor(options: {
    readonly value: T;
    readonly annotationType: AnnotationType<T>;
    readonly sized?: boolean;
    readonly child?: RenderBox<RenderObject>;
  }) {
    super();
    invariant(
      options.value !== null && options.value !== undefined,
      'invalid-annotation',
      'Annotation value cannot be null',
    );
    invariant(
      options.annotationType instanceof AnnotationType,
      'invalid-annotation-type',
      'Expected AnnotationType',
    );
    invariant(
      options.sized === undefined || typeof options.sized === 'boolean',
      'invalid-annotation-size',
      'Expected boolean sized',
    );
    this.annotation = options.value;
    this.annotationType = options.annotationType;
    this.bounded = options.sized ?? true;
    if (options.child) this.child = options.child;
  }
  get value(): T {
    return this.annotation;
  }
  set value(value: T) {
    this.assertCanMutateLayoutProperty();
    invariant(
      value !== null && value !== undefined,
      'invalid-annotation',
      'Annotation value cannot be null',
    );
    if (value !== this.annotation) {
      this.annotation = value;
      this.markNeedsPaint();
    }
  }
  get sized(): boolean {
    return this.bounded;
  }
  set sized(value: boolean) {
    this.assertCanMutateLayoutProperty();
    invariant(typeof value === 'boolean', 'invalid-annotation-size', 'Expected boolean sized');
    if (value !== this.bounded) {
      this.bounded = value;
      this.markNeedsPaint();
    }
  }
  get layer(): AnnotatedRegionLayer<T> | null {
    return this.retained.layer;
  }
  get alwaysNeedsCompositing(): boolean {
    return true;
  }
  override paint(context: PaintingContext): void {
    const size = this.bounded ? this.size : null,
      previous = this.annotationSnapshot,
      stable =
        previous &&
        this.retained.layer === previous.layer &&
        !previous.layer.debugDisposed &&
        Object.getPrototypeOf(this) === RenderAnnotatedRegion.prototype &&
        !Object.hasOwn(this, 'size') &&
        Object.getOwnPropertyDescriptor(RenderBox.prototype, 'size')?.get === defaultSizeGetter &&
        !Object.getOwnPropertyDescriptor(RenderProxyBox.prototype, 'size') &&
        previous.value === this.annotation &&
        (size === null
          ? previous.size === null
          : previous.size !== null &&
            Object.is(size.width, previous.size.width) &&
            Object.is(size.height, previous.size.height)) &&
        Object.getPrototypeOf(previous.layer) === AnnotatedRegionLayer.prototype &&
        Object.getOwnPropertyDescriptor(previous.layer, 'value')?.value === previous.value &&
        Object.getOwnPropertyDescriptor(previous.layer, 'annotationType')?.value ===
          this.annotationType &&
        Object.getOwnPropertyDescriptor(previous.layer, 'size')?.value === previous.size &&
        Object.getOwnPropertyDescriptor(previous.layer, 'offset')?.value === previous.offset &&
        Object.getOwnPropertyDescriptor(previous.layer, 'opaque')?.value === false;
    const layer = stable
        ? previous.layer
        : new AnnotatedRegionLayer(this.annotation, {
            annotationType: this.annotationType,
            size,
          }),
      hold = new LayerHandle(layer);
    try {
      context.pushLayer(
        layer,
        (childContext) => super.paint(childContext),
        { x: 0, y: 0 },
        this.paintBounds,
      );
      this.retained.layer = layer;
      if (!stable)
        this.annotationSnapshot = {
          layer,
          value: this.annotation,
          size: layer.size,
          offset: layer.offset,
        };
    } finally {
      hold.dispose();
    }
  }
  override detach(): void {
    try {
      super.detach();
    } finally {
      if (!this.attached) {
        this.retained.dispose();
        this.annotationSnapshot = undefined;
      }
    }
  }
  override dispose(): void {
    try {
      super.dispose();
    } finally {
      if (this.debugDisposed) {
        this.retained.dispose();
        this.annotationSnapshot = undefined;
      }
    }
  }
}
