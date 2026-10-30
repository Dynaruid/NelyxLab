// SPDX-License-Identifier: BSD-3-Clause
import { IndexedSemantics } from './basic.ts';
import type { Widget } from './framework.ts';

/** Dart's nullable optional child maps to the existing absent-child host contract. */
export function createWheelIndexedSemantics({
  index,
  child,
}: {
  index: number;
  child: Widget | null;
}): IndexedSemantics {
  return new IndexedSemantics(child === null ? { index } : { index, child });
}
