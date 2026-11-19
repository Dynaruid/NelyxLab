// W11 Flutter design source 81cea2ecd8c573e19b8e5e0b25f2e22752e2b76b209366b43af542d8d9131d75 SHA256 801f6604a9dcd169a6c1f71730971fd41fc243ec0c74c92f54d7c0f6c304a4e0
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/list_tile.dart; SHA256 2ff708034de9b3bdd66d32539148dd7b3d2eb422e31df9dc9378e522cd930175
const _dartTemporary0 = Symbol();
export class _CupertinoListTileType {
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
    static readonly base: _CupertinoListTileType = new _CupertinoListTileType(0, "base", _dartTemporary0);
    static readonly notched: _CupertinoListTileType = new _CupertinoListTileType(1, "notched", _dartTemporary0);
    static readonly values: ReadonlyArray<_CupertinoListTileType> = Object.freeze([_CupertinoListTileType.base, _CupertinoListTileType.notched]);
    toString(): string {
        return "_CupertinoListTileType." + this.name;
    }
}
Object.freeze(_CupertinoListTileType.prototype);
Object.freeze(_CupertinoListTileType);
