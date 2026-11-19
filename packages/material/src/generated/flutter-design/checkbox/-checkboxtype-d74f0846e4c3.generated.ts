// W11 Flutter design source d74f0846e4c3a35c1e3f97508c4bf963193660307755b7a8fcfe9c24610d7a68 SHA256 4509cf93b2c6ae4c5cf1efafd5b3c4eac84fd06890737420b7839b186c81a7e8
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/checkbox.dart; SHA256 80df12fe8d0a22173e72829fc314e2ac5b89c0f6d06dbdd831e1669668079af4
const _dartTemporary0 = Symbol();
export class _CheckboxType {
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
    static readonly material: _CheckboxType = new _CheckboxType(0, "material", _dartTemporary0);
    static readonly adaptive: _CheckboxType = new _CheckboxType(1, "adaptive", _dartTemporary0);
    static readonly values: ReadonlyArray<_CheckboxType> = Object.freeze([_CheckboxType.material, _CheckboxType.adaptive]);
    toString(): string {
        return "_CheckboxType." + this.name;
    }
}
Object.freeze(_CheckboxType.prototype);
Object.freeze(_CheckboxType);
