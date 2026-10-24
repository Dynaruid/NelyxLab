// SPDX-License-Identifier: BSD-3-Clause
import {DartInt, DartDouble, isDartNumeric, requireDartNumericProvenance} from './dart-numeric.ts';
import type {DartNumeric} from './dart-numeric.ts';
/** Internal source-generation boundary. A witness describes a reviewed runtime
 * representation; it is never recovered from a JS value's apparent numeric kind. */
declare const witnessType: unique symbol;
export interface DartTypeWitness<T> {
    readonly [witnessType]: (value: T) => T;
}

type Atom = { readonly kind: 'atom'; readonly name: string; readonly test: (value: unknown) => boolean; readonly parents?: readonly object[] };
type Nullable = { readonly kind: 'nullable'; readonly inner: object; readonly name: string };
type Nominal = { readonly kind: 'nominal'; readonly owner: Function; readonly name: string; readonly arguments: readonly object[]; readonly parents: readonly object[] };
type Description = Atom | Nullable | Nominal;
const descriptions = new WeakMap<object, Description>();
const nullableTypes = new WeakMap<object, object>();
const owners = new WeakMap<Function, { name: string; arity: number; applications: { arguments: readonly object[]; witness: object }[] }>();
const instances = new WeakMap<object, Map<Function, object>>();
const interfaceInstances = new WeakMap<object, Map<Function, object>>();

function description(witness: object): Description {
    const result = descriptions.get(witness);
    if (!result) throw new TypeError('Unknown source type witness');
    return result;
}
function create<T>(value: Description): DartTypeWitness<T> {
    const witness = Object.freeze({}) as DartTypeWitness<T>;
    descriptions.set(witness, Object.freeze(value));
    return witness;
}

export const dartStringType = create<string>({ kind: 'atom', name: 'String', test: value => typeof value === 'string' });
export const dartBoolType = create<boolean>({ kind: 'atom', name: 'bool', test: value => typeof value === 'boolean' });
export const dartObjectType = create<{}>({ kind: 'atom', name: 'Object', test: value => value !== null && value !== undefined });
export const dartNullType = create<null>({ kind: 'atom', name: 'Null', test: value => value === null });
// These witnesses describe boxed values in erased slots, not scalar number.
export const dartNumType = create<DartNumeric>({ kind: 'atom', name: 'num', test: value => { requireDartNumericProvenance(value); return isDartNumeric(value); } });
export const dartIntType = create<DartInt>({ kind: 'atom', name: 'int', parents: Object.freeze([dartNumType]), test: value => { requireDartNumericProvenance(value); return DartInt.is(value); } });
export const dartDoubleType = create<DartDouble>({ kind: 'atom', name: 'double', parents: Object.freeze([dartNumType]), test: value => { requireDartNumericProvenance(value); return DartDouble.is(value); } });

export function nullableDartType<T>(witness: DartTypeWitness<T>): DartTypeWitness<T | null> {
    const value = description(witness);
    if (value.kind === 'nullable' || (witness as object) === dartNullType) return witness as DartTypeWitness<T | null>;
    let result = nullableTypes.get(witness);
    if (!result) {
        result = create<T | null>({ kind: 'nullable', inner: witness, name: value.name + '?' });
        nullableTypes.set(witness, result);
    }
    return result as DartTypeWitness<T | null>;
}

/** Exact generated owner token, source display name and analyzer-derived parents.
 * No constructor name, object shape, or value sample participates in classification. */
export function applyDartType<T>(owner: Function, name: string, arguments_: readonly object[], parents: readonly object[]): DartTypeWitness<T> {
    if (typeof owner !== 'function' || !owner.prototype || !name) throw new TypeError('Invalid source type owner');
    arguments_.forEach(description);
    parents.forEach(description);
    let record = owners.get(owner);
    if (!record) {
        record = { name, arity: arguments_.length, applications: [] };
        owners.set(owner, record);
    }
    if (record.name !== name || record.arity !== arguments_.length) throw new TypeError('Conflicting source type owner');
    const cached = record.applications.find(entry => entry.arguments.every((value, index) => value === arguments_[index]));
    if (cached) {
        const value = description(cached.witness) as Nominal;
        if (value.parents.length !== parents.length || value.parents.some((parent, index) => parent !== parents[index])) throw new TypeError('Conflicting source type projections');
        return cached.witness as DartTypeWitness<T>;
    }
    const captured = Object.freeze([...arguments_]);
    const result = create<T>({ kind: 'nominal', owner, name: name + (captured.length ? '<' + captured.map(describeDartType).join(', ') + '>' : ''), arguments: captured, parents: Object.freeze([...parents]) });
    record.applications.push({ arguments: captured, witness: result });
    return result;
}

/** Called once per lexical generated class after super and before its body. */
export function captureDartType(instance: object, witness: object): void {
    const value = description(witness);
    if (value.kind !== 'nominal' || !(instance instanceof value.owner)) throw new TypeError('Source type capture has a different owner');
    let captured = instances.get(instance);
    if (!captured) { captured = new Map(); instances.set(instance, captured); }
    if (captured.has(value.owner)) throw new TypeError('Source class type was already captured');
    captured.set(value.owner, witness);
}

/** Reviewed host interface representation, without claiming a concrete VM
 * implementation runtimeType (for example the private const Map class). */
export function captureDartInterface(instance: object, witness: object): void {
    const value = description(witness);
    if (value.kind !== 'nominal' || !(instance instanceof value.owner)) throw new TypeError('Source interface capture has a different owner');
    let captured = interfaceInstances.get(instance);
    if (!captured) { captured = new Map(); interfaceInstances.set(instance,captured); }
    if (captured.has(value.owner)) throw new TypeError('Source interface type was already captured');
    captured.set(value.owner,witness);
}

export function readDartType<T>(instance: object, owner: Function, index: number): DartTypeWitness<T> {
    const witness = instances.get(instance)?.get(owner);
    const value = witness && description(witness);
    if (!value || value.kind !== 'nominal' || !Number.isSafeInteger(index) || index < 0 || index >= value.arguments.length) throw new TypeError('Source class type was not captured in this scope');
    return value.arguments[index] as DartTypeWitness<T>;
}

/** Admission for an explicitly selected lexical owner, including its subclasses. */
export function hasCapturedDartType(value: unknown, owner: Function): value is object {
    return value !== null && (typeof value === 'object' || typeof value === 'function') && instances.get(value)?.has(owner) === true;
}

/** Exact most-derived source runtime type; an uncaptured external subclass does
 * not acquire its base class's runtimeType by accident. */
export function runtimeDartType(value: object): object {
    if (DartInt.is(value)) return dartIntType;
    if (DartDouble.is(value)) return dartDoubleType;
    const captured = instances.get(value), prototype = Object.getPrototypeOf(value);
    if (captured) for (const [owner, witness] of captured) if (owner.prototype === prototype) return witness;
    throw new TypeError('The concrete source runtime type was not captured');
}

function subtype(actual: object, expected: object): boolean {
    const a = description(actual), e = description(expected);
    if (actual === expected) return true;
    if (e.kind === 'nullable') return actual === dartNullType || subtype(a.kind === 'nullable' ? a.inner : actual, e.inner);
    if (a.kind === 'nullable' || actual === dartNullType) return false;
    if (expected === dartObjectType) return true;
    if (a.kind === 'atom') return a.parents?.some(parent => subtype(parent, expected)) ?? false;
    if (e.kind === 'nominal' && a.owner === e.owner && a.arguments.length === e.arguments.length && a.arguments.every((argument, index) => subtype(argument, e.arguments[index]!))) return true;
    return a.parents.some(parent => subtype(parent, expected));
}

export function isDartType<T>(value: unknown, witness: DartTypeWitness<T>): value is T {
    const type = description(witness);
    if (type.kind === 'atom') return type.test(value);
    if (type.kind === 'nullable') return value === null || isDartType(value, type.inner as DartTypeWitness<T>);
    if (value === null || typeof value !== 'object' && typeof value !== 'function') return false;
    const captured = instances.get(value), interfaces = interfaceInstances.get(value);
    return [...captured?.values() ?? [], ...interfaces?.values() ?? []].some(actual => subtype(actual, witness));
}

export function castDartType<T>(value: unknown, witness: DartTypeWitness<T>): T {
    if (!isDartType(value, witness)) throw new TypeError('Invalid source type cast: ' + describeDartType(witness));
    return value;
}

export function describeDartType(witness: object): string { return description(witness).name; }

/** Canonical Type key for host consumers of source literals. Non-generic nominal
 * witnesses and their exact class owner denote the same type; instantiated,
 * nullable and primitive witnesses retain their own identity and provenance. */
export function dartTypeIdentity<T>(witness: DartTypeWitness<T>): object {
    const type = description(witness);
    return type.kind === 'nominal' && type.arguments.length === 0 ? type.owner : witness;
}

/** Covariance between canonical Type keys. Registered generic/interface projections
 * use the source graph; ordinary host classes use their actual prototype ancestry. */
export function isDartTypeIdentitySubtype(actual: object, expected: object): boolean {
    const witness = (key: object): object | null => {
        if (typeof key !== 'function') {description(key); return key;}
        if (!key.prototype) throw new TypeError('Invalid class type identity');
        return owners.get(key)?.applications.find(value => value.arguments.length === 0)?.witness ?? null;
    };
    const a = witness(actual), e = witness(expected);
    if (actual === expected) return true;
    if (a !== null && e !== null) return subtype(a, e);
    const inherits = (child: Function, parent: Function) => child === parent || Object.prototype.isPrototypeOf.call(parent.prototype, child.prototype);
    if (typeof actual === 'function' && typeof expected === 'function') return inherits(actual, expected);
    if (typeof actual === 'function' && e !== null) {
        const target = description(e);
        if (target.kind === 'nullable') return isDartTypeIdentitySubtype(actual, target.inner);
        if (expected === dartObjectType) return true;
        return target.kind === 'nominal' && target.arguments.length === 0 && inherits(actual, target.owner);
    }
    if (a !== null && typeof expected === 'function') {
        const source = description(a);
        return source.kind === 'nominal' && inherits(source.owner, expected);
    }
    return false;
}
