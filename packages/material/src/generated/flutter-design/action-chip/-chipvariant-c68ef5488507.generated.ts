// W11 Flutter design source c68ef5488507c7f91553a1ebc73518e31efaf9cc2d838103058e803b81acbe8f SHA256 588ac9c55df80090529aada5c723b8a9eeef225ed8697fc6734a53cc385f9c96
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/action_chip.dart; SHA256 d9889f57834a7ad9869c391512555a997ee3807adda4c4fee23ae65885be16a4
const _dartTemporary0 = Symbol();
export class _ChipVariant {
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
    static readonly flat: _ChipVariant = new _ChipVariant(0, "flat", _dartTemporary0);
    static readonly elevated: _ChipVariant = new _ChipVariant(1, "elevated", _dartTemporary0);
    static readonly values: ReadonlyArray<_ChipVariant> = Object.freeze([_ChipVariant.flat, _ChipVariant.elevated]);
    toString(): string {
        return "_ChipVariant." + this.name;
    }
}
Object.freeze(_ChipVariant.prototype);
Object.freeze(_ChipVariant);
