// W11 Flutter design source 22421e8e55b1470eae77aab4933ba1e6e40e668356450cebe577b3d207e6054a SHA256 7852e702f437e4ebbf518697aef940887294332cc6540d50bbc509be5db372be
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/context_menu.dart; SHA256 ab38b8f4b8b7f4bb22cda83fd98b35f7767cef320bd6b71b2178ca802f4cd4ec
const _dartTemporary0 = Symbol();
export class _ContextMenuLocation {
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
    static readonly center: _ContextMenuLocation = new _ContextMenuLocation(0, "center", _dartTemporary0);
    static readonly left: _ContextMenuLocation = new _ContextMenuLocation(1, "left", _dartTemporary0);
    static readonly right: _ContextMenuLocation = new _ContextMenuLocation(2, "right", _dartTemporary0);
    static readonly values: ReadonlyArray<_ContextMenuLocation> = Object.freeze([_ContextMenuLocation.center, _ContextMenuLocation.left, _ContextMenuLocation.right]);
    toString(): string {
        return "_ContextMenuLocation." + this.name;
    }
}
Object.freeze(_ContextMenuLocation.prototype);
Object.freeze(_ContextMenuLocation);
