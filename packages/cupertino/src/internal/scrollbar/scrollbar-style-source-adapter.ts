// SPDX-License-Identifier: BSD-3-Clause
// Staged in packages/cupertino/src beside the complete generated style closure.
import { Color } from "@nelyx/core/ui/color";
import { sourceColorType } from "@nelyx/core/internal/ui/color-source-adapter";
import { Widget, Element, InheritedWidget } from "@nelyx/core/framework/widgets/framework";
import type { BuildContext } from "@nelyx/core/framework/widgets/framework";
import type { Key } from "@nelyx/core/foundation/key";
import { MediaQuery } from "@nelyx/core/framework/widgets/app-data";
import { cupertinoThemeBrightness } from "../theme/theme-brightness.ts";
import type { CupertinoUserInterfaceLevelData } from "../../generated/theme/interface-level.generated.ts";
import type { CupertinoDynamicColor } from "../../generated/colors/dynamic-color.generated.ts";
import { Diagnosticable } from "@nelyx/core/foundation/diagnosticable";
import { DiagnosticsProperty } from "@nelyx/core/foundation/diagnostics";
import type { DiagnosticsPropertyOptions } from "@nelyx/core/foundation/diagnostics";
import { EnumProperty } from "@nelyx/core/foundation/diagnostic-properties";
import { DiagnosticsSerializationDelegate } from "@nelyx/core/foundation/diagnostics-serialization";
import type { JsonDiagnosticsNode } from "@nelyx/core/foundation/diagnostics-serialization";
import { describeDartType, runtimeDartType, dartStringType, dartBoolType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { registerDartValueSemantics, dartValueHash, dartValueString } from "@nelyx/core/internal/foundation/dart-value";
import { hashDoubles } from "@nelyx/core/internal/ui/value-math";
import { FoundationBuildMode } from "@nelyx/core/foundation/constants";
import { shortHash } from "@nelyx/core/foundation/diagnostics-identity";
export type SourceObject = object;
export type SourceStyleList<T> = T[];
export { SourceColorPropertyBase, sourceStyleJsonMap, sourceStyleJsonWrite } from "@nelyx/core/internal/framework/painting/color-property-source-adapter";
export type { SourceJsonMap } from "@nelyx/core/internal/framework/painting/color-property-source-adapter";
export const SourceBrightness = Object.freeze({ light: 'light', dark: 'dark' } as const);
export type SourceBrightness = typeof SourceBrightness[keyof typeof SourceBrightness];
export function sourceStyleBrightness(context: BuildContext): SourceBrightness | null {
    return cupertinoThemeBrightness(context);
}
export function sourceStyleHighContrast(context: BuildContext): boolean | null {
    return MediaQuery.maybeHighContrastOf(context);
}
export abstract class SourceStyleInheritedHost extends InheritedWidget {
    constructor({ key = null, child }: {
        key?: Key | null;
        child: Widget;
    }) {
        super(child, key);
    }
}
export abstract class SourceColorDiagnosticBase extends Diagnosticable(class {
}) {
    abstract equals(other: {}): boolean;
    abstract get hashCode(): number;
    override toStringShort(): string {
        return sourceStyleObjectRuntimeType(this, 'CupertinoDynamicColor') + '#' + shortHash(this);
    }
}
export function sourceStyleIsElement(value: unknown): value is Element {
    return value instanceof Element;
}
export function sourceStyleCastElement(value: unknown): Element {
    if (!sourceStyleIsElement(value))
        throw new TypeError('Expected actual Core Element');
    return value;
}
export function sourceStyleRuntimeType(value: {}): object {
    if (typeof value === 'string')
        return dartStringType;
    if (typeof value === 'boolean')
        return dartBoolType;
    if (Object.getPrototypeOf(value) === Color.prototype)
        return sourceColorType;
    return runtimeDartType(value);
}
export function sourceStyleObjectRuntimeType(value: object, fallback: string): string {
    return FoundationBuildMode.debug ? describeDartType(sourceStyleRuntimeType(value)) : fallback;
}
export function sourceStyleHash(...values: unknown[]): number {
    return hashDoubles(values.map(dartValueHash));
}
export function sourceStyleJoin(values: Iterable<string>, separator: string): string {
    return Array.from(values).join(separator);
}
export function sourceStyleString(value: unknown): string {
    return value instanceof Widget || value instanceof Element ? value.toString() : dartValueString(value);
}
export function sourceStyleElementProperty(name: string, value: Element | null, options: DiagnosticsPropertyOptions<Element> = {}): DiagnosticsProperty<Element> {
    return new DiagnosticsProperty(name, value, { ...options, typeName: 'Element' });
}
class SourceDynamicColorProperty extends DiagnosticsProperty<CupertinoDynamicColor> {
    override toJsonMap(delegate: DiagnosticsSerializationDelegate = new DiagnosticsSerializationDelegate()): JsonDiagnosticsNode {
        const json = super.toJsonMap(delegate);
        if ('type' in json)
            json.type = 'DiagnosticsProperty<CupertinoDynamicColor>';
        return json;
    }
}
export function sourceStyleDynamicColorProperty(name: string, value: CupertinoDynamicColor | null, options: DiagnosticsPropertyOptions<CupertinoDynamicColor> = {}): DiagnosticsProperty<CupertinoDynamicColor> {
    return new SourceDynamicColorProperty(name, value, { ...options, typeName: 'CupertinoDynamicColor' });
}
export function sourceStyleEnumProperty(name: string, value: CupertinoUserInterfaceLevelData | null): EnumProperty<CupertinoUserInterfaceLevelData> {
    return new EnumProperty(name, value, { typeName: 'CupertinoUserInterfaceLevelData' });
}
type SourceColorValue = Color & {
    equals(other: {}): boolean;
};
export function registerSourceStyleColors(owner: Function & {
    prototype: SourceColorValue;
}): void {
    registerDartValueSemantics(owner, {
        accepts: (value: unknown): value is SourceColorValue => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === owner.prototype, equals: (value, other) => value.equals(other), hash: value => value.hashCode, string: value => value.toString()
    });
}
