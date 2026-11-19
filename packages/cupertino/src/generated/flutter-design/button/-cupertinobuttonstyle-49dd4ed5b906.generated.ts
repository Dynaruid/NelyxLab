// W11 Flutter design source 49dd4ed5b906590d8946f62e3c0cf6c95e4f1f141870286225c9db9a468bddab SHA256 4e49eca64aa95f077cb2d1c0d8c54430359901cae2ee3a9d27f122ed8623b8ee
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/button.dart; SHA256 cafa8d3dfe72fab817d2836a1ce7e073c3e41b44985576f059183257673eb3db
const _dartTemporary0 = Symbol();
export class _CupertinoButtonStyle {
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
    static readonly plain: _CupertinoButtonStyle = new _CupertinoButtonStyle(0, "plain", _dartTemporary0);
    static readonly tinted: _CupertinoButtonStyle = new _CupertinoButtonStyle(1, "tinted", _dartTemporary0);
    static readonly filled: _CupertinoButtonStyle = new _CupertinoButtonStyle(2, "filled", _dartTemporary0);
    static readonly values: ReadonlyArray<_CupertinoButtonStyle> = Object.freeze([_CupertinoButtonStyle.plain, _CupertinoButtonStyle.tinted, _CupertinoButtonStyle.filled]);
    toString(): string {
        return "_CupertinoButtonStyle." + this.name;
    }
}
Object.freeze(_CupertinoButtonStyle.prototype);
Object.freeze(_CupertinoButtonStyle);
