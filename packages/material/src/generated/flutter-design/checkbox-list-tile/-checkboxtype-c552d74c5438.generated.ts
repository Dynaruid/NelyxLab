// W11 Flutter design source c552d74c5438159294edaf453a272f337efecb5854282876d175bb3072188cad SHA256 671b81c94cf8a73e6d59e9a5c0f54c7fe2c436f808505db7856cb460314cbacc
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/checkbox_list_tile.dart; SHA256 51fd0a66168cdd5fe6e7379bfbf4f8369c30c00bfffab73a6f5cc7ed95c69459
const _dartTemporary0 = Symbol();
export class _CheckboxType {
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
    static readonly material: _CheckboxType = new _CheckboxType(0, "material", _dartTemporary0);
    static readonly adaptive: _CheckboxType = new _CheckboxType(1, "adaptive", _dartTemporary0);
    static readonly values: ReadonlyArray<_CheckboxType> = Object.freeze([_CheckboxType.material, _CheckboxType.adaptive]);
    toString(): string {
        return "_CheckboxType." + this.name;
    }
}
Object.freeze(_CheckboxType.prototype);
Object.freeze(_CheckboxType);
