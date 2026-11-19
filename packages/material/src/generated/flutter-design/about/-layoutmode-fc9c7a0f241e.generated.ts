// W11 Flutter design source fc9c7a0f241edbd979f449e60d64ad86a34670c070ca5f45753e2d0572d0b672 SHA256 6b76d4b8946836e9168278d7f1971f7b59c049701060fe5c9423e8724e41cef4
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/about.dart; SHA256 5742f8820a7aa2dc6a1249654f3fd1b8a909f17ae190adb54a792f19c3b3b854
const _dartTemporary0 = Symbol();
export class _LayoutMode {
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
    static readonly lateral: _LayoutMode = new _LayoutMode(0, "lateral", _dartTemporary0);
    static readonly nested: _LayoutMode = new _LayoutMode(1, "nested", _dartTemporary0);
    static readonly values: ReadonlyArray<_LayoutMode> = Object.freeze([_LayoutMode.lateral, _LayoutMode.nested]);
    toString(): string {
        return "_LayoutMode." + this.name;
    }
}
Object.freeze(_LayoutMode.prototype);
Object.freeze(_LayoutMode);
