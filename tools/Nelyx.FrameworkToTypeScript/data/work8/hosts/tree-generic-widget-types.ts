// SPDX-License-Identifier: BSD-3-Clause
// Staged only alongside the complete generated widget library.
import {
  SourceTreeSliverState,
  SourceTreeSliverNode,
  SourceTreeSliverController,
  SourceTreeSliver,
  SourceSliverTree,
} from './sliver-tree.generated.ts';
import { ParentDataWidget } from './framework.ts';
import type { BuildContext, Widget, ParentDataType } from './framework.ts';
import type { ParentData } from '../rendering/object.ts';
import {
  SourceTreeSliverNodeParentData,
  SourceRenderTreeSliver,
} from '../rendering/sliver-tree.generated.ts';
import { SliverMultiBoxAdaptorElement } from './sliver.ts';
import { DartMap } from '../../foundation/dart-collections.ts';
import { dartNamedRecordRead } from '../../foundation/dart-named-record.ts';
import type { DartNamedRecord } from '../../foundation/dart-named-record.ts';
import { AnimationController } from '../animation/animation-controller.ts';
import { CurvedAnimation } from '../animation/animations.ts';
import { UniqueKey } from '../../foundation/key.ts';
import { Key, ValueKey, sameKey } from '../../foundation/key.ts';
import { IndexedSemantics } from './basic.ts';
import { RepaintBoundary } from './repaint-boundary.ts';
import {
  fixedTreeExtent,
  registerFixedTreeExtent,
} from '../rendering/tree-sliver-source-adapter.ts';
import {
  castDartType,
  isDartType,
  hasCapturedDartType,
  captureDartType,
  describeDartType,
  runtimeDartType,
} from '../../foundation/dart-type-witness.ts';
import type { DartTypeWitness } from '../../foundation/dart-type-witness.ts';
import { DartInt, DartDouble } from '../../foundation/dart-numeric.ts';
import {
  registerDartValueSemantics,
  dartIdentityHash,
  dartValueEquals,
  dartValueHash,
} from '../../foundation/dart-value.ts';
type AnimationRecord = DartNamedRecord<
  readonly [],
  { controller: AnimationController; animation: CurvedAnimation; key: UniqueKey }
>;
type NodesAnimation = DartNamedRecord<
  readonly [],
  { fromIndex: DartInt; toIndex: DartInt; value: DartDouble }
>;
let valueOwnersRegistered = false;
function registerTreeValueOwners(): void {
  if (valueOwnersRegistered) return;
  registerDartValueSemantics(SourceTreeSliverNode, {
    accepts: (value: unknown): value is SourceTreeSliverNode<{} | null> =>
      hasCapturedDartType(value, SourceTreeSliverNode) &&
      Object.getPrototypeOf(value) === SourceTreeSliverNode.prototype,
    equals: (value, other) => value === other,
    hash: dartIdentityHash,
    string: (value) => value.toString(),
  });
  registerDartValueSemantics(SourceTreeSliverController, {
    accepts: (value: unknown): value is SourceTreeSliverController =>
      value instanceof SourceTreeSliverController &&
      Object.getPrototypeOf(value) === SourceTreeSliverController.prototype,
    equals: (value, other) => value === other,
    hash: dartIdentityHash,
    string: (value) => "Instance of '" + describeDartType(runtimeDartType(value)) + "'",
  });
  valueOwnersRegistered = true;
}
/** All source values use their explicit owner policy, including numeric content.
 * Unrepresented host objects/subclasses do not acquire Dart semantics by shape. */
export function treeObjectEquals(value: unknown, other: unknown): boolean {
  registerTreeValueOwners();
  return dartValueEquals(value, other);
}
/** Capture and register only metadata; fields and user bodies are not observed.
 * Constructor-time registration also covers standalone nodes/controllers. */
export function captureTreeDartType(value: object, type: object): void {
  captureDartType(value, type);
  registerTreeValueOwners();
}
export function findTreeSliverState(
  context: BuildContext,
): SourceTreeSliverState<{} | null> | null {
  return (
    context.findAncestorStateOfType<SourceTreeSliverState<{} | null>>(SourceTreeSliverState) ?? null
  );
}
export function treeNodeAnimationMap<T extends {} | null>(
  type: DartTypeWitness<SourceTreeSliverNode<T>>,
): DartMap<SourceTreeSliverNode<T>, AnimationRecord> {
  registerTreeValueOwners();
  return new DartMap(
    {
      accepts: (value: unknown): value is SourceTreeSliverNode<T> => {
        castDartType(value, type);
        return true;
      },
      validQuery: (value) => isDartType(value, type),
      hash: dartValueHash,
      equals: dartValueEquals,
    },
    (value: unknown): value is AnimationRecord => {
      const record = value as AnimationRecord;
      if (
        dartNamedRecordRead(record, 'controller', 0, ['animation', 'controller', 'key']) instanceof
          AnimationController &&
        dartNamedRecordRead(record, 'animation', 0, ['animation', 'controller', 'key']) instanceof
          CurvedAnimation &&
        dartNamedRecordRead(record, 'key', 0, ['animation', 'controller', 'key']) instanceof
          UniqueKey
      )
        return true;
      throw new TypeError('Invalid source tree animation record');
    },
  );
}
export function treeNodesAnimationMap(): DartMap<UniqueKey, NodesAnimation> {
  return new DartMap(
    {
      accepts: (value: unknown): value is UniqueKey => value instanceof UniqueKey,
      hash: (value) => value,
      equals: (a, b) => a === b,
    },
    (value: unknown): value is NodesAnimation => {
      const record = value as NodesAnimation;
      if (
        DartInt.is(
          dartNamedRecordRead(record, 'fromIndex', 0, ['fromIndex', 'toIndex', 'value']),
        ) &&
        DartInt.is(dartNamedRecordRead(record, 'toIndex', 0, ['fromIndex', 'toIndex', 'value'])) &&
        DartDouble.is(dartNamedRecordRead(record, 'value', 0, ['fromIndex', 'toIndex', 'value']))
      )
        return true;
      throw new TypeError('Invalid source tree numeric animation record');
    },
  );
}
/** Closed recipe binds this host only to TreeSliverNodeParentData. */
export abstract class TreeParentDataHost<T extends ParentData> extends ParentDataWidget<T> {
  readonly parentDataType = SourceTreeSliverNodeParentData as unknown as ParentDataType<T>;
  constructor({ child }: { child: Widget }) {
    super(child, { key: treeRowIdentity(child) });
  }
}
export function isTreeSliverElement(value: unknown): value is SliverMultiBoxAdaptorElement {
  return value instanceof SliverMultiBoxAdaptorElement;
}
export function castTreeSliverElement(value: unknown): SliverMultiBoxAdaptorElement {
  if (!isTreeSliverElement(value)) throw new TypeError('Expected actual sliver child Element');
  return value;
}
export function isTreeRenderObject(value: unknown): value is SourceRenderTreeSliver {
  return value instanceof SourceRenderTreeSliver;
}
export function castTreeRenderObject(value: unknown): SourceRenderTreeSliver {
  if (!isTreeRenderObject(value)) throw new TypeError('Expected actual source tree renderer');
  return value;
}
/** The parent-data wrapper must not hide the builder's row identity. A local
 * wrapper key also avoids installing one GlobalKey at two Element depths. */
class TreeRowKey extends ValueKey<Key> {
  constructor(key: Key) {
    super(key, Key, sameKey, (value) => value.hashCode);
  }
}
function treeRowIdentity(child: Widget): Key | null {
  let row = child;
  while (row instanceof RepaintBoundary || row instanceof IndexedSemantics) {
    if (!row.child) break;
    row = row.child;
  }
  return row.key === null ? null : new TreeRowKey(row.key);
}
export function treeFindChildIndex<T extends {} | null>(
  widget: SourceTreeSliver<T>,
): ((key: Key) => number | null) | null {
  const callback = widget.findChildIndexCallback;
  return callback === null ? null : (key) => callback(key instanceof TreeRowKey ? key.value : key);
}
export function treeSliverWithExtentContract<T extends {} | null>(
  owner: SourceTreeSliverState<T>,
  options: ConstructorParameters<typeof SourceSliverTree>[0],
): SourceSliverTree {
  const extent = fixedTreeExtent(owner.widget.treeRowExtentBuilder);
  if (extent !== null) registerFixedTreeExtent(options.itemExtentBuilder, extent);
  return new SourceSliverTree(options);
}
