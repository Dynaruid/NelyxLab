// SPDX-License-Identifier: BSD-3-Clause
// The complete generated Widget/State remains the source baseline. These owner
// boundaries preserve synchronous Core disposal and animation retirement.
import {
  SourceTreeSliver,
  SourceTreeSliverState,
  SourceTreeSliverNode,
} from './sliver-tree.generated.ts';
import type { State } from './framework.ts';
import { AnimationStyle } from '../animation/animation-style.ts';
import { dartNamedRecordRead, dartNamedRecord } from '../../foundation/dart-named-record.ts';
import { readDartType, castDartType } from '../../foundation/dart-type-witness.ts';
import type { DartTypeWitness } from '../../foundation/dart-type-witness.ts';
import { boxSourceDartInt } from '../../foundation/dart-numeric.ts';
import { createDartList } from '../../foundation/dart-mutable-list.ts';
import { treeNodeType, treeWidgetType } from './sliver-tree.generated.ts';
const mutations: { readonly mounted: boolean }[] = [];
class ClosedTreeMutation {
  constructor(readonly owner: object) {}
}
export class TreeSliver<T extends {} | null> extends SourceTreeSliver<T> {
  constructor(
    type: DartTypeWitness<T>,
    options: ConstructorParameters<typeof SourceTreeSliver<T>>[1],
  ) {
    const callback = options.onNodeToggle;
    super(type, {
      ...options,
      onNodeToggle: callback
        ? (node) => {
            const owner = mutations.at(-1);
            callback(node);
            if (owner && !owner.mounted) throw new ClosedTreeMutation(owner);
          }
        : null,
    });
  }
  override createState(): State<SourceTreeSliver<T>> {
    return new TreeSliverState<T>(readDartType<T>(this, SourceTreeSliver, 0));
  }
}
export class TreeSliverState<T extends {} | null> extends SourceTreeSliverState<T> {
  private readonly activeIndices = new Map<SourceTreeSliverNode<T>, number>();
  /** Cached lookup over the source-owned traversal; no second flattening path. */
  indexForNode(node: SourceTreeSliverNode<T>): number | null {
    return this.activeIndices.get(node) ?? null;
  }
  override _dart_8cfd46f68e2cffcc_unpackActiveNodes(
    options: Parameters<
      SourceTreeSliverState<T>['_dart_8cfd46f68e2cffcc_unpackActiveNodes']
    >[0] = {},
  ): void {
    super._dart_8cfd46f68e2cffcc_unpackActiveNodes(options);
    if (options?.nodes == null) {
      this.activeIndices.clear();
      this._dart_8cfd46f68e2cffcc_activeNodes.forEach((node, index) => {
        if (!this.activeIndices.has(node)) this.activeIndices.set(node, index);
      });
      this._dart_8cfd46f68e2cffcc_updateActiveAnimations();
    }
  }
  override _dart_8cfd46f68e2cffcc_updateActiveAnimations(): void {
    super._dart_8cfd46f68e2cffcc_updateActiveAnimations();
    const nodes = this._dart_8cfd46f68e2cffcc_activeNodes,
      animations = this._dart_8cfd46f68e2cffcc_activeAnimations;
    for (const node of this._dart_8cfd46f68e2cffcc_currentAnimationForParent.keys) {
      const source = this._dart_8cfd46f68e2cffcc_currentAnimationForParent.get(node)!,
        key = dartNamedRecordRead(source, 'key', 0, ['animation', 'controller', 'key']),
        index = this.activeIndices.get(node);
      if (index === undefined) {
        animations.remove(key);
        continue;
      }
      let end = index;
      while (end + 1 < nodes.length && nodes[end + 1]!.depth! > node.depth!) end++;
      if (end === index) {
        animations.remove(key);
        continue;
      }
      const original = animations.get(key)!;
      animations.set(
        key,
        dartNamedRecord(
          0,
          ['fromIndex', 'toIndex', 'value'],
          [
            ['fromIndex', boxSourceDartInt(index + 1)],
            ['toIndex', boxSourceDartInt(end)],
            ['value', dartNamedRecordRead(original, 'value', 0, ['fromIndex', 'toIndex', 'value'])],
          ],
        ),
      );
    }
  }
  override setState(change: () => void): void {
    mutations.push(this);
    try {
      super.setState(change);
    } catch (error) {
      if (!(error instanceof ClosedTreeMutation && error.owner === this && !this.mounted))
        throw error;
    } finally {
      mutations.pop();
    }
  }
  private animationsDisabled(): boolean {
    const style = this.widget.toggleAnimationStyle;
    return style?.duration === 0 || style?.equals(AnimationStyle.noAnimation) === true;
  }
  private retireNodeAnimation(node: SourceTreeSliverNode<T>): void {
    const records = this._dart_8cfd46f68e2cffcc_currentAnimationForParent,
      record = records.remove(node);
    if (record === null) return;
    const animation = dartNamedRecordRead(record, 'animation', 0, [
        'animation',
        'controller',
        'key',
      ]),
      controller = dartNamedRecordRead(record, 'controller', 0, ['animation', 'controller', 'key']);
    try {
      animation.dispose();
    } finally {
      controller.dispose();
    }
  }
  override toggleNode(node: SourceTreeSliverNode<T>): void {
    castDartType(node, treeNodeType(readDartType<T>(this, SourceTreeSliverState, 0)));
    if (this.animationsDisabled()) {
      this.retireNodeAnimation(node);
      this._dart_8cfd46f68e2cffcc_updateActiveAnimations();
    }
    super.toggleNode(node);
  }
  override expandAll(): void {
    const nodes = createDartList(treeNodeType(readDartType<T>(this, SourceTreeSliverState, 0)), []);
    this._dart_8cfd46f68e2cffcc_expandAll(this.widget.tree, nodes);
    for (const node of nodes.reverse()) {
      if (!this.mounted) break;
      this.toggleNode(node);
    }
  }
  override collapseAll(): void {
    const nodes = createDartList(treeNodeType(readDartType<T>(this, SourceTreeSliverState, 0)), []);
    this._dart_8cfd46f68e2cffcc_collapseAll(this.widget.tree, nodes);
    // Immediate parent collapse removes descendants from the active list.
    // Collapse children first; animated traversal retains the source order.
    if (!this.animationsDisabled()) nodes.reverse();
    for (const node of nodes) {
      if (!this.mounted) break;
      this.toggleNode(node);
    }
  }
  override didUpdateWidget(oldWidget: SourceTreeSliver<T>): void {
    castDartType(oldWidget, treeWidgetType(readDartType<T>(this, SourceTreeSliverState, 0)));
    const active = new Set<SourceTreeSliverNode<T>>(),
      pending = [...this.widget.tree];
    while (pending.length) {
      const node = pending.pop()!;
      if (active.has(node)) continue;
      active.add(node);
      for (const child of node.children) pending.push(child);
    }
    const snapshot = [...this._dart_8cfd46f68e2cffcc_currentAnimationForParent.keys];
    for (const node of snapshot)
      if (!active.has(node) || this.animationsDisabled()) this.retireNodeAnimation(node);
    super.didUpdateWidget(oldWidget);
    this._dart_8cfd46f68e2cffcc_updateActiveAnimations();
  }
  override dispose(): void {
    try {
      super.dispose();
    } finally {
      this.activeIndices.clear();
      this._dart_8cfd46f68e2cffcc_currentAnimationForParent.clear();
      this._dart_8cfd46f68e2cffcc_activeAnimations.clear();
      this._dart_8cfd46f68e2cffcc_activeNodes.length = 0;
    }
  }
}
