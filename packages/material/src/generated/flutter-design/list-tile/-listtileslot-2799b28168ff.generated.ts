// W11 Flutter design source 2799b28168ff1a658de23f9b8a1406f5d287d004a50b5ef3f43c3c27e466ffea SHA256 3ff63aa2116ad649ff066edab7792aaa5d82c784a0d19f81a083d05a346fbd2d
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/list_tile.dart; SHA256 d4ac162c9afb5534b5d4900e16aa377605503f39e397e4140e7319c2a1fa6349
const _dartTemporary0 = Symbol();
export class _ListTileSlot {
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
    static readonly leading: _ListTileSlot = new _ListTileSlot(0, "leading", _dartTemporary0);
    static readonly title: _ListTileSlot = new _ListTileSlot(1, "title", _dartTemporary0);
    static readonly subtitle: _ListTileSlot = new _ListTileSlot(2, "subtitle", _dartTemporary0);
    static readonly trailing: _ListTileSlot = new _ListTileSlot(3, "trailing", _dartTemporary0);
    static readonly values: ReadonlyArray<_ListTileSlot> = Object.freeze([_ListTileSlot.leading, _ListTileSlot.title, _ListTileSlot.subtitle, _ListTileSlot.trailing]);
    toString(): string {
        return "_ListTileSlot." + this.name;
    }
}
Object.freeze(_ListTileSlot.prototype);
Object.freeze(_ListTileSlot);
