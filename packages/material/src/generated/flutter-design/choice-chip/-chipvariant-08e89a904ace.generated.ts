// W11 Flutter design source 08e89a904acefc71f42ef956156d8742cd18d3fd47cd94263f03173359cbfe9e SHA256 6bd121e585faba4d23c430a60671f40a7c0cfa3e15530259e940fbb3ab928a87
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/choice_chip.dart; SHA256 82f0e174418eb76de8c87cc413a01c59de240df6c3f81aa5f684ba6bff074f74
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
