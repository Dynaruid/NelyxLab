// W11 Flutter design source b0d37a7dc24dda032c65fce53fdea507a3a52958b47e4f3f19265e9adce49366 SHA256 d03f6ab65e57452c18a27ff53a9609925d3f635b747506895bb24c116987be52
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/floating_action_button.dart; SHA256 cb478527aa8449901dda380699bc1090e4ff172e132884834154b0b6de120c3a
const _dartTemporary0 = Symbol();
export class _FloatingActionButtonType {
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
    static readonly regular: _FloatingActionButtonType = new _FloatingActionButtonType(0, "regular", _dartTemporary0);
    static readonly small: _FloatingActionButtonType = new _FloatingActionButtonType(1, "small", _dartTemporary0);
    static readonly large: _FloatingActionButtonType = new _FloatingActionButtonType(2, "large", _dartTemporary0);
    static readonly extended: _FloatingActionButtonType = new _FloatingActionButtonType(3, "extended", _dartTemporary0);
    static readonly values: ReadonlyArray<_FloatingActionButtonType> = Object.freeze([_FloatingActionButtonType.regular, _FloatingActionButtonType.small, _FloatingActionButtonType.large, _FloatingActionButtonType.extended]);
    toString(): string {
        return "_FloatingActionButtonType." + this.name;
    }
}
Object.freeze(_FloatingActionButtonType.prototype);
Object.freeze(_FloatingActionButtonType);
