// SPDX-License-Identifier: BSD-3-Clause
// Staged beside the complete Material scrollbar theme producer.
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticsPropertyOptions, DiagnosticsStringOptions } from "@nelyx/core/foundation/diagnostics";
import { DiagnosticsSerializationDelegate } from "@nelyx/core/foundation/diagnostics-serialization";
import type { JsonDiagnosticsNode } from "@nelyx/core/foundation/diagnostics-serialization";
import { DartDouble } from "@nelyx/core/internal/foundation/dart-numeric";
import { Radius } from "@nelyx/core/ui/radius";
import type { Color } from "@nelyx/core/ui/color";
import { SourceLerpProperties, SourceWidgetStatePropertyWith } from "@nelyx/core/internal/framework/widgets/widget-state.generated";
import { registerDartValueSemantics, dartIdentityHash, dartValueString } from "@nelyx/core/internal/foundation/dart-value";
import { hasCapturedDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import type { SourceWidgetStateProperty } from "@nelyx/core/internal/framework/widgets/widget-state.generated";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { FoundationBuildMode } from "@nelyx/core/foundation/constants";
import { describeDartType, runtimeDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { shortHash } from "@nelyx/core/foundation/diagnostics-identity";
export abstract class ScrollbarThemeDiagnosticBase extends Diagnosticable(class {
}) {
    abstract equals(other: {}): boolean;
    abstract get hashCode(): number;
    override toStringShort(): string {
        return (FoundationBuildMode.debug ? describeDartType(runtimeDartType(this)) : '<optimized out>') + '#' + shortHash(this);
    }
}
class SourceThemeDiagnostics<T> extends DiagnosticsProperty<T> {
    override valueToString(options: DiagnosticsStringOptions = {}): string {
        const value = this.value;
        return value instanceof SourceLerpProperties || value instanceof SourceWidgetStatePropertyWith ? dartValueString(value) : super.valueToString(options);
    }
    override toJsonMap(delegate: DiagnosticsSerializationDelegate = new DiagnosticsSerializationDelegate()): JsonDiagnosticsNode {
        const json = super.toJsonMap(delegate);
        if ('type' in json)
            json.type = 'DiagnosticsProperty<' + this.propertyType + '>';
        const value = this.value;
        if (DartDouble.is(value))
            json.value = Number.isFinite(value.value) ? value.value : String(value.value);
        return json;
    }
}
export function scrollbarBoolProperty(name: string | null, value: boolean | null, options: DiagnosticsPropertyOptions<boolean> = {}): DiagnosticsProperty<boolean> {
    return new SourceThemeDiagnostics(name, value, { ...options, typeName: 'bool' });
}
export function scrollbarRadiusProperty(name: string | null, value: Radius | null, options: DiagnosticsPropertyOptions<Radius> = {}): DiagnosticsProperty<Radius> {
    return new SourceThemeDiagnostics(name, value, { ...options, typeName: 'Radius' });
}
export function scrollbarDoubleProperty(name: string | null, value: DartDouble | null, options: DiagnosticsPropertyOptions<DartDouble> = {}): DiagnosticsProperty<DartDouble> {
    if (value !== null && !DartDouble.is(value))
        throw new TypeError('Expected source double provenance');
    return new SourceThemeDiagnostics(name, value, { ...options, typeName: 'double' });
}
export function scrollbarStateBoolProperty(name: string | null, value: SourceWidgetStateProperty<boolean | null> | null, options: DiagnosticsPropertyOptions<SourceWidgetStateProperty<boolean | null>> = {}): DiagnosticsProperty<SourceWidgetStateProperty<boolean | null>> {
    return new SourceThemeDiagnostics(name, value, { ...options, typeName: 'WidgetStateProperty<bool?>' });
}
export function scrollbarStateDoubleProperty(name: string | null, value: SourceWidgetStateProperty<DartDouble | null> | null, options: DiagnosticsPropertyOptions<SourceWidgetStateProperty<DartDouble | null>> = {}): DiagnosticsProperty<SourceWidgetStateProperty<DartDouble | null>> {
    return new SourceThemeDiagnostics(name, value, { ...options, typeName: 'WidgetStateProperty<double?>' });
}
export function scrollbarStateColorProperty(name: string | null, value: SourceWidgetStateProperty<Color | null> | null, options: DiagnosticsPropertyOptions<SourceWidgetStateProperty<Color | null>> = {}): DiagnosticsProperty<SourceWidgetStateProperty<Color | null>> {
    return new SourceThemeDiagnostics(name, value, { ...options, typeName: 'WidgetStateProperty<Color?>' });
}
// These two complete source classes override only resolve; Object equality/hash
// remains identity-based. The registry admits only their exact captured owners.
for (const owner of [SourceLerpProperties, SourceWidgetStatePropertyWith]) {
    registerDartValueSemantics(owner, {
        accepts: (value: unknown): value is InstanceType<typeof owner> => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === owner.prototype && hasCapturedDartType(value, owner),
        equals: (value, other) => value === other,
        hash: dartIdentityHash,
        string: value => "Instance of '" + describeDartType(runtimeDartType(value)) + "'",
    });
}
