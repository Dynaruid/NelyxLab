// W11 Flutter design source e49eb87cb94282bcf80972ba737e68c194e83dd725f86df75175f47b0f863aa2 SHA256 0186a45fad9170d85749c5dc677a72768806c594128eba9c91d6370e4588604e
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/filled_button.dart; SHA256 41747ef7a35a228b04c41409cd32ea2d3d77e012d91920baed20d83f6cc4f1b1
const _dartTemporary0 = Symbol();
export class _FilledButtonVariant {
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
    static readonly filled: _FilledButtonVariant = new _FilledButtonVariant(0, "filled", _dartTemporary0);
    static readonly tonal: _FilledButtonVariant = new _FilledButtonVariant(1, "tonal", _dartTemporary0);
    static readonly values: ReadonlyArray<_FilledButtonVariant> = Object.freeze([_FilledButtonVariant.filled, _FilledButtonVariant.tonal]);
    toString(): string {
        return "_FilledButtonVariant." + this.name;
    }
}
Object.freeze(_FilledButtonVariant.prototype);
Object.freeze(_FilledButtonVariant);
