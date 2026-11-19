// W11 Flutter design source 77a5232d0eb33c6267556e6f660b8215c0d025dab74160491b3b38280c7bdb7b SHA256 b58fcd10ae1005721449979b7f83eadef1e3594758896cce77dd6c5216565728
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/nav_bar.dart; SHA256 ab4f0cc2cb1e1a0288c3f8a9547c2d125300844b3101a6353d61c531ba5a5657
const _dartTemporary0 = Symbol();
export class NavigationBarBottomMode {
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
    static readonly automatic: NavigationBarBottomMode = new NavigationBarBottomMode(0, "automatic", _dartTemporary0);
    static readonly always: NavigationBarBottomMode = new NavigationBarBottomMode(1, "always", _dartTemporary0);
    static readonly values: ReadonlyArray<NavigationBarBottomMode> = Object.freeze([NavigationBarBottomMode.automatic, NavigationBarBottomMode.always]);
    toString(): string {
        return "NavigationBarBottomMode." + this.name;
    }
}
Object.freeze(NavigationBarBottomMode.prototype);
Object.freeze(NavigationBarBottomMode);
