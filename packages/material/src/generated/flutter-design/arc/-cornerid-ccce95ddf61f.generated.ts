// W11 Flutter design source ccce95ddf61f3aae5ef94e4232a349e10760729789c64e48dc3dbaa952399989 SHA256 0207bc78b6022a25a3bbdcb4d04f52a5523c4ecb48d62d5ac2a9db775292f744
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/arc.dart; SHA256 03d2c41e7860163c924630e32eb1e737a57751c7372b142151508955b7764963
const _dartTemporary0 = Symbol();
export class _CornerId {
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
    static readonly topLeft: _CornerId = new _CornerId(0, "topLeft", _dartTemporary0);
    static readonly topRight: _CornerId = new _CornerId(1, "topRight", _dartTemporary0);
    static readonly bottomLeft: _CornerId = new _CornerId(2, "bottomLeft", _dartTemporary0);
    static readonly bottomRight: _CornerId = new _CornerId(3, "bottomRight", _dartTemporary0);
    static readonly values: ReadonlyArray<_CornerId> = Object.freeze([_CornerId.topLeft, _CornerId.topRight, _CornerId.bottomLeft, _CornerId.bottomRight]);
    toString(): string {
        return "_CornerId." + this.name;
    }
}
Object.freeze(_CornerId.prototype);
Object.freeze(_CornerId);
