// SPDX-License-Identifier: BSD-3-Clause
// Finite value adapters for the original generated RangeValues/RangeLabels bodies.
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { runtimeDartType, dartStringType, dartBoolType } from '@nelyx/core/foundation/dart-type-witness';
import { hashDoubles } from '@nelyx/core/internal/ui/value-math';
import { dartValueHash, dartValueString } from '@nelyx/core/internal/foundation/dart-value';
import { boxSourceDartDouble, isDartNumeric } from '@nelyx/core/internal/foundation/dart-numeric';
// These non-generic value classes compare exact runtime constructors, including subclasses.
// Raw erased numeric values are rejected by the common runtime type boundary.
export function sliderValueRuntimeType(value: {}): object {
    if (typeof value === 'string')
        return dartStringType;
    if (typeof value === 'boolean')
        return dartBoolType;
    if (isDartNumeric(value))
        return runtimeDartType(value);
    if (typeof value !== 'object' && typeof value !== 'function')
        throw new TypeError('Erased numeric values require source numeric provenance');
    return Object.getPrototypeOf(value)?.constructor ?? Object;
}
export function sliderValueObjectRuntimeType(value: object, fallback: string): string {
    return FoundationBuildMode.debug ? (Object.getPrototypeOf(value)?.constructor.name ?? fallback) : fallback;
}
export function sliderValueHash(...values: unknown[]): number {
    return hashDoubles(values.map(dartValueHash));
}
export function sliderValueDoubleString(value: number): string {
    return dartValueString(boxSourceDartDouble(value));
}
