// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from package:vector_math/src/vector_math_64/triangle.dart; SHA256 dea04250d5b181b840118c94e97793c5a2201b608517b66110e65bb0f9dee36e
import { Vector3 } from './vector3.ts';
import { Matrix4 } from './matrix4.ts';
import '../ui/value-math.ts';
import { protect } from '../ui/value-math.ts';
export class SourceTriangle {
  readonly _dart_db9869b6aff8475c_point0: Vector3;
  readonly _dart_db9869b6aff8475c_point1: Vector3;
  readonly _dart_db9869b6aff8475c_point2: Vector3;
  constructor() {
    const _initialField0 = Vector3.zero();
    const _initialField1 = Vector3.zero();
    const _initialField2 = Vector3.zero();
    this._dart_db9869b6aff8475c_point0 = _initialField0;
    this._dart_db9869b6aff8475c_point1 = _initialField1;
    this._dart_db9869b6aff8475c_point2 = _initialField2;
    protect(this, [
      '_dart_db9869b6aff8475c_point0',
      '_dart_db9869b6aff8475c_point1',
      '_dart_db9869b6aff8475c_point2',
    ]);
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
  copyFrom(other: SourceTriangle): void {
    this._dart_db9869b6aff8475c_point0.setFrom(other._dart_db9869b6aff8475c_point0);
    this._dart_db9869b6aff8475c_point1.setFrom(other._dart_db9869b6aff8475c_point1);
    this._dart_db9869b6aff8475c_point2.setFrom(other._dart_db9869b6aff8475c_point2);
  }
  copyNormalInto(normal: Vector3): void {
    const v0: Vector3 = (() => {
      const _dartTemporary0 = this.point0.clone();
      _dartTemporary0.sub(this.point1);
      return _dartTemporary0;
    })();
    (() => {
      const _dartTemporary1 = normal;
      _dartTemporary1.setFrom(this.point2);
      _dartTemporary1.sub(this.point1);
      _dartTemporary1.crossInto(v0, normal);
      _dartTemporary1.normalize();
      return _dartTemporary1;
    })();
  }
  transform(t: Matrix4): void {
    (() => {
      const _dartTemporary2 = t;
      _dartTemporary2.transform3(this._dart_db9869b6aff8475c_point0);
      _dartTemporary2.transform3(this._dart_db9869b6aff8475c_point1);
      _dartTemporary2.transform3(this._dart_db9869b6aff8475c_point2);
      return _dartTemporary2;
    })();
  }
  translate(offset: Vector3): void {
    this._dart_db9869b6aff8475c_point0.add(offset);
    this._dart_db9869b6aff8475c_point1.add(offset);
    this._dart_db9869b6aff8475c_point2.add(offset);
  }
  static copy(other: SourceTriangle): SourceTriangle {
    return _dartTemporary3(other);
  }
  static points(point0: Vector3, point1: Vector3, point2: Vector3): SourceTriangle {
    return _dartTemporary5(point0, point1, point2);
  }
}
function _dartTemporary3(other: SourceTriangle): SourceTriangle {
  const _dartTemporary4: InstanceType<typeof Object> & {
    _dart_db9869b6aff8475c_point0: Vector3;
    _dart_db9869b6aff8475c_point1: Vector3;
    _dart_db9869b6aff8475c_point2: Vector3;
  } = Reflect.construct(
    Object,
    [] satisfies ConstructorParameters<typeof Object>,
    SourceTriangle,
  ) as InstanceType<typeof Object> & {
    _dart_db9869b6aff8475c_point0: Vector3;
    _dart_db9869b6aff8475c_point1: Vector3;
    _dart_db9869b6aff8475c_point2: Vector3;
  };
  const _initialField0 = Vector3.copy(other._dart_db9869b6aff8475c_point0);
  const _initialField1 = Vector3.copy(other._dart_db9869b6aff8475c_point1);
  const _initialField2 = Vector3.copy(other._dart_db9869b6aff8475c_point2);
  _dartTemporary4._dart_db9869b6aff8475c_point0 = _initialField0;
  _dartTemporary4._dart_db9869b6aff8475c_point1 = _initialField1;
  _dartTemporary4._dart_db9869b6aff8475c_point2 = _initialField2;
  protect(_dartTemporary4, [
    '_dart_db9869b6aff8475c_point0',
    '_dart_db9869b6aff8475c_point1',
    '_dart_db9869b6aff8475c_point2',
  ]);
  return _dartTemporary4 as SourceTriangle;
}
function _dartTemporary5(point0: Vector3, point1: Vector3, point2: Vector3): SourceTriangle {
  const _dartTemporary6: InstanceType<typeof Object> & {
    _dart_db9869b6aff8475c_point0: Vector3;
    _dart_db9869b6aff8475c_point1: Vector3;
    _dart_db9869b6aff8475c_point2: Vector3;
  } = Reflect.construct(
    Object,
    [] satisfies ConstructorParameters<typeof Object>,
    SourceTriangle,
  ) as InstanceType<typeof Object> & {
    _dart_db9869b6aff8475c_point0: Vector3;
    _dart_db9869b6aff8475c_point1: Vector3;
    _dart_db9869b6aff8475c_point2: Vector3;
  };
  const _initialField0 = Vector3.copy(point0);
  const _initialField1 = Vector3.copy(point1);
  const _initialField2 = Vector3.copy(point2);
  _dartTemporary6._dart_db9869b6aff8475c_point0 = _initialField0;
  _dartTemporary6._dart_db9869b6aff8475c_point1 = _initialField1;
  _dartTemporary6._dart_db9869b6aff8475c_point2 = _initialField2;
  protect(_dartTemporary6, [
    '_dart_db9869b6aff8475c_point0',
    '_dart_db9869b6aff8475c_point1',
    '_dart_db9869b6aff8475c_point2',
  ]);
  return _dartTemporary6 as SourceTriangle;
}
