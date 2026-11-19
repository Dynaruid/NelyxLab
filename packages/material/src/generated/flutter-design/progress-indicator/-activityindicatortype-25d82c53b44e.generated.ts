// W11 Flutter design source 25d82c53b44e7635188fd8f34926f5cb7c4375194edfae31d11411c78112e81c SHA256 8851f37ab1d050a81b8f1f630d8b3083281493afc22c272a2788de822ae4d2e7
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/progress_indicator.dart; SHA256 3227834938a84fcf50ba2f3989231d18a0fdf65d31775abe3ea98e6cf8f46daf
const _dartTemporary0 = Symbol();
export class _ActivityIndicatorType {
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
    static readonly material: _ActivityIndicatorType = new _ActivityIndicatorType(0, "material", _dartTemporary0);
    static readonly adaptive: _ActivityIndicatorType = new _ActivityIndicatorType(1, "adaptive", _dartTemporary0);
    static readonly values: ReadonlyArray<_ActivityIndicatorType> = Object.freeze([_ActivityIndicatorType.material, _ActivityIndicatorType.adaptive]);
    toString(): string {
        return "_ActivityIndicatorType." + this.name;
    }
}
Object.freeze(_ActivityIndicatorType.prototype);
Object.freeze(_ActivityIndicatorType);
