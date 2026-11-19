// W11 Flutter design source 3da456d9e325dd83ab7b1eed15ddfed112d51d49e1655874a261a57b497d3b2e SHA256 f76910bdcf1d0e1b4c4bd17f96383bddc6cf5df5ebe71a4054beafe2878d0dc0
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/about.dart; SHA256 5742f8820a7aa2dc6a1249654f3fd1b8a909f17ae190adb54a792f19c3b3b854
const _dartTemporary0 = Symbol();
export class _Focus {
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
    static readonly master: _Focus = new _Focus(0, "master", _dartTemporary0);
    static readonly detail: _Focus = new _Focus(1, "detail", _dartTemporary0);
    static readonly values: ReadonlyArray<_Focus> = Object.freeze([_Focus.master, _Focus.detail]);
    toString(): string {
        return "_Focus." + this.name;
    }
}
Object.freeze(_Focus.prototype);
Object.freeze(_Focus);
