// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '../../foundation/errors.ts';
import { AnnotationType } from '../rendering/layer.ts';
import { RenderAnnotatedRegion } from '../rendering/annotated-region.ts';
import { SingleChildRenderObjectWidget, Widget } from './framework.ts';
import type { WidgetOptions, BuildContext } from './framework.ts';
import type { RenderObject } from '../rendering/object.ts';
const runtimeTypes = new WeakMap<object, WeakMap<object, object>>();
export interface AnnotatedRegionOptions<T extends {}> extends WidgetOptions {
  readonly value: T;
  readonly annotationType: AnnotationType<T>;
  readonly sized?: boolean;
}
export class AnnotatedRegion<T extends {}> extends SingleChildRenderObjectWidget {
  readonly value: T;
  readonly annotationType: AnnotationType<T>;
  readonly sized: boolean;
  constructor(child: Widget, options: AnnotatedRegionOptions<T>) {
    super(child, options);
    invariant(
      child instanceof Widget,
      'invalid-annotation-child',
      'AnnotatedRegion requires a child',
    );
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
    this.value = options.value;
    this.annotationType = options.annotationType;
    this.sized = options.sized ?? true;
  }
  override get typeToken(): object {
    let types = runtimeTypes.get(this.constructor);
    if (!types) {
      types = new WeakMap();
      runtimeTypes.set(this.constructor, types);
    }
    let token = types.get(this.annotationType);
    if (!token) {
      token = Object.freeze({});
      types.set(this.annotationType, token);
    }
    return token;
  }
  createRenderObject(): RenderAnnotatedRegion<T> {
    return new RenderAnnotatedRegion({
      value: this.value,
      annotationType: this.annotationType,
      sized: this.sized,
    });
  }
  updateRenderObject(_context: BuildContext, render: RenderObject): void {
    invariant(
      render instanceof RenderAnnotatedRegion && render.annotationType === this.annotationType,
      'invalid-annotation-render',
      'AnnotatedRegion requires a matching render annotation type',
    );
    render.value = this.value;
    render.sized = this.sized;
  }
}
