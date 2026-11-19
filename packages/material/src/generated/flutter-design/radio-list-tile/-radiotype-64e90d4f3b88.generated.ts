// W11 Flutter design source 64e90d4f3b88252ed468987a87356f8d311cb8608655cc8dab76bc42f81591a1 SHA256 9ac5bcc34d3bbcb89d41fc47a3b68d09ea6de48d66418b3a67cefbe85d09bb02
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/radio_list_tile.dart; SHA256 648a66ed3840dd053f4c583e3b30c9fcbfab20b5db602974ba1312e940a69125
const _dartTemporary0 = Symbol();
export class _RadioType {
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
    static readonly material: _RadioType = new _RadioType(0, "material", _dartTemporary0);
    static readonly adaptive: _RadioType = new _RadioType(1, "adaptive", _dartTemporary0);
    static readonly values: ReadonlyArray<_RadioType> = Object.freeze([_RadioType.material, _RadioType.adaptive]);
    toString(): string {
        return "_RadioType." + this.name;
    }
}
Object.freeze(_RadioType.prototype);
Object.freeze(_RadioType);
