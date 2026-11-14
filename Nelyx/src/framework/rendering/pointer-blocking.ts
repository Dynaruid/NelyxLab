// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter rendering/proxy_box.dart at the recorded pin.
import type { SemanticsConfiguration } from '../semantics/semantics.ts';
import { invariant } from '../../foundation/errors.ts';
import { contains } from '../../ui/geometry.ts';
import type { Offset, TransformMatrix } from '../../ui/geometry.ts';
import type { SemanticsNode, Rect } from '../../ui/types.ts';
import { RenderProxyBox } from './boxes.ts';
import type { RenderBox, RenderObject, HitTestEntry } from './object.ts';
function blockActions(nodes: readonly SemanticsNode[]): SemanticsNode[] {
  let count = 0;
  const ancestors = new Set<SemanticsNode>();
  const visit = (node: SemanticsNode, depth: number): SemanticsNode => {
    invariant(
      ++count <= 2048 && depth <= 64 && !ancestors.has(node),
      'semantics-budget',
      'Blocked semantics exceed the host tree budget or contain a cycle',
    );
    const { activate, actions, children, ...rest } = node;
    ancestors.add(node);
    try {
      return {
        ...rest,
        ...(children ? { children: children.map((child) => visit(child, depth + 1)) } : {}),
      };
    } finally {
      ancestors.delete(node);
    }
  };
  return nodes.map((node) => visit(node, 0));
}
export interface RenderIgnorePointerOptions {
  readonly child?: RenderBox<RenderObject>;
  readonly ignoring?: boolean;
}
export class RenderIgnorePointer extends RenderProxyBox {
  protected override markNeedsPaintAfterLayout(): void {
    if (
      this.hasStaticLayoutSemantics(
        RenderIgnorePointer.prototype,
        RenderIgnorePointer.prototype.describeSemanticsConfiguration,
      )
    )
      this.markNeedsPaintAfterGeometryLayout();
    else super.markNeedsPaintAfterLayout();
  }
  private _ignoring: boolean;
  constructor({ child, ignoring = true }: RenderIgnorePointerOptions = {}) {
    invariant(typeof ignoring === 'boolean', 'invalid-ignoring', 'ignoring must be boolean');
    super();
    this._ignoring = ignoring;
    if (child) this.insert(child);
  }
  get ignoring(): boolean {
    return this._ignoring;
  }
  set ignoring(value: boolean) {
    this.assertCanMutateLayoutProperty();
    invariant(typeof value === 'boolean', 'invalid-ignoring', 'ignoring must be boolean');
    if (this._ignoring === value) return;
    this._ignoring = value;
    this.markNeedsPaint();
  }
  override describeSemanticsConfiguration(config: SemanticsConfiguration): void {
    super.describeSemanticsConfiguration(config);
    config.isBlockingUserActions = this.ignoring;
  }
  override hitTest(position: Offset, result: HitTestEntry[], toLocal?: TransformMatrix): boolean {
    return !this.ignoring && super.hitTest(position, result, toLocal);
  }
  override collectSemantics(output: SemanticsNode[], matrix?: TransformMatrix, clip?: Rect): void {
    if (!this.ignoring) {
      super.collectSemantics(output, matrix, clip);
      return;
    }
    const nodes: SemanticsNode[] = [];
    super.collectSemantics(nodes, matrix, clip);
    output.push(...blockActions(nodes));
  }
}
export interface RenderAbsorbPointerOptions {
  readonly child?: RenderBox<RenderObject>;
  readonly absorbing?: boolean;
}
export class RenderAbsorbPointer extends RenderProxyBox {
  protected override markNeedsPaintAfterLayout(): void {
    if (
      this.hasStaticLayoutSemantics(
        RenderAbsorbPointer.prototype,
        RenderAbsorbPointer.prototype.describeSemanticsConfiguration,
      )
    )
      this.markNeedsPaintAfterGeometryLayout();
    else super.markNeedsPaintAfterLayout();
  }
  private _absorbing: boolean;
  constructor({ child, absorbing = true }: RenderAbsorbPointerOptions = {}) {
    invariant(typeof absorbing === 'boolean', 'invalid-absorbing', 'absorbing must be boolean');
    super();
    this._absorbing = absorbing;
    if (child) this.insert(child);
  }
  get absorbing(): boolean {
    return this._absorbing;
  }
  set absorbing(value: boolean) {
    this.assertCanMutateLayoutProperty();
    invariant(typeof value === 'boolean', 'invalid-absorbing', 'absorbing must be boolean');
    if (this._absorbing === value) return;
    this._absorbing = value;
    this.markNeedsPaint();
  }
  override describeSemanticsConfiguration(config: SemanticsConfiguration): void {
    super.describeSemanticsConfiguration(config);
    config.isBlockingUserActions = this.absorbing;
  }
  override hitTest(position: Offset, result: HitTestEntry[], toLocal?: TransformMatrix): boolean {
    return this.absorbing
      ? contains(this.paintBounds, position)
      : super.hitTest(position, result, toLocal);
  }
  override collectSemantics(output: SemanticsNode[], matrix?: TransformMatrix, clip?: Rect): void {
    if (!this.absorbing) {
      super.collectSemantics(output, matrix, clip);
      return;
    }
    const nodes: SemanticsNode[] = [];
    super.collectSemantics(nodes, matrix, clip);
    output.push(...blockActions(nodes));
  }
}
