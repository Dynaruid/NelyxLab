// W11 Flutter design source 47115a6b0aa12f28be667a3d6722b96c8508158eee81196d3db3903a9beade0b SHA256 9884e37c97a5994c0d3a47ce9af9cf2bbe52f80b6abbb888f10411800b37141e
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/slider.dart; SHA256 fb534046016f1476936580595c46ce1ef4d7392e2284cf9a0f6040ed918ba115
const _dartTemporary0 = Symbol();
export class _SliderAdjustmentType {
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
    static readonly right: _SliderAdjustmentType = new _SliderAdjustmentType(0, "right", _dartTemporary0);
    static readonly left: _SliderAdjustmentType = new _SliderAdjustmentType(1, "left", _dartTemporary0);
    static readonly up: _SliderAdjustmentType = new _SliderAdjustmentType(2, "up", _dartTemporary0);
    static readonly down: _SliderAdjustmentType = new _SliderAdjustmentType(3, "down", _dartTemporary0);
    static readonly values: ReadonlyArray<_SliderAdjustmentType> = Object.freeze([_SliderAdjustmentType.right, _SliderAdjustmentType.left, _SliderAdjustmentType.up, _SliderAdjustmentType.down]);
    toString(): string {
        return "_SliderAdjustmentType." + this.name;
    }
}
Object.freeze(_SliderAdjustmentType.prototype);
Object.freeze(_SliderAdjustmentType);
