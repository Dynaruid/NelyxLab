// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/slider_theme.dart; SHA256 bc3715a3ae2c4ba1cc934513d3a55f062261f138c7b3918b94a0d89552375b98
const _dartTemporary0 = Symbol();
export class ShowValueIndicator {
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
    static readonly onlyForDiscrete: ShowValueIndicator = new ShowValueIndicator(0, "onlyForDiscrete", _dartTemporary0);
    static readonly onlyForContinuous: ShowValueIndicator = new ShowValueIndicator(1, "onlyForContinuous", _dartTemporary0);
    static readonly always: ShowValueIndicator = new ShowValueIndicator(2, "always", _dartTemporary0);
    static readonly onDrag: ShowValueIndicator = new ShowValueIndicator(3, "onDrag", _dartTemporary0);
    static readonly alwaysVisible: ShowValueIndicator = new ShowValueIndicator(4, "alwaysVisible", _dartTemporary0);
    static readonly never: ShowValueIndicator = new ShowValueIndicator(5, "never", _dartTemporary0);
    static readonly values: ReadonlyArray<ShowValueIndicator> = Object.freeze([ShowValueIndicator.onlyForDiscrete, ShowValueIndicator.onlyForContinuous, ShowValueIndicator.always, ShowValueIndicator.onDrag, ShowValueIndicator.alwaysVisible, ShowValueIndicator.never]);
    toString(): string {
        return "ShowValueIndicator." + this.name;
    }
}
Object.freeze(ShowValueIndicator.prototype);
Object.freeze(ShowValueIndicator);
const _dartTemporary2 = Symbol();
export class Thumb {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly index: number;
    private readonly _dartTemporary3!: void;
    /**
     * @dartParam index int
     * @dartParamOrigin index explicit
     */
    private constructor(index: number, readonly name: string, token: typeof _dartTemporary2) {
        if (token !== _dartTemporary2)
            throw new TypeError("Enum values cannot be constructed");
        this.index = index;
        Object.freeze(this);
    }
    static readonly start: Thumb = new Thumb(0, "start", _dartTemporary2);
    static readonly end: Thumb = new Thumb(1, "end", _dartTemporary2);
    static readonly values: ReadonlyArray<Thumb> = Object.freeze([Thumb.start, Thumb.end]);
    toString(): string {
        return "Thumb." + this.name;
    }
}
Object.freeze(Thumb.prototype);
Object.freeze(Thumb);
