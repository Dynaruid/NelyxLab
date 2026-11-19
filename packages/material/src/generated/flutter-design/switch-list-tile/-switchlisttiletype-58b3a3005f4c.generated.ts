// W11 Flutter design source 58b3a3005f4c598f4736f66ad3443e330d83fa277adf1214c6d9075f0aaad0b4 SHA256 ca5d20063a79550f08c2f9cc97a2d6ee5dd2ed55726599205205d9323bb84492
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/switch_list_tile.dart; SHA256 b44ebeb60e99a01aac0b626e82c67fa10a9f0b2b885dda878e198fadd066a2ae
const _dartTemporary0 = Symbol();
export class _SwitchListTileType {
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
    static readonly material: _SwitchListTileType = new _SwitchListTileType(0, "material", _dartTemporary0);
    static readonly adaptive: _SwitchListTileType = new _SwitchListTileType(1, "adaptive", _dartTemporary0);
    static readonly values: ReadonlyArray<_SwitchListTileType> = Object.freeze([_SwitchListTileType.material, _SwitchListTileType.adaptive]);
    toString(): string {
        return "_SwitchListTileType." + this.name;
    }
}
Object.freeze(_SwitchListTileType.prototype);
Object.freeze(_SwitchListTileType);
