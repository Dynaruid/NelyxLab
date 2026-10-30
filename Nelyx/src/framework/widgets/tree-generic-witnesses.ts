// SPDX-License-Identifier: BSD-3-Clause
import type { SourceTreeSliverStateMixin } from './sliver-tree.generated.ts';
import { applyDartType } from '../../foundation/dart-type-witness.ts';
import type { DartTypeWitness } from '../../foundation/dart-type-witness.ts';

export {
  sourceStatefulWidgetType as treeStatefulWidgetType,
  sourceStateType as treeCoreStateType,
  sourceTickerStateType as treeTickerStateType,
} from './framework-source-types.ts';
// This token represents the erased abstract-only source interface. It never
// supplies lifecycle or method bodies and cannot be used as a constructor.
function TreeStateMixinTypeOwner(): never {
  throw new TypeError('An abstract source interface has no constructor');
}
export function treeStateMixinType<T extends {} | null>(
  type: DartTypeWitness<T>,
): DartTypeWitness<SourceTreeSliverStateMixin<T>> {
  return applyDartType(TreeStateMixinTypeOwner, 'TreeSliverStateMixin', [type], []);
}
