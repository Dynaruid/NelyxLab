// W11 Flutter design source e8f1e878d2833c9d23e75628d76c39ab8ed9189379626d42017408f49deaa098 SHA256 ca1c0be6d83aed74e9d0f492cc7893d9063b9629d26e1765411f42dd009870a5
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/flexible_space_bar.dart; SHA256 45051ac78d4d9ff498c72d58a6194bd747bee325b555957bfdca7d88e69dee90
const _dartTemporary0 = Symbol();
export class StretchMode {
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
    static readonly zoomBackground: StretchMode = new StretchMode(0, "zoomBackground", _dartTemporary0);
    static readonly blurBackground: StretchMode = new StretchMode(1, "blurBackground", _dartTemporary0);
    static readonly fadeTitle: StretchMode = new StretchMode(2, "fadeTitle", _dartTemporary0);
    static readonly values: ReadonlyArray<StretchMode> = Object.freeze([StretchMode.zoomBackground, StretchMode.blurBackground, StretchMode.fadeTitle]);
    toString(): string {
        return "StretchMode." + this.name;
    }
}
Object.freeze(StretchMode.prototype);
Object.freeze(StretchMode);
