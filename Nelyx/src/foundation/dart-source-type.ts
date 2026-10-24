// SPDX-License-Identifier: BSD-3-Clause
import {requireDartNumericProvenance} from './dart-numeric.ts';
import {castDartType} from './dart-type-witness.ts';
import type {DartTypeWitness} from './dart-type-witness.ts';

/** Source generic slots require retained numeric provenance even when widened
 * to Object/Object?. Scalar host numbers must cross their explicit int/double
 * boundary before entering this ABI; no kind is inferred from their value. */
export function castSourceDartType<T>(value:unknown,type:DartTypeWitness<T>):T{
  requireDartNumericProvenance(value);
  return castDartType(value,type);
}
