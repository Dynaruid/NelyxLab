// W11 Flutter design source b43fdd950758be9c3dcb547082df6821579ec9cd019767602cefe2dab3703719 SHA256 e75e0228dc053a5e20bbef2904f3b8e80292645d9ca45b16a7fe296cd030d712
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/chip.dart; SHA256 685691ad192ff45be1d81c82b2bda38e76784c30310c80daf9853a3815c3b93d
const _dartTemporary0 = Symbol();
export class _ChipSlot {
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
    static readonly label: _ChipSlot = new _ChipSlot(0, "label", _dartTemporary0);
    static readonly avatar: _ChipSlot = new _ChipSlot(1, "avatar", _dartTemporary0);
    static readonly deleteIcon: _ChipSlot = new _ChipSlot(2, "deleteIcon", _dartTemporary0);
    static readonly values: ReadonlyArray<_ChipSlot> = Object.freeze([_ChipSlot.label, _ChipSlot.avatar, _ChipSlot.deleteIcon]);
    toString(): string {
        return "_ChipSlot." + this.name;
    }
}
Object.freeze(_ChipSlot.prototype);
Object.freeze(_ChipSlot);
