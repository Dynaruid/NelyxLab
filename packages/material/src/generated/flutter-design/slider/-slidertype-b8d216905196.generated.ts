// W11 Flutter design source b8d21690519628c01998ace1f27777f13c7316c8b63eced5d756274362831eeb SHA256 2e8a7b357d6ad383011d2bc8584cb3b09bd4047d5eb56f4a84462dc2acf45a1b
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/slider.dart; SHA256 fb534046016f1476936580595c46ce1ef4d7392e2284cf9a0f6040ed918ba115
const _dartTemporary0 = Symbol();
export class _SliderType {
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
    static readonly material: _SliderType = new _SliderType(0, "material", _dartTemporary0);
    static readonly adaptive: _SliderType = new _SliderType(1, "adaptive", _dartTemporary0);
    static readonly values: ReadonlyArray<_SliderType> = Object.freeze([_SliderType.material, _SliderType.adaptive]);
    toString(): string {
        return "_SliderType." + this.name;
    }
}
Object.freeze(_SliderType.prototype);
Object.freeze(_SliderType);
