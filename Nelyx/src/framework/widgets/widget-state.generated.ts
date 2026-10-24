// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/widget_state.dart; SHA256 5caa69ece300d67a1984df9cb1ea7456fce7b30dc339c0a804540443242e916a
import { protect } from "../../ui/value-math.ts";
import { checkedInteger } from "../../ui/value-math.ts";
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { invariant } from "../../foundation/errors.ts";
import { DartSet } from "../../foundation/dart-collections.ts";
import { DartMap } from "../../foundation/dart-collections.ts";
import { DartIterable } from "../../foundation/dart-collections.ts";
import { ValueNotifier } from "../../foundation/notifier.ts";
import { widgetStateConstEmpty } from "./widget-state-constraint-source-adapter.ts";
import { registerWidgetStateConstraints } from "./widget-state-constraint-source-adapter.ts";
import { dartStringType } from "../../foundation/dart-type-witness.ts";
import { dartBoolType } from "../../foundation/dart-type-witness.ts";
import { dartObjectType } from "../../foundation/dart-type-witness.ts";
import { dartNullType } from "../../foundation/dart-type-witness.ts";
import { nullableDartType } from "../../foundation/dart-type-witness.ts";
import { applyDartType } from "../../foundation/dart-type-witness.ts";
import { captureDartType } from "../../foundation/dart-type-witness.ts";
import { readDartType } from "../../foundation/dart-type-witness.ts";
import { isDartType } from "../../foundation/dart-type-witness.ts";
import { castDartType } from "../../foundation/dart-type-witness.ts";
import { describeDartType } from "../../foundation/dart-type-witness.ts";
import { dartValueEquals } from "../../foundation/dart-value.ts";
import { dartValueHash } from "../../foundation/dart-value.ts";
import { dartValueHashPair } from "../../foundation/dart-value.ts";
import { runtimeDartType } from "../../foundation/dart-type-witness.ts";
import { registerWidgetStateValueSemantics } from "./widget-state-value-source-adapter.ts";
import { widgetStateConstraintString } from "./widget-state-constraint-source-adapter.ts";
import { WidgetStateDiagnosticableBase } from "./widget-state-diagnostic-source-adapter.ts";
import { widgetStateDiagnosticableType } from "./widget-state-diagnostic-source-adapter.ts";
import { captureDartException } from "../../foundation/dart-exceptions.ts";
import { isWidgetStateTypeError } from "./widget-state-diagnostic-source-adapter.ts";
import { castWidgetStateTypeError } from "./widget-state-diagnostic-source-adapter.ts";
import { WidgetStateArgumentError } from "./widget-state-diagnostic-source-adapter.ts";
import { widgetStateSetString } from "./widget-state-map-source-adapter.ts";
import { createWidgetStateMapHash } from "./widget-state-map-source-adapter.ts";
import { dartMapEquals } from "../../foundation/dart-map-equality.ts";
import { widgetStateMapString } from "./widget-state-map-source-adapter.ts";
import { createWidgetStateMapDiagnostics } from "./widget-state-map-source-adapter.ts";
import { dartValueString } from "../../foundation/dart-value.ts";
import { DartSymbol } from "../../foundation/dart-symbol.ts";
import { dartSymbolString } from "../../foundation/dart-symbol.ts";
import { WidgetStateInvocation } from "./widget-state-diagnostic-source-adapter.ts";
import { widgetStateInvocationMemberName } from "./widget-state-diagnostic-source-adapter.ts";
import { FlutterError } from "../../foundation/flutter-error.ts";
import { ErrorSummary } from "../../foundation/diagnostics.ts";
import { ErrorDescription } from "../../foundation/diagnostics.ts";
import { ErrorHint } from "../../foundation/diagnostics.ts";
import { DiagnosticPropertiesBuilder } from "../../foundation/diagnostics.ts";
import { DiagnosticsProperty } from "../../foundation/diagnostics.ts";
import { isSourceDartDouble } from "../../foundation/dart-numeric.ts";
import { castSourceDartDouble } from "../../foundation/dart-numeric.ts";
import { debugFormatDouble } from "../../foundation/debug.ts";
import { emptyWidgetStateSet } from "./widget-state-full-collections.ts";
import { boxSourceDartInt } from "../../foundation/dart-numeric.ts";
import { boxSourceDartDouble } from "../../foundation/dart-numeric.ts";
import { castSourceDartInt } from "../../foundation/dart-numeric.ts";
import { dartIntType } from "../../foundation/dart-type-witness.ts";
import { dartDoubleType } from "../../foundation/dart-type-witness.ts";
import { dartNumType } from "../../foundation/dart-type-witness.ts";
import { canonicalDartObject } from "../../foundation/dart-const.ts";
import { dartValueIdentical } from "../../foundation/dart-identity.ts";
import { bridgeDartFunction } from "../../foundation/dart-function.ts";
import { unwrapSourceDartNum } from "../../foundation/dart-numeric.ts";
import { lerpDouble } from "../../ui/lerp-double.generated.ts";
import type { DartMapEntry } from "../../foundation/dart-collections.ts";
import type { Diagnosticable } from "../../foundation/diagnostics.ts";
import type { DartTypeWitness } from "../../foundation/dart-type-witness.ts";
import type { WidgetStateTypeError } from "./widget-state-diagnostic-source-adapter.ts";
import type { DiagnosticLevel } from "../../foundation/diagnostics.ts";
import type { DiagnosticsNode } from "../../foundation/diagnostics.ts";
import type { DartNumeric } from "../../foundation/dart-numeric.ts";
import type { DartInt } from "../../foundation/dart-numeric.ts";
import type { DartDouble } from "../../foundation/dart-numeric.ts";
export abstract class SourceWidgetStatesConstraint {
    constructor() {
    }
    abstract isSatisfiedBy(states: DartSet<SourceWidgetState>): boolean;
    and(other: SourceWidgetStatesConstraint): SourceWidgetStatesConstraint {
        return new SourceWidgetStateAnd(this, other);
    }
    or(other: SourceWidgetStatesConstraint): SourceWidgetStatesConstraint {
        return new SourceWidgetStateOr(this, other);
    }
    not(): SourceWidgetStatesConstraint {
        return new SourceWidgetStateNot(this);
    }
}
export class SourceAnyWidgetStates extends SourceWidgetStatesConstraint {
    constructor() {
        super();
    }
    override isSatisfiedBy(states: DartSet<SourceWidgetState>): boolean {
        return true;
    }
    override toString(): string {
        return "WidgetState.any";
    }
}
const _dartTemporary0 = Symbol();
export class SourceWidgetState extends SourceWidgetStatesConstraint {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly index: number;
    private readonly _dartTemporary1!: void;
    /**
     * @dartParam index int
     * @dartParamOrigin index explicit
     */
    private constructor(index: number, readonly name: string, token: typeof _dartTemporary0) {
        if (token !== _dartTemporary0)
            throw new TypeError("Enum values cannot be constructed");
        super();
        this.index = index;
        Object.freeze(this);
    }
    static readonly hovered: SourceWidgetState = new SourceWidgetState(0, "hovered", _dartTemporary0);
    static readonly focused: SourceWidgetState = new SourceWidgetState(1, "focused", _dartTemporary0);
    static readonly pressed: SourceWidgetState = new SourceWidgetState(2, "pressed", _dartTemporary0);
    static readonly dragged: SourceWidgetState = new SourceWidgetState(3, "dragged", _dartTemporary0);
    static readonly selected: SourceWidgetState = new SourceWidgetState(4, "selected", _dartTemporary0);
    static readonly scrolledUnder: SourceWidgetState = new SourceWidgetState(5, "scrolledUnder", _dartTemporary0);
    static readonly disabled: SourceWidgetState = new SourceWidgetState(6, "disabled", _dartTemporary0);
    static readonly error: SourceWidgetState = new SourceWidgetState(7, "error", _dartTemporary0);
    static readonly values: ReadonlyArray<SourceWidgetState> = Object.freeze([SourceWidgetState.hovered, SourceWidgetState.focused, SourceWidgetState.pressed, SourceWidgetState.dragged, SourceWidgetState.selected, SourceWidgetState.scrolledUnder, SourceWidgetState.disabled, SourceWidgetState.error]);
    toString(): string {
        return "WidgetState." + this.name;
    }
    static readonly any: SourceWidgetStatesConstraint = widgetStateConstEmpty(SourceAnyWidgetStates);
    isSatisfiedBy(states: DartSet<SourceWidgetState>): boolean {
        return states.contains(this);
    }
}
protect(SourceWidgetState, ["any"]);
Object.freeze(SourceWidgetState.prototype);
Object.freeze(SourceWidgetState);
export abstract class SourceWidgetStateCombo extends SourceWidgetStatesConstraint {
    readonly first: SourceWidgetStatesConstraint;
    readonly second: SourceWidgetStatesConstraint;
    constructor(first: SourceWidgetStatesConstraint, second: SourceWidgetStatesConstraint) {
        const _initialField0 = first;
        const _initialField1 = second;
        super();
        this.first = _initialField0;
        this.second = _initialField1;
        protect(this, ["first", "second"]);
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    get hashCode(): number {
        return checkedInteger(dartValueHashPair(this.first, this.second));
    }
}
export class SourceWidgetStateAnd extends SourceWidgetStateCombo {
    constructor(first: SourceWidgetStatesConstraint, second: SourceWidgetStatesConstraint) {
        super(first, second);
    }
    isSatisfiedBy(states: DartSet<SourceWidgetState>): boolean {
        return this.first.isSatisfiedBy(states) && this.second.isSatisfiedBy(states);
    }
    equals(other: {}): boolean {
        return other instanceof SourceWidgetStateAnd && dartValueEquals((other as SourceWidgetStateAnd).first, this.first) && dartValueEquals((other as SourceWidgetStateAnd).second, this.second);
    }
    override toString(): string {
        return `(${widgetStateConstraintString(this.first)} & ${widgetStateConstraintString(this.second)})`;
    }
}
export class SourceWidgetStateOr extends SourceWidgetStateCombo {
    constructor(first: SourceWidgetStatesConstraint, second: SourceWidgetStatesConstraint) {
        super(first, second);
    }
    isSatisfiedBy(states: DartSet<SourceWidgetState>): boolean {
        return this.first.isSatisfiedBy(states) || this.second.isSatisfiedBy(states);
    }
    equals(other: {}): boolean {
        return other instanceof SourceWidgetStateOr && dartValueEquals((other as SourceWidgetStateOr).first, this.first) && dartValueEquals((other as SourceWidgetStateOr).second, this.second);
    }
    override toString(): string {
        return `(${widgetStateConstraintString(this.first)} | ${widgetStateConstraintString(this.second)})`;
    }
}
export class SourceWidgetStateNot extends SourceWidgetStatesConstraint {
    readonly value: SourceWidgetStatesConstraint;
    constructor(value: SourceWidgetStatesConstraint) {
        const _initialField0 = value;
        super();
        this.value = _initialField0;
        protect(this, ["value"]);
    }
    override isSatisfiedBy(states: DartSet<SourceWidgetState>): boolean {
        return !this.value.isSatisfiedBy(states);
    }
    equals(other: {}): boolean {
        return other instanceof SourceWidgetStateNot && dartValueEquals((other as SourceWidgetStateNot).value, this.value);
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    get hashCode(): number {
        return checkedInteger(dartValueHash(this.value));
    }
    override toString(): string {
        return `~${widgetStateConstraintString(this.value)}`;
    }
}
export abstract class SourceWidgetStateProperty<T extends {} | null> {
    constructor(_dartTemporary2: DartTypeWitness<T>) {
        captureDartType(this, applyDartType<SourceWidgetStateProperty<T>>(SourceWidgetStateProperty, "WidgetStateProperty", [_dartTemporary2], []));
    }
    static resolveAs<_dartTemporary3 extends {} | null>(_dartTemporary4: DartTypeWitness<_dartTemporary3>, value: _dartTemporary3, states: DartSet<SourceWidgetState>): _dartTemporary3 {
        castDartType<_dartTemporary3>(value, _dartTemporary4);
        if (isDartType<SourceWidgetStateProperty<_dartTemporary3>>(value, applyDartType<SourceWidgetStateProperty<_dartTemporary3>>(SourceWidgetStateProperty, "WidgetStateProperty", [_dartTemporary4], []))) {
            const property: SourceWidgetStateProperty<_dartTemporary3> = value as _dartTemporary3 & SourceWidgetStateProperty<_dartTemporary3>;
            return property.resolve(states);
        }
        return value;
    }
    static resolveWith<_dartTemporary5 extends {} | null>(_dartTemporary6: DartTypeWitness<_dartTemporary5>, callback: (argument0: DartSet<SourceWidgetState>) => _dartTemporary5): SourceWidgetStateProperty<_dartTemporary5> {
        return new SourceWidgetStatePropertyWith<_dartTemporary5>(_dartTemporary6, callback);
    }
    static all<_dartTemporary7 extends {} | null>(_dartTemporary8: DartTypeWitness<_dartTemporary7>, value: _dartTemporary7): SourceWidgetStateProperty<_dartTemporary7> {
        castDartType<_dartTemporary7>(value, _dartTemporary8);
        return new SourceWidgetStatePropertyAll<_dartTemporary7>(_dartTemporary8, value);
    }
    /**
     * @dartParam t double
     * @dartParamOrigin t explicit
     * @dartParam lerpFunction T? Function(T?, T?, double)
     * @dartParamOrigin lerpFunction explicit
     */
    static lerp<_dartTemporary9 extends {} | null>(_dartTemporary10: DartTypeWitness<_dartTemporary9>, a: SourceWidgetStateProperty<_dartTemporary9> | null, b: SourceWidgetStateProperty<_dartTemporary9> | null, t: number, lerpFunction: (argument0: _dartTemporary9 | null, argument1: _dartTemporary9 | null, argument2: number) => _dartTemporary9 | null): SourceWidgetStateProperty<_dartTemporary9 | null> | null {
        if (a === null && b === null) {
            return null;
        }
        return new SourceLerpProperties<_dartTemporary9>(_dartTemporary10, a, b, t, lerpFunction);
    }
    abstract resolve(states: DartSet<SourceWidgetState>): T;
    static fromMap<T extends {} | null>(_dartTemporary11: DartTypeWitness<T>, map: DartMap<SourceWidgetStatesConstraint, T>): SourceWidgetStateProperty<T> {
        return new SourceWidgetStateMapper<T>(_dartTemporary11, map);
    }
}
export function sourceConstWidgetStatePropertyFromMap<T extends {} | null>(_dartTemporary2: DartTypeWitness<T>, map: DartMap<SourceWidgetStatesConstraint, T>): SourceWidgetStateProperty<T> {
    return canonicalDartObject<SourceWidgetStateMapper<T>>(SourceWidgetStateMapper, applyDartType<SourceWidgetStateMapper<T>>(SourceWidgetStateMapper, "WidgetStateMapper", [_dartTemporary2], [applyDartType<SourceWidgetStateProperty<T>>(SourceWidgetStateProperty, "WidgetStateProperty", [_dartTemporary2], []), widgetStateDiagnosticableType]), [["_dart_f96d571b4118dbc5_map", "value"]], () => new SourceWidgetStateMapper<T>(_dartTemporary2, map), false);
}
export class SourceLerpProperties<T extends {} | null> implements SourceWidgetStateProperty<T | null> {
    readonly a: SourceWidgetStateProperty<T> | null;
    readonly b: SourceWidgetStateProperty<T> | null;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly t: number;
    /**
     * @dartType T? Function(T?, T?, double)
     * @dartTypeOrigin explicit
     */
    readonly lerpFunction: (argument0: T | null, argument1: T | null, argument2: number) => T | null;
    /**
     * @dartParam t double
     * @dartParamOrigin t inferred
     * @dartParam lerpFunction T? Function(T?, T?, double)
     * @dartParamOrigin lerpFunction inferred
     */
    constructor(_dartTemporary12: DartTypeWitness<T>, a: SourceWidgetStateProperty<T> | null, b: SourceWidgetStateProperty<T> | null, t: number, lerpFunction: (argument0: T | null, argument1: T | null, argument2: number) => T | null) {
        const _initialField0 = a;
        const _initialField1 = b;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField2 = t;
        /**
         * @dartType T? Function(T?, T?, double)
         * @dartTypeOrigin inferred
         */
        const _initialField3 = lerpFunction;
        captureDartType(this, applyDartType<SourceLerpProperties<T>>(SourceLerpProperties, "_LerpProperties", [_dartTemporary12], [applyDartType<SourceWidgetStateProperty<T | null>>(SourceWidgetStateProperty, "WidgetStateProperty", [nullableDartType<T>(_dartTemporary12)], [])]));
        this.a = _initialField0;
        this.b = _initialField1;
        this.t = _initialField2;
        this.lerpFunction = _initialField3;
        protect(this, ["a", "b", "t", "lerpFunction"]);
    }
    resolve(states: DartSet<SourceWidgetState>): T | null {
        const resolvedA: T | null = (this.a?.resolve(states) ?? null);
        const resolvedB: T | null = (this.b?.resolve(states) ?? null);
        return this.lerpFunction(resolvedA, resolvedB, this.t);
    }
}
export class SourceWidgetStatePropertyWith<T extends {} | null> implements SourceWidgetStateProperty<T> {
    readonly _dart_f96d571b4118dbc5_resolve: (argument0: DartSet<SourceWidgetState>) => T;
    constructor(_dartTemporary13: DartTypeWitness<T>, _resolve: (argument0: DartSet<SourceWidgetState>) => T) {
        const _initialField0 = _resolve;
        captureDartType(this, applyDartType<SourceWidgetStatePropertyWith<T>>(SourceWidgetStatePropertyWith, "_WidgetStatePropertyWith", [_dartTemporary13], [applyDartType<SourceWidgetStateProperty<T>>(SourceWidgetStateProperty, "WidgetStateProperty", [_dartTemporary13], [])]));
        this._dart_f96d571b4118dbc5_resolve = _initialField0;
        protect(this, ["_dart_f96d571b4118dbc5_resolve"]);
    }
    resolve(states: DartSet<SourceWidgetState>): T {
        return this._dart_f96d571b4118dbc5_resolve(states);
    }
}
export class SourceWidgetStateMapper<T extends {} | null> extends WidgetStateDiagnosticableBase implements SourceWidgetStateProperty<T> {
    readonly _dart_f96d571b4118dbc5_map: DartMap<SourceWidgetStatesConstraint, T>;
    constructor(_dartTemporary14: DartTypeWitness<T>, map: DartMap<SourceWidgetStatesConstraint, T>) {
        const _initialField0 = map;
        super();
        captureDartType(this, applyDartType<SourceWidgetStateMapper<T>>(SourceWidgetStateMapper, "WidgetStateMapper", [_dartTemporary14], [applyDartType<SourceWidgetStateProperty<T>>(SourceWidgetStateProperty, "WidgetStateProperty", [_dartTemporary14], []), widgetStateDiagnosticableType]));
        this._dart_f96d571b4118dbc5_map = _initialField0;
        protect(this, ["_dart_f96d571b4118dbc5_map"]);
    }
    resolve(states: DartSet<SourceWidgetState>): T {
        for (const _dartTemporary15 of this._dart_f96d571b4118dbc5_map.entries) {
            const entry: DartMapEntry<SourceWidgetStatesConstraint, T> = _dartTemporary15;
            {
                if (entry.key.isSatisfiedBy(states)) {
                    return entry.value;
                }
            }
        }
        try {
            return castDartType<T>(null, readDartType<T>(this, SourceWidgetStateMapper, 0));
        }
        catch (_dartTemporary16) {
            const _dartTemporary17 = captureDartException(_dartTemporary16);
            if (isWidgetStateTypeError(_dartTemporary17.exception)) {
                (() => {
                    const _dartTemporary18 = new WidgetStateArgumentError(`The current set of widget states is ${widgetStateSetString(states)}.
None of the provided map keys matched this set, and the type "${describeDartType(readDartType<T>(this, SourceWidgetStateMapper, 0))}" is non-nullable.
Consider using "WidgetStateMapper<${describeDartType(readDartType<T>(this, SourceWidgetStateMapper, 0))}?>()", or adding the "WidgetState.any" key to this map.`);
                    throw _dartTemporary18;
                })();
            }
            else
                throw _dartTemporary17.exception;
        }
    }
    override equals(other: {}): boolean {
        return isDartType<SourceWidgetStateMapper<T>>(other, applyDartType<SourceWidgetStateMapper<T>>(SourceWidgetStateMapper, "WidgetStateMapper", [readDartType<T>(this, SourceWidgetStateMapper, 0)], [applyDartType<SourceWidgetStateProperty<T>>(SourceWidgetStateProperty, "WidgetStateProperty", [readDartType<T>(this, SourceWidgetStateMapper, 0)], []), widgetStateDiagnosticableType])) && dartMapEquals(this._dart_f96d571b4118dbc5_map, (other as SourceWidgetStateMapper<T>)._dart_f96d571b4118dbc5_map);
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    override get hashCode(): number {
        return checkedInteger(createWidgetStateMapHash<T>(readDartType<T>(this, SourceWidgetStateMapper, 0)).hash(this._dart_f96d571b4118dbc5_map));
    }
    override toString({ minLevel = "info" }: {
        readonly minLevel?: DiagnosticLevel;
    } = {}): string {
        return `WidgetStateMapper<${describeDartType(readDartType<T>(this, SourceWidgetStateMapper, 0))}>(${widgetStateMapString(this._dart_f96d571b4118dbc5_map)})`;
    }
    override noSuchMethod(invocation: WidgetStateInvocation): never {
        (() => {
            const _dartTemporary19 = FlutterError.fromParts([new ErrorSummary(`There was an attempt to access the "${dartSymbolString(widgetStateInvocationMemberName(invocation))}" field of a WidgetStateMapper<${describeDartType(readDartType<T>(this, SourceWidgetStateMapper, 0))}> object.`), new ErrorDescription(`${dartValueString(this)}`), new ErrorDescription("WidgetStateProperty objects should only be used in places that document their support."), new ErrorHint("Double-check whether the map was used in a place that documents support for WidgetStateProperty objects. If so, please file a bug report. (The https://pub.dev/ page for a package contains a link to \"View/report issues\".)")]);
            throw _dartTemporary19;
        })();
    }
    override debugFillProperties(properties: DiagnosticPropertiesBuilder, { prefix = "" }: {
        readonly prefix?: string;
    } = {}): void {
        super.debugFillProperties(properties);
        properties.add(createWidgetStateMapDiagnostics<SourceWidgetStatesConstraint, T>(readDartType<T>(this, SourceWidgetStateMapper, 0), "map", this._dart_f96d571b4118dbc5_map));
    }
}
export function sourceConstWidgetStateMapper<T extends {} | null>(_dartTemporary14: DartTypeWitness<T>, map: DartMap<SourceWidgetStatesConstraint, T>): SourceWidgetStateMapper<T> {
    return canonicalDartObject<SourceWidgetStateMapper<T>>(SourceWidgetStateMapper, applyDartType<SourceWidgetStateMapper<T>>(SourceWidgetStateMapper, "WidgetStateMapper", [_dartTemporary14], [applyDartType<SourceWidgetStateProperty<T>>(SourceWidgetStateProperty, "WidgetStateProperty", [_dartTemporary14], []), widgetStateDiagnosticableType]), [["_dart_f96d571b4118dbc5_map", "value"]], () => new SourceWidgetStateMapper<T>(_dartTemporary14, map), false);
}
export class SourceWidgetStatePropertyAll<T extends {} | null> implements SourceWidgetStateProperty<T> {
    readonly value: T;
    constructor(_dartTemporary20: DartTypeWitness<T>, value: T) {
        castDartType<T>(value, _dartTemporary20);
        const _initialField0 = value;
        captureDartType(this, applyDartType<SourceWidgetStatePropertyAll<T>>(SourceWidgetStatePropertyAll, "WidgetStatePropertyAll", [_dartTemporary20], [applyDartType<SourceWidgetStateProperty<T>>(SourceWidgetStateProperty, "WidgetStateProperty", [_dartTemporary20], [])]));
        this.value = _initialField0;
        protect(this, ["value"]);
    }
    resolve(states: DartSet<SourceWidgetState>): T {
        return this.value;
    }
    toString(): string {
        if (isSourceDartDouble(this.value)) {
            return `WidgetStatePropertyAll(${debugFormatDouble(castSourceDartDouble(this.value))})`;
        }
        else {
            return `WidgetStatePropertyAll(${dartValueString(this.value)})`;
        }
    }
    equals(other: {}): boolean {
        return isDartType<SourceWidgetStatePropertyAll<T>>(other, applyDartType<SourceWidgetStatePropertyAll<T>>(SourceWidgetStatePropertyAll, "WidgetStatePropertyAll", [readDartType<T>(this, SourceWidgetStatePropertyAll, 0)], [applyDartType<SourceWidgetStateProperty<T>>(SourceWidgetStateProperty, "WidgetStateProperty", [readDartType<T>(this, SourceWidgetStatePropertyAll, 0)], [])])) && runtimeDartType(other as SourceWidgetStatePropertyAll<T>) === runtimeDartType(this) && dartValueEquals((other as SourceWidgetStatePropertyAll<T>).value, this.value);
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    get hashCode(): number {
        return checkedInteger(dartValueHash(this.value));
    }
}
export function sourceConstWidgetStatePropertyAll<T extends {} | null>(_dartTemporary20: DartTypeWitness<T>, value: T): SourceWidgetStatePropertyAll<T> {
    return canonicalDartObject<SourceWidgetStatePropertyAll<T>>(SourceWidgetStatePropertyAll, applyDartType<SourceWidgetStatePropertyAll<T>>(SourceWidgetStatePropertyAll, "WidgetStatePropertyAll", [_dartTemporary20], [applyDartType<SourceWidgetStateProperty<T>>(SourceWidgetStateProperty, "WidgetStateProperty", [_dartTemporary20], [])]), [["value", "value"]], () => new SourceWidgetStatePropertyAll<T>(_dartTemporary20, value), false);
}
export class SourceWidgetStatesController extends ValueNotifier<DartSet<SourceWidgetState>> {
    constructor(value: DartSet<SourceWidgetState> | null = null) {
        super((() => {
            const _dartTemporary21 = emptyWidgetStateSet();
            {
                const _dartTemporary22 = value;
                if (_dartTemporary22 !== null)
                    for (const _dartTemporary23 of _dartTemporary22)
                        _dartTemporary21.add(_dartTemporary23);
            }
            return _dartTemporary21;
        })());
    }
    update(state: SourceWidgetState, add: boolean): void {
        const valueChanged: boolean = add ? this.value.add(state) : this.value.remove(state);
        if (valueChanged) {
            this.notifyListeners();
        }
    }
}

// Composed manual declarations: tools/Nelyx.FrameworkToTypeScript/data/work8/inputs/widget-state-constraint-registration.ts
// SPDX-License-Identifier: BSD-3-Clause
// Nominal tokens of these exact generated declarations; no constraint algorithms.
const _widgetStateConstraintRegistration = registerWidgetStateConstraints({
  base: SourceWidgetStatesConstraint,
  state: SourceWidgetState,
  and: SourceWidgetStateAnd,
  or: SourceWidgetStateOr,
  not: SourceWidgetStateNot,
  any: SourceAnyWidgetStates,
});

// Composed manual declarations: tools/Nelyx.FrameworkToTypeScript/data/work8/inputs/widget-state-value-registration.ts
// SPDX-License-Identifier: BSD-3-Clause
// Exact generated tokens; virtual member bodies remain in the generated module.
const _widgetStateValueRegistration = registerWidgetStateValueSemantics(
    [SourceWidgetState, SourceWidgetStateAnd, SourceWidgetStateOr, SourceWidgetStateNot, SourceAnyWidgetStates],
    [SourceWidgetStateMapper, SourceWidgetStatePropertyAll],
);
