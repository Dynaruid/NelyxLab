// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from package:vector_math/src/vector_math_64/quad.dart; SHA256 337773aac5a3acbd45557aaa4313c7317b451dcd2b18e04b426a116233c31296
import { Vector3 } from "./vector3.ts";
import { Matrix4 } from "./matrix4.ts";
import { SourceTriangle } from "./triangle.generated.ts";
import { isSourceQuad } from "./viewer-geometry-source-adapter.ts";
import { vectorSourceString } from "./viewer-geometry-source-adapter.ts";
import { quadPointHash } from "./viewer-geometry-source-adapter.ts";
import { checkedInteger } from "../ui/value-math.ts";
import { protect } from "../ui/value-math.ts";
export class SourceQuad {
    readonly _dart_db9869b6aff8475c_point0: Vector3;
    readonly _dart_db9869b6aff8475c_point1: Vector3;
    readonly _dart_db9869b6aff8475c_point2: Vector3;
    readonly _dart_db9869b6aff8475c_point3: Vector3;
    constructor() {
        const _initialField0 = Vector3.zero();
        const _initialField1 = Vector3.zero();
        const _initialField2 = Vector3.zero();
        const _initialField3 = Vector3.zero();
        this._dart_db9869b6aff8475c_point0 = _initialField0;
        this._dart_db9869b6aff8475c_point1 = _initialField1;
        this._dart_db9869b6aff8475c_point2 = _initialField2;
        this._dart_db9869b6aff8475c_point3 = _initialField3;
        protect(this, ["_dart_db9869b6aff8475c_point0", "_dart_db9869b6aff8475c_point1", "_dart_db9869b6aff8475c_point2", "_dart_db9869b6aff8475c_point3"]);
    }
    get point0(): Vector3 {
        return this._dart_db9869b6aff8475c_point0;
    }
    get point1(): Vector3 {
        return this._dart_db9869b6aff8475c_point1;
    }
    get point2(): Vector3 {
        return this._dart_db9869b6aff8475c_point2;
    }
    get point3(): Vector3 {
        return this._dart_db9869b6aff8475c_point3;
    }
    copyFrom(other: SourceQuad): void {
        this._dart_db9869b6aff8475c_point0.setFrom(other._dart_db9869b6aff8475c_point0);
        this._dart_db9869b6aff8475c_point1.setFrom(other._dart_db9869b6aff8475c_point1);
        this._dart_db9869b6aff8475c_point2.setFrom(other._dart_db9869b6aff8475c_point2);
        this._dart_db9869b6aff8475c_point3.setFrom(other._dart_db9869b6aff8475c_point3);
    }
    copyNormalInto(normal: Vector3): void {
        const v0: Vector3 = (() => {
            const _dartTemporary0 = this._dart_db9869b6aff8475c_point0.clone();
            _dartTemporary0.sub(this._dart_db9869b6aff8475c_point1);
            return _dartTemporary0;
        })();
        (() => {
            const _dartTemporary1 = normal;
            _dartTemporary1.setFrom(this._dart_db9869b6aff8475c_point2);
            _dartTemporary1.sub(this._dart_db9869b6aff8475c_point1);
            _dartTemporary1.crossInto(v0, normal);
            _dartTemporary1.normalize();
            return _dartTemporary1;
        })();
    }
    copyTriangles(triangle0: SourceTriangle, triangle1: SourceTriangle): void {
        triangle0._dart_db9869b6aff8475c_point0.setFrom(this._dart_db9869b6aff8475c_point0);
        triangle0._dart_db9869b6aff8475c_point1.setFrom(this._dart_db9869b6aff8475c_point1);
        triangle0._dart_db9869b6aff8475c_point2.setFrom(this._dart_db9869b6aff8475c_point2);
        triangle1._dart_db9869b6aff8475c_point0.setFrom(this._dart_db9869b6aff8475c_point0);
        triangle1._dart_db9869b6aff8475c_point1.setFrom(this._dart_db9869b6aff8475c_point3);
        triangle1._dart_db9869b6aff8475c_point2.setFrom(this._dart_db9869b6aff8475c_point2);
    }
    transform(t: Matrix4): void {
        (() => {
            const _dartTemporary2 = t;
            _dartTemporary2.transform3(this._dart_db9869b6aff8475c_point0);
            _dartTemporary2.transform3(this._dart_db9869b6aff8475c_point1);
            _dartTemporary2.transform3(this._dart_db9869b6aff8475c_point2);
            _dartTemporary2.transform3(this._dart_db9869b6aff8475c_point3);
            return _dartTemporary2;
        })();
    }
    translate(offset: Vector3): void {
        this._dart_db9869b6aff8475c_point0.add(offset);
        this._dart_db9869b6aff8475c_point1.add(offset);
        this._dart_db9869b6aff8475c_point2.add(offset);
        this._dart_db9869b6aff8475c_point3.add(offset);
    }
    toString(): string {
        return `[0] ${vectorSourceString(this._dart_db9869b6aff8475c_point0)}
[1] ${vectorSourceString(this._dart_db9869b6aff8475c_point1)}
[2] ${vectorSourceString(this._dart_db9869b6aff8475c_point2)}
[3] ${vectorSourceString(this._dart_db9869b6aff8475c_point3)}
`;
    }
    equals(other: {}): boolean {
        return (isSourceQuad(other)) && (this._dart_db9869b6aff8475c_point3.equals((other as SourceQuad)._dart_db9869b6aff8475c_point3)) && (this._dart_db9869b6aff8475c_point2.equals((other as SourceQuad)._dart_db9869b6aff8475c_point2)) && (this._dart_db9869b6aff8475c_point1.equals((other as SourceQuad)._dart_db9869b6aff8475c_point1)) && (this._dart_db9869b6aff8475c_point0.equals((other as SourceQuad)._dart_db9869b6aff8475c_point0));
    }
    /**
     * @dartReturn int
     * @dartReturnOrigin explicit
     */
    get hashCode(): number {
        return checkedInteger(quadPointHash(this._dart_db9869b6aff8475c_point0, this._dart_db9869b6aff8475c_point1, this._dart_db9869b6aff8475c_point2, this._dart_db9869b6aff8475c_point3));
    }
    static copy(other: SourceQuad): SourceQuad {
        return _dartTemporary3(other);
    }
    static points(point0: Vector3, point1: Vector3, point2: Vector3, point3: Vector3): SourceQuad {
        return _dartTemporary5(point0, point1, point2, point3);
    }
}
function _dartTemporary3(other: SourceQuad): SourceQuad {
    const _dartTemporary4: InstanceType<typeof Object> & {
        _dart_db9869b6aff8475c_point0: Vector3;
        _dart_db9869b6aff8475c_point1: Vector3;
        _dart_db9869b6aff8475c_point2: Vector3;
        _dart_db9869b6aff8475c_point3: Vector3;
    } = Reflect.construct(Object, [] satisfies ConstructorParameters<typeof Object>, SourceQuad) as InstanceType<typeof Object> & {
        _dart_db9869b6aff8475c_point0: Vector3;
        _dart_db9869b6aff8475c_point1: Vector3;
        _dart_db9869b6aff8475c_point2: Vector3;
        _dart_db9869b6aff8475c_point3: Vector3;
    };
    const _initialField0 = Vector3.copy(other._dart_db9869b6aff8475c_point0);
    const _initialField1 = Vector3.copy(other._dart_db9869b6aff8475c_point1);
    const _initialField2 = Vector3.copy(other._dart_db9869b6aff8475c_point2);
    const _initialField3 = Vector3.copy(other._dart_db9869b6aff8475c_point3);
    _dartTemporary4._dart_db9869b6aff8475c_point0 = _initialField0;
    _dartTemporary4._dart_db9869b6aff8475c_point1 = _initialField1;
    _dartTemporary4._dart_db9869b6aff8475c_point2 = _initialField2;
    _dartTemporary4._dart_db9869b6aff8475c_point3 = _initialField3;
    protect(_dartTemporary4, ["_dart_db9869b6aff8475c_point0", "_dart_db9869b6aff8475c_point1", "_dart_db9869b6aff8475c_point2", "_dart_db9869b6aff8475c_point3"]);
    return _dartTemporary4 as SourceQuad;
}
function _dartTemporary5(point0: Vector3, point1: Vector3, point2: Vector3, point3: Vector3): SourceQuad {
    const _dartTemporary6: InstanceType<typeof Object> & {
        _dart_db9869b6aff8475c_point0: Vector3;
        _dart_db9869b6aff8475c_point1: Vector3;
        _dart_db9869b6aff8475c_point2: Vector3;
        _dart_db9869b6aff8475c_point3: Vector3;
    } = Reflect.construct(Object, [] satisfies ConstructorParameters<typeof Object>, SourceQuad) as InstanceType<typeof Object> & {
        _dart_db9869b6aff8475c_point0: Vector3;
        _dart_db9869b6aff8475c_point1: Vector3;
        _dart_db9869b6aff8475c_point2: Vector3;
        _dart_db9869b6aff8475c_point3: Vector3;
    };
    const _initialField0 = Vector3.copy(point0);
    const _initialField1 = Vector3.copy(point1);
    const _initialField2 = Vector3.copy(point2);
    const _initialField3 = Vector3.copy(point3);
    _dartTemporary6._dart_db9869b6aff8475c_point0 = _initialField0;
    _dartTemporary6._dart_db9869b6aff8475c_point1 = _initialField1;
    _dartTemporary6._dart_db9869b6aff8475c_point2 = _initialField2;
    _dartTemporary6._dart_db9869b6aff8475c_point3 = _initialField3;
    protect(_dartTemporary6, ["_dart_db9869b6aff8475c_point0", "_dart_db9869b6aff8475c_point1", "_dart_db9869b6aff8475c_point2", "_dart_db9869b6aff8475c_point3"]);
    return _dartTemporary6 as SourceQuad;
}
