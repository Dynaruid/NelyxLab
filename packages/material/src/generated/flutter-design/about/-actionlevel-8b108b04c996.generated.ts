// W11 Flutter design source 8b108b04c99656ee911cbbda577a09cee6e904e185cdc24b87265e965fa5bd7e SHA256 90d67755d8fbaf34c1ce4387f8329b4ab24bc2d5bf8e246526b9e33a7bb47fec
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/about.dart; SHA256 5742f8820a7aa2dc6a1249654f3fd1b8a909f17ae190adb54a792f19c3b3b854
const _dartTemporary0 = Symbol();
export class _ActionLevel {
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
    static readonly top: _ActionLevel = new _ActionLevel(0, "top", _dartTemporary0);
    static readonly view: _ActionLevel = new _ActionLevel(1, "view", _dartTemporary0);
    static readonly values: ReadonlyArray<_ActionLevel> = Object.freeze([_ActionLevel.top, _ActionLevel.view]);
    toString(): string {
        return "_ActionLevel." + this.name;
    }
}
Object.freeze(_ActionLevel.prototype);
Object.freeze(_ActionLevel);
