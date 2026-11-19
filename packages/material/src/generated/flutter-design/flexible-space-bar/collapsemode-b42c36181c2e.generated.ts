// W11 Flutter design source b42c36181c2e945504d8f9828749ab9c9ae18b61b66c9aa4a7b2a79ba3892515 SHA256 3ba8acc385bc4a7ec1b0fb3245b5931913a51abc913a3855b896cb079dd356dc
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/flexible_space_bar.dart; SHA256 45051ac78d4d9ff498c72d58a6194bd747bee325b555957bfdca7d88e69dee90
const _dartTemporary0 = Symbol();
export class CollapseMode {
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
    static readonly parallax: CollapseMode = new CollapseMode(0, "parallax", _dartTemporary0);
    static readonly pin: CollapseMode = new CollapseMode(1, "pin", _dartTemporary0);
    static readonly none: CollapseMode = new CollapseMode(2, "none", _dartTemporary0);
    static readonly values: ReadonlyArray<CollapseMode> = Object.freeze([CollapseMode.parallax, CollapseMode.pin, CollapseMode.none]);
    toString(): string {
        return "CollapseMode." + this.name;
    }
}
Object.freeze(CollapseMode.prototype);
Object.freeze(CollapseMode);
