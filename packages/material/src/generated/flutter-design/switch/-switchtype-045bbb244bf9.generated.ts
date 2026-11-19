// W11 Flutter design source 045bbb244bf9a12095a0fc5d350e98357d71ba178ac08f8be9614048dda09bb7 SHA256 062ce9f37c674234ad41322602c80cd87d44cdb081825db861b6ff69a66ef1cf
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/switch.dart; SHA256 49f3bdbe3e2a805344635cea627819d20cd9900a92da631efef9debcd982bb9b
const _dartTemporary0 = Symbol();
export class _SwitchType {
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
    static readonly material: _SwitchType = new _SwitchType(0, "material", _dartTemporary0);
    static readonly adaptive: _SwitchType = new _SwitchType(1, "adaptive", _dartTemporary0);
    static readonly values: ReadonlyArray<_SwitchType> = Object.freeze([_SwitchType.material, _SwitchType.adaptive]);
    toString(): string {
        return "_SwitchType." + this.name;
    }
}
Object.freeze(_SwitchType.prototype);
Object.freeze(_SwitchType);
