// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors
// Adapted from vector_math 2.4.3, src/vector_math_64/quaternion.dart.
import {Vector3} from './vector3.ts';
import {Matrix3} from './matrix3.ts';
import {invariant} from '../foundation/errors.ts';
import {hashDoubles} from '../ui/value-math.ts';
import {numericString,numericIndex,numericValues,numericView,numericStorage,checkedNumericStorage,registerNumericObject,numericObjectStorage} from './numeric-helpers.ts';
import type {NumericRandom} from './vector.ts';
export class Quaternion {
    readonly #values: Float64Array;
    constructor(v0: number, v1: number, v2: number, v3: number);
    constructor(storage: Float64Array);
    constructor(...components: unknown[]) { this.#values = components.length === 1 ? numericView(components[0] as Float64Array, 4) : numericValues(components as number[], 4); registerNumericObject(this, this.#values, 'Quaternion'); }
    private static zero(): Quaternion { return new Quaternion(0, 0, 0, 0); }
    static fromFloat64List(storage: Float64Array): Quaternion { return new Quaternion(storage); }
    static fromBuffer(buffer: ArrayBufferLike, offset: number): Quaternion { return Quaternion.fromFloat64List(new Float64Array(buffer, offset, 4)); }
    static fromRotation(rotationMatrix: Matrix3): Quaternion { return (() => { const cascade0 = Quaternion.zero(); cascade0.setFromRotation(rotationMatrix); return cascade0; })(); }
    static axisAngle(axis: Vector3, angle: number): Quaternion { return (() => { const cascade1 = Quaternion.zero(); cascade1.setAxisAngle(axis, angle); return cascade1; })(); }
    static fromTwoVectors(a: Vector3, b: Vector3): Quaternion { return (() => { const cascade2 = Quaternion.zero(); cascade2.setFromTwoVectors(a, b); return cascade2; })(); }
    static copy(original: Quaternion): Quaternion { return (() => { const cascade3 = Quaternion.zero(); cascade3.setFrom(original); return cascade3; })(); }
    static random(rn: NumericRandom): Quaternion { return (() => { const cascade4 = Quaternion.zero(); cascade4.setRandom(rn); return cascade4; })(); }
    static identity(): Quaternion { return (() => { const cascade5 = Quaternion.zero(); numericObjectStorage(cascade5, "Quaternion")[3]! = 1.0; return cascade5; })(); }
    static dq(q: Quaternion, omega: Vector3): Quaternion { return (() => { const cascade6 = Quaternion.zero(); cascade6.setDQ(q, omega); return cascade6; })(); }
    static euler(yaw: number, pitch: number, roll: number): Quaternion { return (() => { const cascade7 = Quaternion.zero(); cascade7.setEuler(yaw, pitch, roll); return cascade7; })(); }
    get storage(): Float64Array { return numericStorage(this.#values); }
    get x(): number { return this.#values[0]!; }
    set x(x: number) { this.#values[0]! = x; }
    get y(): number { return this.#values[1]!; }
    set y(y: number) { this.#values[1]! = y; }
    get z(): number { return this.#values[2]!; }
    set z(z: number) { this.#values[2]! = z; }
    get w(): number { return this.#values[3]!; }
    set w(w: number) { this.#values[3]! = w; }
    clone(): Quaternion { return Quaternion.copy(this); }
    setFrom(source: Quaternion): void {
        const sourceStorage: Float64Array = numericObjectStorage(source, "Quaternion");
        this.#values[0]! = sourceStorage[0]!;
        this.#values[1]! = sourceStorage[1]!;
        this.#values[2]! = sourceStorage[2]!;
        this.#values[3]! = sourceStorage[3]!;
    }
    setValues(x: number, y: number, z: number, w: number): void {
        this.#values[0]! = x;
        this.#values[1]! = y;
        this.#values[2]! = z;
        this.#values[3]! = w;
    }
    setAxisAngle(axis: Vector3, radians: number): void {
        const len: number = axis.length;
        if (len === 0.0) {
            return;
        }
        const halfSin: number = Math.sin(radians * 0.5) / len;
        const axisStorage: Float64Array = checkedNumericStorage(axis.storage, 3);
        this.#values[0]! = axisStorage[0]! * halfSin;
        this.#values[1]! = axisStorage[1]! * halfSin;
        this.#values[2]! = axisStorage[2]! * halfSin;
        this.#values[3]! = Math.cos(radians * 0.5);
    }
    setFromRotation(rotationMatrix: Matrix3): void {
        const rotationMatrixStorage: Float64Array = checkedNumericStorage(rotationMatrix.storage, 9);
        const trace: number = rotationMatrix.trace();
        if (trace > 0.0) {
            let s: number = Math.sqrt(trace + 1.0);
            this.#values[3]! = s * 0.5;
            s = 0.5 / s;
            this.#values[0]! = (rotationMatrixStorage[5]! - rotationMatrixStorage[7]!) * s;
            this.#values[1]! = (rotationMatrixStorage[6]! - rotationMatrixStorage[2]!) * s;
            this.#values[2]! = (rotationMatrixStorage[1]! - rotationMatrixStorage[3]!) * s;
        }
        else {
            const i = rotationMatrixStorage[0]! < rotationMatrixStorage[4]! ? (rotationMatrixStorage[4]! < rotationMatrixStorage[8]! ? 2 : 1) : (rotationMatrixStorage[0]! < rotationMatrixStorage[8]! ? 2 : 0);
            const j: number = (i + 1) % 3;
            const k: number = (i + 2) % 3;
            let s: number = Math.sqrt(rotationMatrixStorage[rotationMatrix.index(i, i)]! - rotationMatrixStorage[rotationMatrix.index(j, j)]! - rotationMatrixStorage[rotationMatrix.index(k, k)]! + 1.0);
            this.#values[i]! = s * 0.5;
            s = 0.5 / s;
            this.#values[3]! = (rotationMatrixStorage[rotationMatrix.index(k, j)]! - rotationMatrixStorage[rotationMatrix.index(j, k)]!) * s;
            this.#values[j]! = (rotationMatrixStorage[rotationMatrix.index(j, i)]! + rotationMatrixStorage[rotationMatrix.index(i, j)]!) * s;
            this.#values[k]! = (rotationMatrixStorage[rotationMatrix.index(k, i)]! + rotationMatrixStorage[rotationMatrix.index(i, k)]!) * s;
        }
    }
    setFromTwoVectors(a: Vector3, b: Vector3): void {
        const v1: Vector3 = a.normalized();
        const v2: Vector3 = b.normalized();
        const c: number = v1.dot(v2);
        let angle: number = Math.acos(c);
        let axis: Vector3 = v1.cross(v2);
        if (Math.abs((1.0 + c)) < 0.0005) {
            angle = Math.PI;
            if (v1.x > v1.y && v1.x > v1.z) {
                axis = v1.cross(new Vector3(0.0, 1.0, 0.0));
            }
            else {
                axis = v1.cross(new Vector3(1.0, 0.0, 0.0));
            }
        }
        else if (Math.abs((1.0 - c)) < 0.0005) {
            angle = 0.0;
            axis = new Vector3(1.0, 0.0, 0.0);
        }
        this.setAxisAngle(axis.normalized(), angle);
    }
    setRandom(rn: NumericRandom): void {
        const x0: number = rn.nextDouble();
        const r1: number = Math.sqrt(1.0 - x0);
        const r2: number = Math.sqrt(x0);
        const t1: number = Math.PI * 2.0 * rn.nextDouble();
        const t2: number = Math.PI * 2.0 * rn.nextDouble();
        const c1: number = Math.cos(t1);
        const s1: number = Math.sin(t1);
        const c2: number = Math.cos(t2);
        const s2: number = Math.sin(t2);
        this.#values[0]! = s1 * r1;
        this.#values[1]! = c1 * r1;
        this.#values[2]! = s2 * r2;
        this.#values[3]! = c2 * r2;
    }
    setDQ(q: Quaternion, omega: Vector3): void {
        const qStorage: Float64Array = numericObjectStorage(q, "Quaternion");
        const omegaStorage: Float64Array = checkedNumericStorage(omega.storage, 3);
        const qx: number = qStorage[0]!;
        const qy: number = qStorage[1]!;
        const qz: number = qStorage[2]!;
        const qw: number = qStorage[3]!;
        const ox: number = omegaStorage[0]!;
        const oy: number = omegaStorage[1]!;
        const oz: number = omegaStorage[2]!;
        const x: number = ox * qw + oy * qz - oz * qy;
        const y: number = oy * qw + oz * qx - ox * qz;
        const z: number = oz * qw + ox * qy - oy * qx;
        const w: number = -ox * qx - oy * qy - oz * qz;
        this.#values[0]! = x * 0.5;
        this.#values[1]! = y * 0.5;
        this.#values[2]! = z * 0.5;
        this.#values[3]! = w * 0.5;
    }
    setEuler(yaw: number, pitch: number, roll: number): void {
        const halfYaw: number = yaw * 0.5;
        const halfPitch: number = pitch * 0.5;
        const halfRoll: number = roll * 0.5;
        const cosYaw: number = Math.cos(halfYaw);
        const sinYaw: number = Math.sin(halfYaw);
        const cosPitch: number = Math.cos(halfPitch);
        const sinPitch: number = Math.sin(halfPitch);
        const cosRoll: number = Math.cos(halfRoll);
        const sinRoll: number = Math.sin(halfRoll);
        this.#values[0]! = cosRoll * sinPitch * cosYaw + sinRoll * cosPitch * sinYaw;
        this.#values[1]! = cosRoll * cosPitch * sinYaw - sinRoll * sinPitch * cosYaw;
        this.#values[2]! = sinRoll * cosPitch * cosYaw - cosRoll * sinPitch * sinYaw;
        this.#values[3]! = cosRoll * cosPitch * cosYaw + sinRoll * sinPitch * sinYaw;
    }
    normalize(): number {
        const l: number = this.length;
        if (l === 0.0) {
            return 0.0;
        }
        const d: number = 1.0 / l;
        this.#values[0]! *= d;
        this.#values[1]! *= d;
        this.#values[2]! *= d;
        this.#values[3]! *= d;
        return l;
    }
    negate(): void {
        this.#values[3]! = -this.#values[3]!;
        this.conjugate();
    }
    conjugate(): void {
        this.#values[2]! = -this.#values[2]!;
        this.#values[1]! = -this.#values[1]!;
        this.#values[0]! = -this.#values[0]!;
    }
    inverse(): void {
        const l: number = 1.0 / this.length2;
        this.#values[3]! = this.#values[3]! * l;
        this.#values[2]! = -this.#values[2]! * l;
        this.#values[1]! = -this.#values[1]! * l;
        this.#values[0]! = -this.#values[0]! * l;
    }
    normalized(): Quaternion { return (() => { const cascade8 = this.clone(); cascade8.normalize(); return cascade8; })(); }
    negated(): Quaternion { return (() => { const cascade9 = this.clone(); cascade9.negate(); return cascade9; })(); }
    conjugated(): Quaternion { return (() => { const cascade10 = this.clone(); cascade10.conjugate(); return cascade10; })(); }
    inverted(): Quaternion { return (() => { const cascade11 = this.clone(); cascade11.inverse(); return cascade11; })(); }
    get radians(): number { return 2.0 * Math.acos(this.#values[3]!); }
    get axis(): Vector3 {
        const den: number = 1.0 - (this.#values[3]! * this.#values[3]!);
        if (den < 1e-9) {
            return Vector3.zero();
        }
        const scale: number = 1.0 / Math.sqrt(den);
        return new Vector3(this.#values[0]! * scale, this.#values[1]! * scale, this.#values[2]! * scale);
    }
    get length2(): number {
        const x: number = this.#values[0]!;
        const y: number = this.#values[1]!;
        const z: number = this.#values[2]!;
        const w: number = this.#values[3]!;
        return (x * x) + (y * y) + (z * z) + (w * w);
    }
    get length(): number { return Math.sqrt(this.length2); }
    rotated(v: Vector3): Vector3 {
        const out: Vector3 = v.clone();
        this.rotate(out);
        return out;
    }
    rotate(v: Vector3): Vector3 {
        const w: number = this.#values[3]!;
        const z: number = this.#values[2]!;
        const y: number = this.#values[1]!;
        const x: number = this.#values[0]!;
        const tiw = w;
        const tiz: number = -z;
        const tiy: number = -y;
        const tix: number = -x;
        const tx: number = tiw * v.x + tix * 0.0 + tiy * v.z - tiz * v.y;
        const ty: number = tiw * v.y + tiy * 0.0 + tiz * v.x - tix * v.z;
        const tz: number = tiw * v.z + tiz * 0.0 + tix * v.y - tiy * v.x;
        const tw: number = tiw * 0.0 - tix * v.x - tiy * v.y - tiz * v.z;
        const resultX: number = tw * x + tx * w + ty * z - tz * y;
        const resultY: number = tw * y + ty * w + tz * x - tx * z;
        const resultZ: number = tw * z + tz * w + tx * y - ty * x;
        const vStorage: Float64Array = checkedNumericStorage(v.storage, 3);
        vStorage[2]! = resultZ;
        vStorage[1]! = resultY;
        vStorage[0]! = resultX;
        return v;
    }
    add(arg: Quaternion): void {
        const argStorage: Float64Array = numericObjectStorage(arg, "Quaternion");
        this.#values[0]! = this.#values[0]! + argStorage[0]!;
        this.#values[1]! = this.#values[1]! + argStorage[1]!;
        this.#values[2]! = this.#values[2]! + argStorage[2]!;
        this.#values[3]! = this.#values[3]! + argStorage[3]!;
    }
    sub(arg: Quaternion): void {
        const argStorage: Float64Array = numericObjectStorage(arg, "Quaternion");
        this.#values[0]! = this.#values[0]! - argStorage[0]!;
        this.#values[1]! = this.#values[1]! - argStorage[1]!;
        this.#values[2]! = this.#values[2]! - argStorage[2]!;
        this.#values[3]! = this.#values[3]! - argStorage[3]!;
    }
    scale(scale: number): void {
        this.#values[3]! = this.#values[3]! * scale;
        this.#values[2]! = this.#values[2]! * scale;
        this.#values[1]! = this.#values[1]! * scale;
        this.#values[0]! = this.#values[0]! * scale;
    }
    scaled(scale: number): Quaternion { return (() => { const cascade12 = this.clone(); cascade12.scale(scale); return cascade12; })(); }
    times(other: Quaternion): Quaternion {
        const w: number = this.#values[3]!;
        const z: number = this.#values[2]!;
        const y: number = this.#values[1]!;
        const x: number = this.#values[0]!;
        const otherStorage: Float64Array = numericObjectStorage(other, "Quaternion");
        const ow: number = otherStorage[3]!;
        const oz: number = otherStorage[2]!;
        const oy: number = otherStorage[1]!;
        const ox: number = otherStorage[0]!;
        return new Quaternion(w * ox + x * ow + y * oz - z * oy, w * oy + y * ow + z * ox - x * oz, w * oz + z * ow + x * oy - y * ox, w * ow - x * ox - y * oy - z * oz);
    }
    equals(other: unknown): boolean { return ((other instanceof Quaternion)) && (this.#values[3]! === numericObjectStorage(other, "Quaternion")[3]!) && (this.#values[2]! === numericObjectStorage(other, "Quaternion")[2]!) && (this.#values[1]! === numericObjectStorage(other, "Quaternion")[1]!) && (this.#values[0]! === numericObjectStorage(other, "Quaternion")[0]!); }
    get hashCode(): number { return hashDoubles(Array.from(this.#values).slice(0, 4)); }
    plus(other: Quaternion): Quaternion { return (() => { const cascade13 = this.clone(); cascade13.add(other); return cascade13; })(); }
    minus(other: Quaternion): Quaternion { return (() => { const cascade14 = this.clone(); cascade14.sub(other); return cascade14; })(); }
    unaryMinus(): Quaternion { return this.negated(); }
    at(i: number): number { numericIndex(i, this.#values.length); return this.#values[i]!; }
    setAt(i: number, arg: number): void { numericIndex(i, this.#values.length); this.#values[i]! = arg; }
    asRotationMatrix(): Matrix3 { return this.copyRotationInto(Matrix3.zero()); }
    copyRotationInto(rotationMatrix: Matrix3): Matrix3 {
        const d: number = this.length2;
        invariant(d !== 0.0, "invalid-numeric-argument", "Numeric precondition failed");
        const s: number = 2.0 / d;
        const x: number = this.#values[0]!;
        const y: number = this.#values[1]!;
        const z: number = this.#values[2]!;
        const w: number = this.#values[3]!;
        const xs: number = x * s;
        const ys: number = y * s;
        const zs: number = z * s;
        const wx: number = w * xs;
        const wy: number = w * ys;
        const wz: number = w * zs;
        const xx: number = x * xs;
        const xy: number = x * ys;
        const xz: number = x * zs;
        const yy: number = y * ys;
        const yz: number = y * zs;
        const zz: number = z * zs;
        const rotationMatrixStorage: Float64Array = checkedNumericStorage(rotationMatrix.storage, 9);
        rotationMatrixStorage[0]! = 1.0 - (yy + zz);
        rotationMatrixStorage[1]! = xy + wz;
        rotationMatrixStorage[2]! = xz - wy;
        rotationMatrixStorage[3]! = xy - wz;
        rotationMatrixStorage[4]! = 1.0 - (xx + zz);
        rotationMatrixStorage[5]! = yz + wx;
        rotationMatrixStorage[6]! = xz + wy;
        rotationMatrixStorage[7]! = yz - wx;
        rotationMatrixStorage[8]! = 1.0 - (xx + yy);
        return rotationMatrix;
    }
    toString(): string { return (`${numericString(this.#values[0]!)}, ${numericString(this.#values[1]!)},` + ` ${numericString(this.#values[2]!)} @ ${numericString(this.#values[3]!)}`); }
    relativeError(correct: Quaternion): number {
        const diff: Quaternion = correct.minus(this);
        const normDiff: number = diff.length;
        const correctNorm: number = correct.length;
        return normDiff / correctNorm;
    }
    absoluteError(correct: Quaternion): number {
        const thisNorm: number = this.length;
        const correctNorm: number = correct.length;
        const normDiff: number = Math.abs((thisNorm - correctNorm));
        return normDiff;
    }
}
