// W11 Flutter design source c125722df8b481d37770d216c290a2579aed2a71d581a8328bf845d2c1d69964 SHA256 5f3b8b14fd578a088f4176db9d66697fc573b2b4ebb0238a4c3e09e78c2f46ed
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/filter_chip.dart; SHA256 3609e41968bbf8e2ca80ac5242376c8c11d50c89fec3c19e0949f198972582b2
const _dartTemporary0 = Symbol();
export class _ChipVariant {
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
    static readonly flat: _ChipVariant = new _ChipVariant(0, "flat", _dartTemporary0);
    static readonly elevated: _ChipVariant = new _ChipVariant(1, "elevated", _dartTemporary0);
    static readonly values: ReadonlyArray<_ChipVariant> = Object.freeze([_ChipVariant.flat, _ChipVariant.elevated]);
    toString(): string {
        return "_ChipVariant." + this.name;
    }
}
Object.freeze(_ChipVariant.prototype);
Object.freeze(_ChipVariant);
