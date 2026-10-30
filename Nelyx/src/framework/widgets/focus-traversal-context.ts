// SPDX-License-Identifier: BSD-3-Clause
// Internal markers keep traversal policy independent of widget construction.
import type { BuildContext } from './framework.ts';
import type { FocusNode } from './focus.ts';
import type { FocusTraversalPolicy, FocusOrder } from './focus-traversal-policy.ts';
export interface TraversalGroupData {
  policy: FocusTraversalPolicy;
  lastRequestedFocus: FocusNode | null;
}
const groups = new WeakMap<FocusNode, TraversalGroupData>();
const orders = new WeakMap<object, FocusOrder>();
const directions = new WeakMap<object, 'ltr' | 'rtl'>();
const scrollables = new WeakMap<object, { axis: 'horizontal' | 'vertical'; owner: object }>();
export function markTraversalGroup(node: FocusNode, data: TraversalGroupData): void {
  groups.set(node, data);
}
export function unmarkTraversalGroup(node: FocusNode): void {
  groups.delete(node);
}
export function traversalGroupData(node: FocusNode): TraversalGroupData | undefined {
  return groups.get(node);
}
export function traversalGroupNode(node: FocusNode | null): FocusNode | null {
  for (let value = node; value?.parent; value = value.parent) {
    if (!value.context) return null;
    if (groups.has(value)) return value;
  }
  return null;
}
export function markFocusOrder(widget: object, order: FocusOrder): void {
  orders.set(widget, order);
}
export function focusOrderFor(context: BuildContext | null): FocusOrder | null {
  let result: FocusOrder | null = null;
  context?.visitAncestorElements((element) => {
    const order = orders.get(element.widget);
    if (order) {
      result = order;
      return false;
    }
    return true;
  });
  return result;
}
export function markTraversalDirection(widget: object, direction: 'ltr' | 'rtl'): void {
  directions.set(widget, direction);
}
export function traversalDirections(
  context: BuildContext | null,
): readonly { widget: object; direction: 'ltr' | 'rtl' }[] {
  const result: { widget: object; direction: 'ltr' | 'rtl' }[] = [];
  context?.visitAncestorElements((element) => {
    const direction = directions.get(element.widget);
    if (direction) result.push({ widget: element.widget, direction });
    return true;
  });
  return result;
}
export function markTraversalScrollable(
  widget: object,
  axis: 'horizontal' | 'vertical',
  owner: object,
): void {
  scrollables.set(widget, { axis, owner });
}
export function traversalScrollable(
  context: BuildContext | null,
  axis?: 'horizontal' | 'vertical',
): object | null {
  let result: object | null = null;
  context?.visitAncestorElements((element) => {
    const scroll = scrollables.get(element.widget);
    if (scroll && (!axis || scroll.axis === axis)) {
      result = scroll.owner;
      return false;
    }
    return true;
  });
  return result;
}
