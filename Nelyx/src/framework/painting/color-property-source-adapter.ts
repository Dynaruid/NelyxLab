// SPDX-License-Identifier: BSD-3-Clause
// Core diagnostics Map/JSON representation boundary for the full ColorProperty.
import type { Color } from '../../ui/color.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticsPropertyOptions } from '../../foundation/diagnostics.ts';
import { DiagnosticsSerializationDelegate } from '../../foundation/diagnostics-serialization.ts';
import type { JsonDiagnosticsNode } from '../../foundation/diagnostics-serialization.ts';
import { DartMap } from '../../foundation/dart-collections.ts';
import { DartInt, DartDouble } from '../../foundation/dart-numeric.ts';
export type SourceJsonMap<K, V> = DartMap<K, V>;
const strings = Object.freeze({
  accepts: (value: unknown): value is string => typeof value === 'string',
  hash: (value: unknown) => value,
  equals: (value: string, other: unknown) => value === other,
});
export function sourceStyleJsonMap(): SourceJsonMap<string, {}> {
  return new DartMap(strings, (value): value is {} => value !== null && value !== undefined);
}
export function sourceStyleJsonWrite(
  map: SourceJsonMap<string, {} | null>,
  key: string,
  value: {} | null,
): void {
  map.set(key, value);
}
function fromJson(value: unknown): {} | null {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    DartInt.is(value) ||
    DartDouble.is(value)
  )
    return value;
  // A host number has no source int/double provenance. Delegates may explicitly
  // return DartInt/DartDouble; never infer kind from an integral-looking value.
  if (typeof value === 'number')
    throw new TypeError('Diagnostic JSON number requires explicit Dart numeric provenance');
  if (Array.isArray(value)) return value.map(fromJson);
  if (
    value !== null &&
    typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  ) {
    const map = new DartMap(strings, (v): v is {} | null => v !== undefined);
    for (const [key, item] of Object.entries(value)) map.set(key, fromJson(item));
    return map;
  }
  throw new TypeError('Unreviewed diagnostic JSON value');
}
function toJson(value: unknown): unknown {
  if (DartInt.is(value) || DartDouble.is(value)) return value.value;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(toJson);
  if (DartMap.is(value)) {
    const result: JsonDiagnosticsNode = {};
    for (const entry of value.entries) {
      if (typeof entry.key !== 'string')
        throw new TypeError('Diagnostic JSON requires string keys');
      Object.defineProperty(result, entry.key, {
        value: toJson(entry.value),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return result;
  }
  throw new TypeError('Unrepresented source diagnostic JSON value');
}
/** The generated source method keeps its Map ABI. Core diagnostic consumers use
 * toJsonMap, which dispatches through that original method then converts once. */
export class SourceColorPropertyBase<T extends Color> extends DiagnosticsProperty<T> {
  constructor(name: string, value: T | null, options: DiagnosticsPropertyOptions<T> = {}) {
    super(name, value, { ...options, typeName: 'Color' });
  }
  toSourceJsonMap(delegate: DiagnosticsSerializationDelegate): SourceJsonMap<string, {} | null> {
    const value = fromJson(super.toJsonMap(delegate));
    if (!DartMap.is(value)) throw new TypeError('Expected diagnostic map');
    return value as SourceJsonMap<string, {} | null>;
  }
  override toJsonMap(
    delegate: DiagnosticsSerializationDelegate = new DiagnosticsSerializationDelegate(),
  ): JsonDiagnosticsNode {
    return toJson(this.toSourceJsonMap(delegate)) as JsonDiagnosticsNode;
  }
}
