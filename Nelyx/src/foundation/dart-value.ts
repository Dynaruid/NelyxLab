// SPDX-License-Identifier: BSD-3-Clause
import { checkedInteger, hashDoubles } from '../ui/value-math.ts';
import { isDartNumeric } from './dart-numeric.ts';
import { sourceFunctionIdentity } from './dart-function.ts';
import { DartMap, DartSet } from './dart-collections.ts';

/** Explicit virtual Object semantics for source-owned or reviewed host classes.
 * An unregistered object is not silently treated as an identity-only Dart object. */
export interface DartValueSemantics<T extends object> {
  readonly accepts: (value: unknown) => value is T;
  readonly equals: (value: T, other: {}) => boolean;
  readonly hash: (value: T) => number;
  readonly string?: (value: T) => string;
}
type ErasedSemantics = DartValueSemantics<object>;
const semantics = new WeakMap<object, ErasedSemantics>();
const identities = new WeakMap<object, number>();
let nextIdentity = 0;

export function registerDartValueSemantics<T extends object>(
  owner: Function & { readonly prototype: T },
  value: DartValueSemantics<T>,
): void {
  if (
    typeof owner !== 'function' ||
    !owner.prototype ||
    typeof value.accepts !== 'function' ||
    typeof value.equals !== 'function' ||
    typeof value.hash !== 'function' ||
    (value.string !== undefined && typeof value.string !== 'function')
  )
    throw new TypeError('Invalid Dart value semantics');
  const previous = semantics.get(owner.prototype);
  if (previous) {
    if (
      previous.accepts !== value.accepts ||
      previous.equals !== value.equals ||
      previous.hash !== value.hash ||
      previous.string !== value.string
    )
      throw new TypeError('Conflicting Dart value semantics');
    return;
  }
  // objectSemantics checks this exact predicate before calling either erased callback.
  semantics.set(owner.prototype, Object.freeze({ ...value }) as unknown as ErasedSemantics);
}

function objectSemantics(value: object): ErasedSemantics {
  for (
    let prototype = Object.getPrototypeOf(value);
    prototype !== null;
    prototype = Object.getPrototypeOf(prototype)
  ) {
    const candidate = semantics.get(prototype);
    if (candidate) {
      if (!candidate.accepts(value))
        throw new TypeError('Value was not admitted by its registered Dart owner');
      return candidate;
    }
  }
  throw new TypeError('Object has no registered Dart value semantics');
}

function checkRepresentation(value: unknown): void {
  if (
    value !== null &&
    !['string', 'boolean', 'number', 'object', 'function'].includes(typeof value)
  )
    throw new TypeError('Unrepresented Dart value');
}

/** Receiver-directed dispatch, including non-reflexive user equality. */
export function dartValueEquals(value: unknown, other: unknown): boolean {
  checkRepresentation(value);
  checkRepresentation(other);
  if (value === null || other === null) return value === other;
  // Numeric equality is independent of int/double kind. Preserve symmetry
  // with the existing scalar ABI without inferring a runtime numeric type.
  if (isDartNumeric(value)) return value.value === (isDartNumeric(other) ? other.value : other);
  if (typeof value === 'number' && isDartNumeric(other)) return value === other.value;
  if (typeof value === 'function')
    return (
      typeof other === 'function' && sourceFunctionIdentity(value) === sourceFunctionIdentity(other)
    );
  if (DartMap.is(value) && Object.getPrototypeOf(value) === DartMap.prototype)
    return value === other;
  if (DartSet.is(value) && Object.getPrototypeOf(value) === DartSet.prototype)
    return value === other;
  if (typeof value !== 'object' && typeof value !== 'function') return value === other;
  return objectSemantics(value).equals(value, other as {});
}

/** Identity is an explicitly chosen policy, not an equality fallback. */
export function dartIdentityHash(value: object): number {
  if (typeof value === 'function') value = sourceFunctionIdentity(value);
  let result = identities.get(value);
  if (result === undefined) {
    result = checkedInteger(++nextIdentity);
    identities.set(value, result);
  }
  return result;
}

/** Local integer hash ABI. Equal int/double values share their numeric hash;
 * no operation here determines whether a number originated as int or double. */
export function dartValueHash(value: unknown): number {
  checkRepresentation(value);
  if (value === null) return 0;
  if (isDartNumeric(value)) return hashDoubles([value.value]);
  if (typeof value === 'number') return hashDoubles([value]);
  if (typeof value === 'function') return dartIdentityHash(value);
  if (DartMap.is(value) && Object.getPrototypeOf(value) === DartMap.prototype)
    return dartIdentityHash(value);
  if (DartSet.is(value) && Object.getPrototypeOf(value) === DartSet.prototype)
    return dartIdentityHash(value);
  if (typeof value === 'boolean') return value ? 1231 : 1237;
  if (typeof value === 'string') {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++)
      hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    return hash >>> 0;
  }
  const object = value as object;
  return checkedInteger(objectSemantics(object).hash(object));
}

export function dartValueHashPair(first: unknown, second: unknown): number {
  return hashDoubles([dartValueHash(first), dartValueHash(second)]);
}

/** Numeric rendering needs source value provenance, including numbers held in
 * Object/num slots. Never choose int/double from integrality or a JS display. */
export function dartValueString(value: unknown): string {
  checkRepresentation(value);
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number')
    throw new TypeError('Dart numeric string conversion requires source value provenance');
  if (isDartNumeric(value)) return value.toString();
  const object = value as object,
    policy = objectSemantics(object);
  if (!policy.string) throw new TypeError('Object has no registered Dart string semantics');
  const result = policy.string(object);
  if (typeof result !== 'string') throw new TypeError('Dart toString must return a string');
  return result;
}
