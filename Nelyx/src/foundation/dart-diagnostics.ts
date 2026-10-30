// SPDX-License-Identifier: BSD-3-Clause
// Source generic metadata comes from the analyzer's explicit witness, never
// from an enum value's spelling or its JavaScript constructor name.
import { EnumProperty } from './diagnostic-properties.ts';
import type { DiagnosticEnumValue } from './diagnostic-properties.ts';
import type { DiagnosticsPropertyOptions } from './diagnostics.ts';
import { describeDartType } from './dart-type-witness.ts';
import type { DartTypeWitness } from './dart-type-witness.ts';
export function sourceEnumProperty<T extends DiagnosticEnumValue>(
  type: DartTypeWitness<T>,
  name: string,
  value: T | null,
  options: DiagnosticsPropertyOptions<T> = {},
): EnumProperty<T> {
  return new EnumProperty(name, value, { ...options, typeName: describeDartType(type) });
}
