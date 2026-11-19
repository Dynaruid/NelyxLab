// W11 Flutter design source d5879528e05a1c19dc46691b0fa3f8cd6e30beef7e868f173f5ddf357ec94e45 SHA256 cd84ba4645e27237a8099052565fc0cb292479a2502ee21c44b22761b7f5d1ba
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/refresh_indicator.dart; SHA256 7b678333183a3f77b7674b824b6b226dd79ca8114f670ce6da5643c45e1a6b67
const _dartTemporary0 = Symbol();
export class _IndicatorType {
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
    static readonly material: _IndicatorType = new _IndicatorType(0, "material", _dartTemporary0);
    static readonly adaptive: _IndicatorType = new _IndicatorType(1, "adaptive", _dartTemporary0);
    static readonly noSpinner: _IndicatorType = new _IndicatorType(2, "noSpinner", _dartTemporary0);
    static readonly values: ReadonlyArray<_IndicatorType> = Object.freeze([_IndicatorType.material, _IndicatorType.adaptive, _IndicatorType.noSpinner]);
    toString(): string {
        return "_IndicatorType." + this.name;
    }
}
Object.freeze(_IndicatorType.prototype);
Object.freeze(_IndicatorType);
