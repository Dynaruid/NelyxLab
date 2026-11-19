// W11 Flutter design source ab246fac78f7a1078544e08ecaa7fd56ae1166b51a4981b720d130fe493c8c6f SHA256 1d829be07a256f73a930523b45d5ecc1c0d853d60f623152dcc32ccb516a2993
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/input_decorator.dart; SHA256 345b85180466c88f7db850dd3eab6ede8755314e30cb4254eba9c431b694a20c
const _dartTemporary0 = Symbol();
export class _DecorationSlot {
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
    static readonly icon: _DecorationSlot = new _DecorationSlot(0, "icon", _dartTemporary0);
    static readonly input: _DecorationSlot = new _DecorationSlot(1, "input", _dartTemporary0);
    static readonly label: _DecorationSlot = new _DecorationSlot(2, "label", _dartTemporary0);
    static readonly hint: _DecorationSlot = new _DecorationSlot(3, "hint", _dartTemporary0);
    static readonly prefix: _DecorationSlot = new _DecorationSlot(4, "prefix", _dartTemporary0);
    static readonly suffix: _DecorationSlot = new _DecorationSlot(5, "suffix", _dartTemporary0);
    static readonly prefixIcon: _DecorationSlot = new _DecorationSlot(6, "prefixIcon", _dartTemporary0);
    static readonly suffixIcon: _DecorationSlot = new _DecorationSlot(7, "suffixIcon", _dartTemporary0);
    static readonly helperError: _DecorationSlot = new _DecorationSlot(8, "helperError", _dartTemporary0);
    static readonly counter: _DecorationSlot = new _DecorationSlot(9, "counter", _dartTemporary0);
    static readonly container: _DecorationSlot = new _DecorationSlot(10, "container", _dartTemporary0);
    static readonly values: ReadonlyArray<_DecorationSlot> = Object.freeze([_DecorationSlot.icon, _DecorationSlot.input, _DecorationSlot.label, _DecorationSlot.hint, _DecorationSlot.prefix, _DecorationSlot.suffix, _DecorationSlot.prefixIcon, _DecorationSlot.suffixIcon, _DecorationSlot.helperError, _DecorationSlot.counter, _DecorationSlot.container]);
    toString(): string {
        return "_DecorationSlot." + this.name;
    }
}
Object.freeze(_DecorationSlot.prototype);
Object.freeze(_DecorationSlot);
