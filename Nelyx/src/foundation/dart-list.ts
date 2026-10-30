// SPDX-License-Identifier: BSD-3-Clause
import { checkedInteger, modulo } from '../ui/value-math.ts';

/** Explicit array-backed Dart List boundary; identity and live length are retained. */
export type DartList<T> = readonly T[];
export function dartListGet<T>(list: DartList<T>, index: number): T {
  checkedInteger(index);
  if (index < 0 || index >= list.length) throw new RangeError('Dart List index out of range');
  return list[index]!;
}
export function dartListIsEmpty(list: DartList<unknown>): boolean {
  return list.length === 0;
}

/** Dart Euclidean modulo for the selected bounded integer representation. */
export function dartIntegerModulo(value: number, divisor: number): number {
  checkedInteger(value);
  checkedInteger(divisor);
  if (divisor === 0) throw new RangeError('Integer modulo by zero');
  return modulo(value, divisor);
}
