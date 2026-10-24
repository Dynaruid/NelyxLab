// SPDX-License-Identifier: BSD-3-Clause
import {checkedInteger} from '../ui/value-math.ts';
import {diagnosticDoubleString} from './debug.ts';

/** An explicit source boundary for erased Object/num/T slots. The caller must
 * know the resolved source numeric kind. These are not inferred JS numbers and
 * are deliberately not assignable to number. Scalar arithmetic uses unwrap. */
export class DartInt {
    readonly #value: number;
    private constructor(value: number) {
        if (new.target !== DartInt) throw new TypeError('DartInt cannot be extended');
        this.#value = checkedInteger(value) === 0 ? 0 : value;
        Object.freeze(this);
    }
    static fromSource(value: number): DartInt { return new DartInt(value); }
    static is(value: unknown): value is DartInt { return typeof value === 'object' && value !== null && #value in value; }
    get value(): number { return this.#value; }
    toString(): string { return String(this.#value); }
}

export class DartDouble {
    readonly #value: number;
    private constructor(value: number) {
        if (new.target !== DartDouble || typeof value !== 'number') throw new TypeError('Invalid source double');
        this.#value = value;
        Object.freeze(this);
    }
    static fromSource(value: number): DartDouble { return new DartDouble(value); }
    static is(value: unknown): value is DartDouble { return typeof value === 'object' && value !== null && #value in value; }
    get value(): number { return this.#value; }
    toString(): string { return diagnosticDoubleString(this.#value); }
}

export type DartNumeric = DartInt | DartDouble;
export function boxSourceDartInt(value:number):DartInt{return DartInt.fromSource(value);}
export function boxSourceDartDouble(value:number):DartDouble{return DartDouble.fromSource(value);}
function numericValue(value:DartNumeric):number{if(!DartInt.is(value)&&!DartDouble.is(value))throw new TypeError('Source arithmetic requires retained numeric provenance');return value.value;}
function numericResult(a:DartNumeric,b:DartNumeric,value:number):DartNumeric{return DartInt.is(a)&&DartInt.is(b)?DartInt.fromSource(value):DartDouble.fromSource(value);}
export function sourceDartNumAdd(a:DartNumeric,b:DartNumeric):DartNumeric{return numericResult(a,b,numericValue(a)+numericValue(b));}
export function sourceDartNumSubtract(a:DartNumeric,b:DartNumeric):DartNumeric{return numericResult(a,b,numericValue(a)-numericValue(b));}
export function sourceDartNumMultiply(a:DartNumeric,b:DartNumeric):DartNumeric{return numericResult(a,b,numericValue(a)*numericValue(b));}
export function sourceDartNumDivide(a:DartNumeric,b:DartNumeric):DartDouble{return DartDouble.fromSource(numericValue(a)/numericValue(b));}
export function sourceDartNumLess(a:DartNumeric,b:DartNumeric):boolean{return numericValue(a)<numericValue(b);}
export function sourceDartNumLessEqual(a:DartNumeric,b:DartNumeric):boolean{return numericValue(a)<=numericValue(b);}
export function sourceDartNumGreater(a:DartNumeric,b:DartNumeric):boolean{return numericValue(a)>numericValue(b);}
export function sourceDartNumGreaterEqual(a:DartNumeric,b:DartNumeric):boolean{return numericValue(a)>=numericValue(b);}
export function castSourceDartInt(value:unknown):number{
    requireDartNumericProvenance(value);
    if(!DartInt.is(value))throw new TypeError('Invalid source cast: int');
    return value.value;
}
export function isDartNumeric(value: unknown): value is DartNumeric { return DartInt.is(value) || DartDouble.is(value); }

/** A raw number in an erased slot has already lost the information needed for
 * a source runtime test. Reject it, including integral-looking double values. */
export function requireDartNumericProvenance(value: unknown): void {
    if (typeof value === 'number') throw new TypeError('Dart numeric runtime test requires source value provenance');
}
export function isSourceDartDouble(value: unknown): boolean { requireDartNumericProvenance(value); return DartDouble.is(value); }
export function isSourceDartInt(value: unknown): boolean { requireDartNumericProvenance(value); return DartInt.is(value); }
export function isSourceDartNum(value: unknown): boolean { requireDartNumericProvenance(value); return isDartNumeric(value); }
export function castSourceDartNum(value: unknown): DartNumeric {
    requireDartNumericProvenance(value);
    if(!isDartNumeric(value))throw new TypeError('Invalid source cast: num');
    return value;
}
/** Explicit scalar-host parameter boundary; never use this to infer a source kind. */
export function unwrapSourceDartNum(value: unknown): number { return castSourceDartNum(value).value; }
export function castSourceDartDouble(value: unknown): number {
    requireDartNumericProvenance(value);
    if (!DartDouble.is(value)) throw new TypeError('Invalid source cast: double');
    return value.value;
}
