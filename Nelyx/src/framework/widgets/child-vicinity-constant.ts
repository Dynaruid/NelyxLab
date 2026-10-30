// SPDX-License-Identifier: BSD-3-Clause
import { checkedInteger } from '../../ui/value-math.ts';
import type { ChildVicinity } from './child-vicinity.generated.ts';
type Constructor = new (options: { xIndex: number; yIndex: number }) => ChildVicinity;
// Separate from predicate bindings so either module entry order is safe.
const constants = new WeakMap<Constructor, Map<number, Map<number, ChildVicinity>>>();
/** Exact canonical table for this two-safe-integer immutable source value type. */
export function constantChildVicinity(
  owner: Constructor,
  options: { xIndex: number; yIndex: number },
): ChildVicinity {
  const x = checkedInteger(options.xIndex),
    y = checkedInteger(options.yIndex);
  let rows = constants.get(owner);
  if (!rows) {
    rows = new Map();
    constants.set(owner, rows);
  }
  let row = rows.get(x);
  if (!row) {
    row = new Map();
    rows.set(x, row);
  }
  let result = row.get(y);
  if (!result) {
    result = new owner({ xIndex: x, yIndex: y });
    row.set(y, result);
  }
  return result;
}
