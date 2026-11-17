// SPDX-License-Identifier: BSD-3-Clause
import { visitAncestorInheritedElements } from './framework.ts';
import type { BuildContext, InheritedWidget } from './framework.ts';
import type { FocusNode } from './focus.ts';
const markers = new WeakMap<object, FocusNode>();
export function markFocusScope(widget: InheritedWidget, node: FocusNode): void {
  markers.set(widget, node);
}
export function findFocusAncestor(context: BuildContext): FocusNode | null {
  let result: FocusNode | null = null;
  visitAncestorInheritedElements(context, (element) => {
    const marker = markers.get(element.widget);
    if (!marker) return true;
    result = marker;
    return false;
  });
  return result;
}
