// SPDX-License-Identifier: BSD-3-Clause
import { DartInt, DartDouble, requireDartNumericProvenance } from './dart-numeric.ts';
import { sourceFunctionIdentity } from './dart-function.ts';

/** Host IEEE representation, including signed zero. JS engines may canonicalize
 * NaN signs/payloads before this boundary. Reject that unsupported domain until
 * a bit-preserving source representation exists; never silently merge it. */
export function sourceDoubleBits(value: number): string {
  if (Number.isNaN(value))
    throw new TypeError('Source double identity requires bit-preserving NaN provenance');
  const bytes = new DataView(new ArrayBuffer(8));
  bytes.setFloat64(0, value);
  return bytes.getUint32(0).toString(16) + ':' + bytes.getUint32(4).toString(16);
}

/** Source identical for explicitly represented erased values. */
export function dartValueIdentical(left: unknown, right: unknown): boolean {
  requireDartNumericProvenance(left);
  requireDartNumericProvenance(right);
  if (typeof left === 'function')
    return (
      typeof right === 'function' && sourceFunctionIdentity(left) === sourceFunctionIdentity(right)
    );
  if (DartInt.is(left)) return DartInt.is(right) && left.value === right.value;
  if (DartDouble.is(left))
    return DartDouble.is(right) && sourceDoubleBits(left.value) === sourceDoubleBits(right.value);
  return left === right;
}
