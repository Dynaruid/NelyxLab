// SPDX-License-Identifier: BSD-3-Clause
// Runtime keys for erased generic theme values reuse canonical class identity or Core witnesses.
import {describeDartType, isDartType, dartTypeIdentity, isDartTypeIdentitySubtype} from '@nelyx/core/foundation/dart-type-witness';
import type {DartTypeWitness} from '@nelyx/core/foundation/dart-type-witness';

export type ThemeType<T> = (abstract new (...arguments_: never[]) => T) | DartTypeWitness<T>;
const reifiedTypes = new WeakMap<object, object>();

export function themeTypeKey(type: object): object {
    validateThemeType(type);
    return typeof type === 'function' ? type : dartTypeIdentity(type as DartTypeWitness<unknown>);
}

/** Generic T is independent of a subclass's overridable public type getter. */
export function bindThemeValueType<T>(value: object, type: ThemeType<T>): void {reifiedTypes.set(value, themeTypeKey(type));}
export function themeValueHasType<T>(value: object, type: ThemeType<T>): boolean {
    const actual = reifiedTypes.get(value), expected = themeTypeKey(type);
    return actual !== undefined && isDartTypeIdentitySubtype(actual, expected);
}

export function validateThemeType(type: object): void {
    if (typeof type === 'function' && type.prototype) return;
    describeDartType(type);
}

export function requireThemeValue<T>(value: unknown, type: ThemeType<T>): T {
    const valid = typeof type === 'function' ? value instanceof type : isDartType(value, type);
    if (!valid) throw new TypeError('Theme value has a different runtime type than its registered key');
    return value as T;
}

/** A real read-only Map facade; freezing a native Map would still permit set/delete/clear. */
export class ReadonlyThemeMap<K, V> implements ReadonlyMap<K, V> {
    private readonly data: Map<K, V>;
    constructor(entries: Iterable<readonly [K, V]>) {this.data = new Map(entries); Object.freeze(this);}
    get size(): number {return this.data.size;}
    get(key: K): V | undefined {return this.data.get(key);}
    has(key: K): boolean {return this.data.has(key);}
    entries(): MapIterator<[K, V]> {return this.data.entries();}
    keys(): MapIterator<K> {return this.data.keys();}
    values(): MapIterator<V> {return this.data.values();}
    forEach(callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown): void {
        this.data.forEach((value, key) => callback.call(thisArg, value, key, this));
    }
    [Symbol.iterator](): MapIterator<[K, V]> {return this.entries();}
    get [Symbol.toStringTag](): string {return 'Map';}
}
