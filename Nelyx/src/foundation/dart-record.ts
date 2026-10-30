// SPDX-License-Identifier: BSD-3-Clause
const recordBrand = Symbol('Dart positional record');
export type DartRecord<T extends readonly unknown[]> = Readonly<T> & {
  readonly [recordBrand]: true;
};
/** Shallow immutable fields; nested lists and objects retain their own identity. */
export function dartRecord<T extends readonly unknown[]>(fields: T): DartRecord<T> {
  const result = [...fields];
  Object.defineProperty(result, recordBrand, { value: true });
  return Object.freeze(result) as unknown as DartRecord<T>;
}
export function dartRecordRead<T extends readonly unknown[], I extends number>(
  value: DartRecord<T>,
  index: I,
  arity: number,
): T[I] {
  if (
    !Array.isArray(value) ||
    !(value as DartRecord<readonly unknown[]>)[recordBrand] ||
    value.length !== arity
  )
    throw new TypeError('Expected the exact positional record shape');
  if (!Number.isSafeInteger(index) || index < 0 || index >= arity)
    throw new RangeError('Record field index is out of range');
  return value[index];
}
