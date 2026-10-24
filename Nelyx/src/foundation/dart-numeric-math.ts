// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2012, the Dart project authors. All rights reserved.
// Adapted from dart-sdk/lib/_internal/vm/lib/math_patch.dart, max<T extends num>.
import {DartDouble,castSourceDartNum} from './dart-numeric.ts';
import type {DartNumeric} from './dart-numeric.ts';

/** Preserve VM min selection, retained numeric kinds, NaN and signed zero.
 * @dartParam a T
 * @dartParam b T
 * @dartReturn T
 * @dartTypeParameter T num
 */
export function minSourceDartNum<T extends DartNumeric>(a:T,b:T):T{
  const left=castSourceDartNum(a),right=castSourceDartNum(b);
  if(left.value>right.value)return b;
  if(left.value<right.value)return a;
  if(DartDouble.is(right)){
    if(DartDouble.is(left)&&left.value===0)return DartDouble.fromSource((left.value+right.value)*left.value*right.value) as T;
    if(left.value===0&&(right.value<0||Object.is(right.value,-0))||Number.isNaN(right.value))return b;
    return a;
  }
  return a;
}

/** Preserve the original selected int/double value, NaN and signed-zero rules.
 * @dartParam a T
 * @dartParam b T
 * @dartReturn T
 * @dartTypeParameter T num
 */
export function maxSourceDartNum<T extends DartNumeric>(a:T,b:T):T{
  const left=castSourceDartNum(a),right=castSourceDartNum(b);
  if(left.value>right.value)return a;
  if(left.value<right.value)return b;
  if(DartDouble.is(right)){
    if(DartDouble.is(left)&&left.value===0){
      // Both operands are proven source doubles; the VM also creates a double
      // for this zero/NaN branch. Their final carrier types cannot be subclassed.
      return DartDouble.fromSource(left.value+right.value) as T;
    }
    if(Number.isNaN(right.value))return b;
    return a;
  }
  if(right.value===0&&(left.value<0||Object.is(left.value,-0)))return b;
  return a;
}
