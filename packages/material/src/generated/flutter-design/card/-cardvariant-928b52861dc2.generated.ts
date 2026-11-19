// W11 Flutter design source 928b52861dc2a397ffec4ab0d0151568cfc6e6212f1f187344d20bcd6cba7518 SHA256 c34fedb2ea9c68d2687b0509a377a75b133be90de813dd6955c5587852afd86a
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/card.dart; SHA256 4077357a0c129a2d468244313f7bcec63e7b2b16d62508c8e287fe461ab9630e
const _dartTemporary0 = Symbol();
export class _CardVariant {
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
    static readonly elevated: _CardVariant = new _CardVariant(0, "elevated", _dartTemporary0);
    static readonly filled: _CardVariant = new _CardVariant(1, "filled", _dartTemporary0);
    static readonly outlined: _CardVariant = new _CardVariant(2, "outlined", _dartTemporary0);
    static readonly values: ReadonlyArray<_CardVariant> = Object.freeze([_CardVariant.elevated, _CardVariant.filled, _CardVariant.outlined]);
    toString(): string {
        return "_CardVariant." + this.name;
    }
}
Object.freeze(_CardVariant.prototype);
Object.freeze(_CardVariant);
