// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { SemanticsConfiguration } from '../semantics/semantics.ts';
import { RenderProxyBox } from './boxes.ts';
import type { RenderBox } from './object.ts';
import { invariant } from '../../foundation/errors.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import { identity } from '../../ui/geometry.ts';
import type { TransformMatrix } from '../../ui/geometry.ts';
import type { Rect, SemanticsNode } from '../../ui/types.ts';

/** Source proxy_box.dart index annotation adapted to the current immutable
 * Core semantics snapshot. The first emitted child node receives the index.
 * Native collection/reader announcements require their provider mappings. */
export class RenderIndexedSemantics extends RenderProxyBox {
  protected override markNeedsPaintAfterLayout(): void {
    if (
      this.hasStaticLayoutSemantics(
        RenderIndexedSemantics.prototype,
        RenderIndexedSemantics.prototype.describeSemanticsConfiguration,
      )
    )
      this.markNeedsPaintAfterGeometryLayout();
    else super.markNeedsPaintAfterLayout();
  }
  private _index: number;
  constructor({ child, index }: { readonly child?: RenderBox; readonly index: number }) {
    super(child);
    this._index = this.validIndex(index);
  }
  private validIndex(value: number): number {
    invariant(
      Number.isSafeInteger(value) && value >= 0,
      'invalid-semantic-index',
      'Semantic index must be a nonnegative safe integer',
    );
    return value;
  }
  get index(): number {
    return this._index;
  }
  set index(value: number) {
    this.assertCanMutateLayoutProperty();
    this.validIndex(value);
    if (value === this._index) return;
    this._index = value;
    this.markNeedsPaint();
  }
  override describeSemanticsConfiguration(config: SemanticsConfiguration): void {
    super.describeSemanticsConfiguration(config);
    config.indexInParent = this.index;
  }
  override collectSemantics(
    output: SemanticsNode[],
    matrix: TransformMatrix = identity,
    clip?: Rect,
  ): void {
    const children: SemanticsNode[] = [];
    super.collectSemantics(children, matrix, clip);
    if (children.length) children[0] = { ...children[0]!, indexInParent: this.index };
    output.push(...children);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('index', this.index));
  }
}
