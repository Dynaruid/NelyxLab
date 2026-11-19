// W11 Flutter design source 535855dc4a8ba4ba906df2e66305eb170fa1f90aee396ccfe109e89a8e0d55c2 SHA256 60b26f1fb3afc9ce65f2d129f817f4d553760e64aeba5737c843514f62663ad8
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/time_picker.dart; SHA256 bf9998e0b8280e6448774c41a95910c9233b910f396aa010f02928431f65d9d8
const _dartTemporary0 = Symbol();
export class _HourDialType {
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
        this.index = index;
        Object.freeze(this);
    }
    static readonly twentyFourHour: _HourDialType = new _HourDialType(0, "twentyFourHour", _dartTemporary0);
    static readonly twentyFourHourDoubleRing: _HourDialType = new _HourDialType(1, "twentyFourHourDoubleRing", _dartTemporary0);
    static readonly twelveHour: _HourDialType = new _HourDialType(2, "twelveHour", _dartTemporary0);
    static readonly values: ReadonlyArray<_HourDialType> = Object.freeze([_HourDialType.twentyFourHour, _HourDialType.twentyFourHourDoubleRing, _HourDialType.twelveHour]);
    toString(): string {
        return "_HourDialType." + this.name;
    }
}
Object.freeze(_HourDialType.prototype);
Object.freeze(_HourDialType);
