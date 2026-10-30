// SPDX-License-Identifier: BSD-3-Clause
import { DartInt, DartDouble } from './dart-numeric.ts';
import { sourceDoubleBits } from './dart-identity.ts';
import {
  runtimeDartType,
  applyDartType,
  captureDartInterface,
  isDartType,
  type DartTypeWitness,
} from './dart-type-witness.ts';
import { DartMap, DartSet, DartIterable, type DartKeyPolicy } from './dart-collections.ts';
import { dartValueEquals, dartValueHash, dartIdentityHash } from './dart-value.ts';
import { createDartConstList } from './dart-mutable-list.ts';

export type DartConstField = readonly [
  name: string,
  representation: 'int' | 'double' | 'int?' | 'double?' | 'value',
];
type Branch = { children: Map<unknown, Branch>; value?: object };
const owners = new WeakMap<
  Function,
  {
    fields: readonly DartConstField[];
    root: Branch;
    identityKey: boolean;
    layout: 'own' | 'getters';
    storageKeys: readonly PropertyKey[];
  }
>();
const constants = new WeakSet<object>();
const identityKeys = new WeakSet<object>();
const identityOwners = new WeakSet<object>();
const singletonOwners = new WeakMap<Function, readonly object[]>();
const branch = (): Branch => ({ children: new Map() });
const listRoots = new Map<DartTypeWitness<unknown>, Branch>();

/** Ordered const literal identity, keyed by explicit element type and admitted values.
 * A numeric-looking raw JS number never establishes an int/double source type. */
export function canonicalDartList<T>(
  elementType: DartTypeWitness<T>,
  elements: readonly T[],
): readonly T[] {
  let root = listRoots.get(elementType as DartTypeWitness<unknown>);
  if (!root) {
    root = branch();
    listRoots.set(elementType as DartTypeWitness<unknown>, root);
  }
  let current = root;
  for (const value of elements) {
    if (!isDartType(value, elementType))
      throw new TypeError('Const List element does not match its source type');
    const key = valueKey(value, 'value');
    let next = current.children.get(key);
    if (!next) {
      next = branch();
      current.children.set(key, next);
    }
    current = next;
  }
  if (!current.value) {
    const result = createDartConstList(elementType, elements);
    current.value = result;
    constants.add(result);
    identityKeys.add(result);
  }
  return current.value as readonly T[];
}

/** Explicit admission for reviewed source enum/singleton owners whose equality
 * and hash are inherited from Object. Frozen shape alone never admits a value. */
export function registerDartConstSingletons(owner: Function, values: readonly object[]): void {
  if (
    typeof owner !== 'function' ||
    !owner.prototype ||
    !values.length ||
    new Set(values).size !== values.length ||
    values.some(
      (value) => Object.getPrototypeOf(value) !== owner.prototype || !Object.isFrozen(value),
    )
  )
    throw new TypeError('Invalid source identity constants');
  const previous = singletonOwners.get(owner);
  if (
    previous &&
    (previous.length !== values.length || previous.some((value, index) => value !== values[index]))
  )
    throw new TypeError('Conflicting source identity constants');
  singletonOwners.set(owner, Object.freeze([...values]));
  identityOwners.add(owner.prototype);
  for (const value of values) {
    constants.add(value);
    identityKeys.add(value);
  }
}

function valueKey(value: unknown, representation: DartConstField[1]): unknown {
  if (representation === 'int?' || representation === 'double?') {
    if (value === null) return null;
    return valueKey(value, representation === 'int?' ? 'int' : 'double');
  }
  if (representation === 'int') return 'int:' + DartInt.fromSource(value as number).value;
  if (representation === 'double') {
    if (typeof value !== 'number')
      throw new TypeError('Const double field requires a scalar double');
    return 'double:' + sourceDoubleBits(value);
  }
  if (DartInt.is(value)) return 'int:' + value.value;
  if (DartDouble.is(value)) return 'double:' + sourceDoubleBits(value.value);
  if (typeof value === 'string') return 'string:' + value;
  if (typeof value === 'boolean' || value === null) return value;
  if (typeof value === 'object' && constants.has(value)) return value;
  throw new TypeError(
    'Const field requires explicit numeric provenance or an admitted constant value',
  );
}

/** Only generated, analyzer-validated pure constructors may call this boundary.
 * Intern initialized fields, not arguments: distinct arguments may initialize
 * identical state. A normal new expression never enters this pool. */
export function canonicalDartObject<R extends object>(
  owner: Function,
  expectedType: DartTypeWitness<R>,
  fields: readonly DartConstField[],
  create: () => R,
  identityKey = false,
): R {
  return internObject(owner, expectedType, fields, create, identityKey, 'own', []);
}

/** Audited host classes with private storage expose source final fields through
 * readonly prototype getters. Unreviewed own data/accessor state is rejected.
 * Optional storage keys come from the audited owner, never inferred names. This entry is
 * reserved for exact imported host factories; it never admits arbitrary objects. */
export function canonicalDartGetterObject<R extends object>(
  owner: Function,
  expectedType: DartTypeWitness<R>,
  fields: readonly DartConstField[],
  create: () => R,
  storageKeys: readonly PropertyKey[] = [],
): R {
  return internObject(owner, expectedType, fields, create, false, 'getters', storageKeys);
}

function internObject<R extends object>(
  owner: Function,
  expectedType: DartTypeWitness<R>,
  fields: readonly DartConstField[],
  create: () => R,
  identityKey: boolean,
  layout: 'own' | 'getters',
  storageKeys: readonly PropertyKey[],
): R {
  if (
    typeof owner !== 'function' ||
    !owner.prototype ||
    typeof identityKey !== 'boolean' ||
    new Set(fields.map((field) => field[0])).size !== fields.length ||
    fields.some(
      (field) =>
        field.length !== 2 ||
        typeof field[0] !== 'string' ||
        !['int', 'double', 'int?', 'double?', 'value'].includes(field[1]),
    )
  ) {
    throw new TypeError('Invalid const field schema');
  }
  let record = owners.get(owner);
  if (
    record &&
    (record.layout !== layout ||
      record.storageKeys.length !== storageKeys.length ||
      record.storageKeys.some((key, index) => key !== storageKeys[index]) ||
      record.identityKey !== identityKey ||
      record.fields.length !== fields.length ||
      record.fields.some(
        (field, index) => field[0] !== fields[index]![0] || field[1] !== fields[index]![1],
      ))
  ) {
    throw new TypeError('Conflicting const field schema');
  }
  const value = create();
  if (Object.getPrototypeOf(value) !== owner.prototype || runtimeDartType(value) !== expectedType)
    throw new TypeError('Const constructor returned a different source type');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(descriptors).length !== (layout === 'own' ? fields.length : storageKeys.length)
  )
    throw new TypeError('Const constructor has unreviewed instance state');
  if (layout === 'getters') {
    if (
      storageKeys.some((key) => typeof key !== 'string' && typeof key !== 'symbol') ||
      new Set(storageKeys).size !== storageKeys.length
    )
      throw new TypeError('Const host storage requires unique reflected keys');
    for (const key of storageKeys) {
      const slot = Object.getOwnPropertyDescriptor(value, key);
      if (!slot || !('value' in slot) || slot.enumerable || slot.configurable)
        throw new TypeError('Const host storage must be exact nonpublic data slots');
    }
  }
  const keys = fields.map(([name, representation]) => {
    if (layout === 'getters') {
      const accessor = Object.getOwnPropertyDescriptor(owner.prototype, name);
      if (!accessor || typeof accessor.get !== 'function' || accessor.set !== undefined)
        throw new TypeError('Const host field requires an exact readonly prototype getter');
      return valueKey(accessor.get.call(value), representation);
    }
    const field = Object.getOwnPropertyDescriptor(value, name);
    if (!field || !('value' in field) || field.writable || field.configurable)
      throw new TypeError('Const field must be an immutable own data property');
    return valueKey(field.value, representation);
  });
  if (!record) {
    record = {
      fields: Object.freeze(fields.map((field) => Object.freeze([...field]) as DartConstField)),
      root: branch(),
      identityKey,
      layout,
      storageKeys: Object.freeze([...storageKeys]),
    };
    owners.set(owner, record);
  }
  let node = record.root;
  for (const key of [expectedType, ...keys]) {
    let child = node.children.get(key);
    if (!child) {
      child = branch();
      node.children.set(key, child);
    }
    node = child;
  }
  if (node.value) return node.value as R;
  Object.freeze(value);
  constants.add(value);
  if (identityKey) {
    identityKeys.add(value);
    identityOwners.add(owner.prototype);
  }
  node.value = value;
  return value;
}

function defaultIdentity(value: unknown): value is object {
  return (
    value !== null && typeof value === 'object' && identityOwners.has(Object.getPrototypeOf(value))
  );
}
function constantValueEquals(value: unknown, other: unknown): boolean {
  return defaultIdentity(value) ? value === other : dartValueEquals(value, other);
}
function constantValueHash(value: unknown): number {
  return defaultIdentity(value) ? dartIdentityHash(value) : dartValueHash(value);
}
const defaultPolicies = new WeakMap<object, object>();
/** Default equality for represented primitive and explicitly admitted source
 * identity owners. Queries need not have the key type: int keys match doubles. */
export function dartConstMapKeyPolicy<K>(type: DartTypeWitness<K>): DartKeyPolicy<K> {
  let policy = defaultPolicies.get(type);
  if (!policy) {
    policy = Object.freeze({
      accepts: (value: unknown): value is K => isDartType(value, type),
      hash: constantValueHash,
      equals: constantValueEquals,
    });
    defaultPolicies.set(type, policy);
  }
  return policy as DartKeyPolicy<K>;
}
const mapPolicies = new WeakMap<object, object>();
const mapConstants = new WeakMap<object, Branch>();
export function dartMapType<K, V>(
  key: DartTypeWitness<K>,
  value: DartTypeWitness<V>,
): DartTypeWitness<DartMap<K, V>> {
  return applyDartType(DartMap, 'Map', [key, value], []);
}
/** Source const Map admission uses ordered entries and actual type arguments.
 * A policy must be the shared, frozen default policy of its reviewed key domain;
 * a conflicting policy cannot change the semantics of a previously interned map. */
export function canonicalDartMap<K, V>(
  keyType: DartTypeWitness<K>,
  valueType: DartTypeWitness<V>,
  policy: DartKeyPolicy<K>,
  entries: readonly (readonly [K, V])[],
): DartMap<K, V> {
  if (
    !policy ||
    !Object.isFrozen(policy) ||
    typeof policy.accepts !== 'function' ||
    typeof policy.hash !== 'function' ||
    typeof policy.equals !== 'function' ||
    (policy.validQuery !== undefined && typeof policy.validQuery !== 'function')
  )
    throw new TypeError('Const Map requires a frozen reviewed key policy');
  const previous = mapPolicies.get(keyType);
  if (previous && previous !== policy) throw new TypeError('Conflicting const Map key policy');
  const type = dartMapType(keyType, valueType),
    pairs = entries.map((entry) => {
      if (!Array.isArray(entry) || entry.length !== 2)
        throw new TypeError('Invalid const Map entry');
      const [key, value] = entry;
      if (!isDartType(key, keyType) || !policy.accepts(key) || !isDartType(value, valueType))
        throw new TypeError('Const Map entry has a different source type');
      if (
        DartDouble.is(key) ||
        (typeof key === 'object' && key !== null && !DartInt.is(key) && !identityKeys.has(key))
      )
        throw new TypeError('Const Map key requires source primitive equality');
      return { key, value, identity: [valueKey(key, 'value'), valueKey(value, 'value')] };
    });
  const valuePolicy = Object.freeze({
    accepts: (value: unknown): value is V => isDartType(value, valueType),
    hash: constantValueHash,
    equals: constantValueEquals,
  });
  const candidate = new DartMap(policy, valuePolicy.accepts, valuePolicy);
  for (const pair of pairs) {
    if (candidate.containsKey(pair.key)) throw new TypeError('Duplicate const Map key');
    candidate.set(pair.key, pair.value);
  }
  let root = mapConstants.get(type);
  if (!root) {
    root = branch();
    mapConstants.set(type, root);
  }
  let node: Branch = root;
  for (const key of pairs.flatMap((pair) => pair.identity)) {
    let child: Branch | undefined = node.children.get(key);
    if (!child) {
      child = branch();
      node.children.set(key, child);
    }
    node = child;
  }
  if (node.value) return node.value as DartMap<K, V>;
  mapPolicies.set(keyType, policy);
  captureDartInterface(candidate, type);
  candidate.freeze();
  Object.freeze(candidate);
  constants.add(candidate);
  identityKeys.add(candidate);
  node.value = candidate;
  return candidate;
}

const setPolicies = new WeakMap<object, object>(),
  setConstants = new WeakMap<object, Branch>();
/** Public Set/Iterable witnesses; no claim about the VM's private const class. */
export function dartSetType<T>(elementType: DartTypeWitness<T>): DartTypeWitness<DartSet<T>> {
  return applyDartType(
    DartSet,
    'Set',
    [elementType],
    [applyDartType(DartIterable, 'Iterable', [elementType], [])],
  );
}
/** Plain const Set values have source primitive equality, complete type arguments
 * and observable insertion order. Unknown/fake/floating/custom-equality keys are
 * rejected before interning. Source analyzer rejects duplicate literal elements. */
export function canonicalDartSet<T>(
  elementType: DartTypeWitness<T>,
  policy: DartKeyPolicy<T>,
  elements: readonly T[],
): DartSet<T> {
  if (
    !policy ||
    !Object.isFrozen(policy) ||
    typeof policy.accepts !== 'function' ||
    typeof policy.hash !== 'function' ||
    typeof policy.equals !== 'function' ||
    (policy.validQuery !== undefined && typeof policy.validQuery !== 'function')
  )
    throw new TypeError('Const Set requires a frozen reviewed element policy');
  const previous = setPolicies.get(elementType);
  if (previous && previous !== policy) throw new TypeError('Conflicting const Set element policy');
  const type = dartSetType(elementType),
    values = elements.map((value) => {
      if (!isDartType(value, elementType) || !policy.accepts(value))
        throw new TypeError('Const Set element has a different source type');
      if (
        DartDouble.is(value) ||
        (typeof value === 'object' &&
          value !== null &&
          !DartInt.is(value) &&
          !identityKeys.has(value))
      )
        throw new TypeError('Const Set element requires source primitive equality');
      return { value, identity: valueKey(value, 'value') };
    });
  const candidate = new DartSet(policy);
  for (const value of values)
    if (!candidate.add(value.value)) throw new TypeError('Duplicate const Set element');
  let root = setConstants.get(type);
  if (!root) {
    root = branch();
    setConstants.set(type, root);
  }
  let node: Branch = root;
  for (const value of values) {
    let child: Branch | undefined = node.children.get(value.identity);
    if (!child) {
      child = branch();
      node.children.set(value.identity, child);
    }
    node = child;
  }
  if (node.value) return node.value as DartSet<T>;
  setPolicies.set(elementType, policy);
  captureDartInterface(candidate, type);
  candidate.freeze();
  Object.freeze(candidate);
  constants.add(candidate);
  identityKeys.add(candidate);
  node.value = candidate;
  return candidate;
}
