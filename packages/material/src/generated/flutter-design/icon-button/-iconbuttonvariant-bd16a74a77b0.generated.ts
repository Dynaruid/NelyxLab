// W11 Flutter design source bd16a74a77b0b315ff3761f488051e9e79b22c1787cc0bce6d88b797b518d7f5 SHA256 238ef234c0b87026c21b8df89923a45016e9f1f8b2e48890d4d0ef8b916e7a00
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/icon_button.dart; SHA256 5ef9d1abe87429931b9eeb533db8823b4bc02cb3c28f616b5dfc9d15a80267f8
const _dartTemporary0 = Symbol();
export class _IconButtonVariant {
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
    static readonly standard: _IconButtonVariant = new _IconButtonVariant(0, "standard", _dartTemporary0);
    static readonly filled: _IconButtonVariant = new _IconButtonVariant(1, "filled", _dartTemporary0);
    static readonly filledTonal: _IconButtonVariant = new _IconButtonVariant(2, "filledTonal", _dartTemporary0);
    static readonly outlined: _IconButtonVariant = new _IconButtonVariant(3, "outlined", _dartTemporary0);
    static readonly values: ReadonlyArray<_IconButtonVariant> = Object.freeze([_IconButtonVariant.standard, _IconButtonVariant.filled, _IconButtonVariant.filledTonal, _IconButtonVariant.outlined]);
    toString(): string {
        return "_IconButtonVariant." + this.name;
    }
}
Object.freeze(_IconButtonVariant.prototype);
Object.freeze(_IconButtonVariant);
